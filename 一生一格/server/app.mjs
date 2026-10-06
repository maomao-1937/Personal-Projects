import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { openDatabase } from './database.mjs';
import { accessCodeDigest, normalizeAccessCode, sessionDigest } from './invites.mjs';
import { decryptLegacyDraftMetadata } from './legacyDrafts.mjs';
import { validGoals } from './taskPlanValidation.mjs';

const SESSION_LIFETIME = 30 * 24 * 60 * 60 * 1000;
const BODY_LIMIT = 4 * 1024 * 1024;
const LIMIT_WINDOW = 15 * 60 * 1000;
const isoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

function anniversary(birth, years) {
  const [year, month, day] = birth.split('-').map(Number);
  const next = year + years;
  if (next > 9999) return null;
  const leap = next % 4 === 0 && (next % 100 !== 0 || next % 400 === 0);
  return `${String(next).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(month === 2 && day === 29 && !leap ? 28 : day).padStart(2, '0')}`;
}

function validProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile) || profile.version !== 3) return false;
  const { birthDate, endDate, endMode, notes, mind, guide } = profile;
  if (!isoDate(birthDate) || !isoDate(endDate) || endDate <= birthDate || !anniversary(birthDate, 120) || endDate > anniversary(birthDate, 120)) return false;
  if (!['age', 'date'].includes(endMode)) return false;
  if (!notes || typeof notes !== 'object' || Array.isArray(notes) || Object.keys(notes).length > 6500) return false;
  for (const [key, value] of Object.entries(notes)) {
    if (!/^\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$/.test(key) || !isoDate(key.slice(0, 10)) || !isoDate(key.slice(11)) || typeof value !== 'string' || value.length > 500) return false;
  }
  if (!mind || typeof mind !== 'object' || !['rational', 'monkey', 'monster'].includes(mind.selected) || !isoDate(mind.day)) return false;
  if (!guide || typeof guide !== 'object' || typeof guide.goal !== 'string' || guide.goal.length > 80 || typeof guide.distraction !== 'string' || guide.distraction.length > 60 || typeof guide.soundEnabled !== 'boolean') return false;
  if (Object.hasOwn(profile, 'goals') && !validGoals(profile.goals)) return false;
  if (Object.hasOwn(profile, 'calendarConfigured') && typeof profile.calendarConfigured !== 'boolean') return false;
  return true;
}

function json(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(data));
}

async function bodyJson(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw Object.assign(new Error('请发送 JSON 数据'), { status: 415 });
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw Object.assign(new Error('数据过大'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON 格式不正确'), { status: 400 }); }
}

function cookieToken(req) {
  const match = /(?:^|;\s*)life_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '');
  return match?.[1] ?? null;
}

function reserveLoginAttempt(db, codeHash, at) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM code_login_attempts WHERE created_at<?').run(at - LIMIT_WINDOW);
    const codeCount = db.prepare('SELECT COUNT(*) AS n FROM code_login_attempts WHERE code_hash=?').get(codeHash).n;
    const globalCount = db.prepare('SELECT COUNT(*) AS n FROM code_login_attempts').get().n;
    const knownCode = !!db.prepare('SELECT 1 FROM accounts WHERE code_hash=?').get(codeHash);
    // Random guesses cannot lock out someone who actually holds a valid code.
    if (codeCount >= 10 || (globalCount >= 300 && !knownCode)) {
      db.exec('ROLLBACK');
      return false;
    }
    db.prepare('INSERT INTO code_login_attempts(code_hash,created_at) VALUES(?,?)').run(codeHash, at);
    db.exec('COMMIT');
    return true;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
}

export function createApp(options = {}) {
  const authSecret = options.authSecret ?? randomBytes(32);
  const db = openDatabase(options.dbPath ?? ':memory:', { authSecret });
  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(options.allowedOrigins ?? []);
  const production = !!options.production;
  const cookieSuffix = `Path=/api; HttpOnly; SameSite=Lax${production ? '; Secure' : ''}`;
  const staticDir = options.staticDir ? resolve(options.staticDir) : null;
  const warnedLegacyAccounts = new Set();

  function sessionFor(token) {
    if (!token) return null;
    return db.prepare(`SELECT s.account_id AS id,a.legacy_draft_iv AS iv,a.legacy_draft_ciphertext AS ciphertext,a.legacy_draft_tag AS tag FROM account_sessions s JOIN accounts a ON a.id=s.account_id
      WHERE s.token_hash=? AND s.expires_at>? AND s.code_version=a.code_version AND a.code_hash IS NOT NULL`).get(sessionDigest(authSecret, token), now());
  }

  function sessionUser(row) {
    if (!row) return null;
    try {
      const legacyDraft = decryptLegacyDraftMetadata(authSecret, row);
      return legacyDraft ? { id: row.id, legacyDraft } : { id: row.id };
    } catch {
      if (!warnedLegacyAccounts.has(row.id)) {
        warnedLegacyAccounts.add(row.id);
        console.warn('旧草稿映射无法解密；已省略可选迁移信息，请检查 AUTH_SECRET 备份。');
      }
      return { id: row.id };
    }
  }

  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      if (!path.startsWith('/api/')) {
        if (!staticDir || req.method !== 'GET') return json(res, 404, { error: '未找到页面' });
        let file = resolve(staticDir, `.${path}`);
        if (path === '/') file = join(staticDir, 'index.html');
        if (!file.startsWith(staticDir + sep) && file !== staticDir) return json(res, 404, { error: '未找到页面' });
        if (!existsSync(file) || !extname(file)) file = join(staticDir, 'index.html');
        const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }[extname(file)] ?? 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': `${mime}${['.html', '.js', '.css', '.json', '.webmanifest', '.svg'].includes(extname(file)) ? '; charset=utf-8' : ''}`, 'X-Content-Type-Options': 'nosniff' });
        return res.end(readFileSync(file));
      }
      if (!['GET', 'POST', 'PUT'].includes(req.method ?? '')) return json(res, 405, { error: '不支持此操作' });
      if (req.method !== 'GET' && !allowedOrigins.has(req.headers.origin)) return json(res, 403, { error: '请求来源无效' });
      const token = cookieToken(req);
      const session = sessionFor(token);

      if (path === '/api/session' && req.method === 'GET') return json(res, 200, { user: sessionUser(session) });
      if (path === '/api/auth/login' && req.method === 'POST') {
        const payload = await bodyJson(req);
        const code = normalizeAccessCode(payload?.inviteCode);
        if (!code) return json(res, 401, { error: '邀请码不正确' });
        const codeHash = accessCodeDigest(authSecret, code);
        if (!reserveLoginAttempt(db, codeHash, now())) return json(res, 429, { error: '尝试过于频繁，请稍后再试' });
        // Serialize lookup and session creation with an administrator's code rotation.
        db.exec('BEGIN IMMEDIATE');
        let account;
        let sessionToken;
        try {
          account = db.prepare('SELECT id,code_version,legacy_draft_iv AS iv,legacy_draft_ciphertext AS ciphertext,legacy_draft_tag AS tag FROM accounts WHERE code_hash=?').get(codeHash);
          if (!account) {
            db.exec('ROLLBACK');
            return json(res, 401, { error: '邀请码不正确' });
          }
          sessionToken = randomBytes(32).toString('hex');
          db.prepare('INSERT INTO account_sessions(token_hash,account_id,code_version,expires_at) VALUES(?,?,?,?)').run(
            sessionDigest(authSecret, sessionToken), account.id, account.code_version, now() + SESSION_LIFETIME,
          );
          db.exec('COMMIT');
        } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
        return json(res, 200, { user: sessionUser(account) }, { 'Set-Cookie': `life_session=${sessionToken}; Max-Age=${SESSION_LIFETIME / 1000}; ${cookieSuffix}` });
      }
      if (path === '/api/auth/logout' && req.method === 'POST') {
        if (token) db.prepare('DELETE FROM account_sessions WHERE token_hash=?').run(sessionDigest(authSecret, token));
        return json(res, 200, { ok: true }, { 'Set-Cookie': `life_session=; Max-Age=0; ${cookieSuffix}` });
      }
      if (path === '/api/profile') {
        if (!session) return json(res, 401, { error: '请先登录' });
        if (req.method === 'GET') {
          const row = db.prepare('SELECT data,revision FROM account_profiles WHERE account_id=?').get(session.id);
          return json(res, 200, { profile: row ? JSON.parse(row.data) : null, revision: row?.revision ?? 0 });
        }
        if (req.method === 'PUT') {
          const payload = await bodyJson(req);
          if (!payload || !Number.isSafeInteger(payload.revision) || payload.revision < 0 || !validProfile(payload.profile)) return json(res, 400, { error: '档案格式不正确' });
          const profile = { ...payload.profile, updatedAt: new Date(now()).toISOString() };
          const revision = payload.revision + 1;
          db.exec('BEGIN IMMEDIATE');
          try {
            const currentSession = sessionFor(token);
            if (!currentSession) {
              db.exec('ROLLBACK');
              return json(res, 401, { error: '请先登录' });
            }
            const row = db.prepare('SELECT data,revision FROM account_profiles WHERE account_id=?').get(currentSession.id);
            if (payload.revision !== (row?.revision ?? 0)) {
              db.exec('ROLLBACK');
              return json(res, 409, { profile: row ? JSON.parse(row.data) : null, revision: row?.revision ?? 0 });
            }
            if (row) db.prepare('UPDATE account_profiles SET data=?,revision=? WHERE account_id=?').run(JSON.stringify(profile), revision, currentSession.id);
            else db.prepare('INSERT INTO account_profiles(account_id,data,revision) VALUES(?,?,?)').run(currentSession.id, JSON.stringify(profile), revision);
            db.exec('COMMIT');
          } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
          return json(res, 200, { profile, revision });
        }
      }
      return json(res, 404, { error: '未找到接口' });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      if (status === 500) console.error('API error:', error);
      return json(res, status, { error: status === 500 ? '服务暂时不可用' : error.message });
    }
  });

  return { server, db, close: () => { server.close(); db.close(); } };
}
