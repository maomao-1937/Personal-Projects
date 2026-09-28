import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { request as httpRequest } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createApp } from './app.mjs';
import { bindLegacyAccount, createAccount, rotateAccount, accessCodeDigest, normalizeAccessCode, sessionDigest } from './invites.mjs';
import { decryptLegacyDraftMetadata } from './legacyDrafts.mjs';
import { openDatabase } from './database.mjs';
import { normalizeAppOrigin } from './config.mjs';

const ORIGIN = 'http://127.0.0.1:5173';
const SECRET = 'local-test-secret-at-least-thirty-two-chars';
const OTHER_SECRET = 'a-different-test-secret-at-least-32-chars';
const profile = {
  version: 3, birthDate: '1990-01-01', endDate: '2080-01-01', endMode: 'age',
  notes: { '1990-01-01:2025-01-01': '今天很好' },
  mind: { selected: 'rational', day: '2026-09-25' },
  guide: { goal: '写一页', distraction: '刷手机', soundEnabled: false }, updatedAt: '',
};

async function fixture(t, options = {}) {
  let clock = Date.UTC(2026, 8, 25);
  const app = createApp({ allowedOrigins: [ORIGIN], authSecret: SECRET, now: () => clock, ...options });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await new Promise((resolve) => app.server.close(resolve));
    app.db.close();
  }
  t.after(close);
  async function request(path, { method = 'GET', body, cookie, origin = ORIGIN } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: { ...(method !== 'GET' ? { Origin: origin } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], rawCookie: response.headers.get('set-cookie') };
  }
  async function login(code) { return request('/api/auth/login', { method: 'POST', body: { inviteCode: code } }); }
  return { request, login, create: () => createAccount(app.db, SECRET, clock), rotate: (id) => rotateAccount(app.db, id, SECRET, clock), db: app.db, server: app.server, base, advance: (ms) => { clock += ms; }, close };
}

let heldRequestId = 0;
function heldProfilePut(f, cookie, payload) {
  const id = String(++heldRequestId);
  const serialized = JSON.stringify(payload);
  const halfway = Math.floor(serialized.length / 2);
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const onRequest = (incoming) => {
    if (incoming.headers['x-test-held-request'] !== id) return;
    f.server.off('request', onRequest);
    markStarted();
  };
  f.server.on('request', onRequest);
  let finishResponse;
  const result = new Promise((resolve) => { finishResponse = resolve; });
  const req = httpRequest(`${f.base}/api/profile`, {
    method: 'PUT', headers: { Origin: ORIGIN, Cookie: cookie, 'Content-Type': 'application/json', 'X-Test-Held-Request': id },
  }, (response) => {
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => finishResponse({ status: response.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
  });
  req.on('error', (error) => finishResponse(Promise.reject(error)));
  req.write(serialized.slice(0, halfway));
  return { started, finish: () => req.end(serialized.slice(halfway)), result };
}

test('a dedicated code logs in and stores no plaintext code', async (t) => {
  const f = await fixture(t);
  const account = f.create();
  assert.match(account.code, /^[A-HJKMNP-Z2-9]{5}(?:-[A-HJKMNP-Z2-9]{5}){3}-[A-HJKMNP-Z2-9]{6}$/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE code_hash=?').get(account.code).n, 0);
  assert.equal(f.db.prepare('SELECT code_hash FROM accounts WHERE id=?').get(account.accountId).code_hash, accessCodeDigest(SECRET, account.code));
  const login = await f.login(account.code);
  assert.equal(login.status, 200);
  assert.deepEqual(login.data, { user: { id: account.accountId } });
  assert.match(login.rawCookie, /HttpOnly/);
  assert.match(login.rawCookie, /SameSite=Lax/);
  assert.deepEqual((await f.request('/api/session', { cookie: login.cookie })).data.user, { id: account.accountId });
  assert.equal((await f.login(account.code.replaceAll('-', ' ').toLowerCase())).status, 200);
  assert.equal((await f.request('/api/auth/logout', { method: 'POST', cookie: login.cookie })).status, 200);
  assert.equal((await f.request('/api/session', { cookie: login.cookie })).data.user, null);
});

test('removed background music endpoint is unavailable', async (t) => {
  const f = await fixture(t);
  const login = await f.login(f.create().code);
  assert.equal((await f.request('/api/audio/background', { cookie: login.cookie })).status, 404);
});

test('accounts keep separate profiles and first-write conflicts return latest revision', async (t) => {
  const f = await fixture(t);
  const alice = await f.login(f.create().code);
  const bob = await f.login(f.create().code);
  assert.equal((await f.request('/api/profile', { method: 'PUT', cookie: alice.cookie, origin: 'https://elsewhere.example', body: { profile, revision: 0 } })).status, 403);
  assert.equal((await f.request('/api/profile', { method: 'PUT', body: { profile, revision: 0 } })).status, 401);
  const saved = await f.request('/api/profile', { method: 'PUT', cookie: alice.cookie, body: { profile, revision: 0 } });
  assert.equal(saved.status, 200);
  const conflict = await f.request('/api/profile', { method: 'PUT', cookie: alice.cookie, body: { profile, revision: 0 } });
  assert.equal(conflict.status, 409);
  assert.deepEqual(conflict.data, saved.data);
  assert.deepEqual((await f.request('/api/profile', { cookie: bob.cookie })).data, { profile: null, revision: 0 });
});

test('rotation invalidates the old code and every session but retains notes', async (t) => {
  const f = await fixture(t);
  const account = f.create();
  const first = await f.login(account.code);
  const second = await f.login(account.code);
  await f.request('/api/profile', { method: 'PUT', cookie: first.cookie, body: { profile, revision: 0 } });
  const replacement = f.rotate(account.accountId);
  assert.equal(replacement.accountId, account.accountId);
  assert.notEqual(replacement.code, account.code);
  assert.equal((await f.login(account.code)).status, 401);
  assert.equal((await f.request('/api/session', { cookie: first.cookie })).data.user, null);
  assert.equal((await f.request('/api/session', { cookie: second.cookie })).data.user, null);
  const login = await f.login(replacement.code);
  assert.equal(login.status, 200);
  const loaded = await f.request('/api/profile', { cookie: login.cookie });
  assert.equal(loaded.data.revision, 1);
  assert.equal(loaded.data.profile.notes['1990-01-01:2025-01-01'], '今天很好');
});

test('invalid codes have generic errors and rate limits apply before lookup', async (t) => {
  const f = await fixture(t);
  const code = f.create().code;
  const wrong = 'A'.repeat(26) === normalizeAccessCode(code) ? 'B'.repeat(26) : 'A'.repeat(26);
  assert.equal((await f.login(wrong)).status, 401);
  for (let i = 0; i < 9; i++) await f.login(wrong);
  assert.equal((await f.login(wrong)).status, 429);
  f.advance(15 * 60 * 1000 + 1);
  assert.equal((await f.login(wrong)).status, 401);
  assert.equal((await f.login(code)).status, 200);
  assert.equal((await f.request('/api/auth/register', { method: 'POST', body: {} })).status, 404);
});

test('global invalid-code flood does not block a real dedicated code', async (t) => {
  const f = await fixture(t);
  const account = f.create();
  const insert = f.db.prepare('INSERT INTO code_login_attempts(code_hash,created_at) VALUES(?,?)');
  for (let i = 0; i < 300; i++) insert.run(`invalid-${i}`, Date.UTC(2026, 8, 25));
  assert.equal((await f.login('A'.repeat(26))).status, 429);
  assert.equal((await f.login(account.code)).status, 200);
});

test('legacy email account migrates without loss and can bind a code exactly once', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'life-weeks-legacy-code-'));
  const dbPath = join(dir, 'users.sqlite');
  const old = new DatabaseSync(dbPath);
  old.exec(`CREATE TABLE users(email TEXT PRIMARY KEY,password_hash TEXT);
    CREATE TABLE profiles(email TEXT PRIMARY KEY REFERENCES users(email),data TEXT NOT NULL,revision INTEGER NOT NULL);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,email TEXT REFERENCES users(email),expires_at INTEGER NOT NULL);
    CREATE TABLE invite_tokens(token_hash TEXT PRIMARY KEY,email TEXT,purpose TEXT,expires_at INTEGER,used_at INTEGER,created_at INTEGER);`);
  old.prepare('INSERT INTO users(email,password_hash) VALUES(?,?)').run('alice@example.com', 'old-password-hash');
  old.prepare('INSERT INTO profiles(email,data,revision) VALUES(?,?,?)').run('alice@example.com', JSON.stringify(profile), 4);
  old.prepare('INSERT INTO sessions(token_hash,email,expires_at) VALUES(?,?,?)').run('old-session', 'alice@example.com', Date.UTC(2027, 1, 1));
  old.close();
  // Admin CLI opens the existing database before the API is started.
  const admin = openDatabase(dbPath, { authSecret: SECRET });
  assert.equal(admin.prepare('SELECT COUNT(*) AS n FROM account_profiles').get().n, 1);
  assert.equal(admin.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n, 0);
  assert.equal(admin.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN ('users','profiles','sessions','invite_tokens')").get().n, 0);
  assert.equal(admin.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('legacy_identity_links') WHERE name='email'").get().n, 0);
  const bound = bindLegacyAccount(admin, 'Alice@Example.com', SECRET);
  assert.equal(admin.prepare('SELECT COUNT(*) AS n FROM legacy_identity_links').get().n, 0);
  const sealed = admin.prepare('SELECT legacy_draft_iv AS iv,legacy_draft_ciphertext AS ciphertext,legacy_draft_tag AS tag FROM accounts WHERE id=?').get(bound.accountId);
  assert.match(sealed.ciphertext, /^[a-f0-9]+$/);
  assert.equal(admin.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('accounts') WHERE name IN ('legacy_draft_salt','legacy_draft_hash')").get().n, 0);
  assert.throws(() => bindLegacyAccount(admin, 'alice@example.com', SECRET));
  admin.close();
  const f = await fixture(t, { dbPath });
  const login = await f.login(bound.code);
  assert.equal(login.status, 200);
  assert.equal(login.data.user.id, bound.accountId);
  const legacyDraft = login.data.user.legacyDraft;
  assert.match(legacyDraft.salt, /^[a-f0-9]{32}$/);
  const oldKey = 'life-in-weeks-account-draft-v1:alice%40example.com';
  assert.equal(legacyDraft.hash, createHash('sha256').update(`${legacyDraft.salt}:${oldKey}`).digest('hex'));
  assert.deepEqual((await f.request('/api/session', { cookie: login.cookie })).data.user.legacyDraft, legacyDraft);
  const loaded = await f.request('/api/profile', { cookie: login.cookie });
  assert.equal(loaded.data.revision, 4);
  assert.equal(loaded.data.profile.notes['1990-01-01:2025-01-01'], '今天很好');
  await f.close();
  rmSync(dir, { recursive: true, force: true });
});

test('old plaintext draft metadata is encrypted in place without changing code, session or profile', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'life-weeks-seal-old-'));
  const dbPath = join(dir, 'users.sqlite');
  const old = new DatabaseSync(dbPath);
  old.exec(`CREATE TABLE accounts(id TEXT PRIMARY KEY,code_hash TEXT UNIQUE,code_version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,code_issued_at INTEGER,legacy_draft_salt TEXT,legacy_draft_hash TEXT);
    CREATE TABLE account_profiles(account_id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL);
    CREATE TABLE account_sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL,code_version INTEGER NOT NULL,expires_at INTEGER NOT NULL);`);
  const account = createAccount(old, SECRET);
  const salt = 'ab'.repeat(16);
  const key = 'life-in-weeks-account-draft-v1:alice%40example.com';
  const hash = createHash('sha256').update(`${salt}:${key}`).digest('hex');
  old.prepare('UPDATE accounts SET legacy_draft_salt=?,legacy_draft_hash=? WHERE id=?').run(salt, hash, account.accountId);
  old.prepare('INSERT INTO account_profiles(account_id,data,revision) VALUES(?,?,?)').run(account.accountId, JSON.stringify(profile), 5);
  const token = 'cd'.repeat(32);
  old.prepare('INSERT INTO account_sessions(token_hash,account_id,code_version,expires_at) VALUES(?,?,?,?)').run(
    sessionDigest(SECRET, token), account.accountId, 1, Date.UTC(2027, 1, 1),
  );
  old.close();
  const migrated = openDatabase(dbPath, { authSecret: SECRET });
  const columns = migrated.prepare('PRAGMA table_info(accounts)').all().map((column) => column.name);
  assert.equal(columns.includes('legacy_draft_salt'), false);
  assert.equal(columns.includes('legacy_draft_hash'), false);
  const sealed = migrated.prepare('SELECT legacy_draft_iv AS iv,legacy_draft_ciphertext AS ciphertext,legacy_draft_tag AS tag FROM accounts WHERE id=?').get(account.accountId);
  assert.deepEqual(decryptLegacyDraftMetadata(SECRET, sealed), { salt, hash });
  assert.equal(migrated.prepare('SELECT code_hash FROM accounts WHERE id=?').get(account.accountId).code_hash, accessCodeDigest(SECRET, account.code));
  assert.equal(migrated.prepare('SELECT revision FROM account_profiles WHERE account_id=?').get(account.accountId).revision, 5);
  assert.equal(migrated.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n, 1);
  migrated.close();
  const f = await fixture(t, { dbPath });
  assert.deepEqual((await f.request('/api/session', { cookie: `life_session=${token}` })).data.user, { id: account.accountId, legacyDraft: { salt, hash } });
  assert.equal((await f.login(account.code)).status, 200);
  await f.close();
  rmSync(dir, { recursive: true, force: true });
});

test('a rotated code can still log in when old optional draft metadata cannot decrypt', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'life-weeks-lost-secret-'));
  const dbPath = join(dir, 'users.sqlite');
  const old = new DatabaseSync(dbPath);
  old.exec('CREATE TABLE users(email TEXT PRIMARY KEY); CREATE TABLE profiles(email TEXT PRIMARY KEY,data TEXT,revision INTEGER);');
  old.prepare('INSERT INTO users(email) VALUES(?)').run('alice@example.com');
  old.prepare('INSERT INTO profiles(email,data,revision) VALUES(?,?,?)').run('alice@example.com', JSON.stringify(profile), 3);
  old.close();
  const original = openDatabase(dbPath, { authSecret: SECRET });
  const bound = bindLegacyAccount(original, 'alice@example.com', SECRET);
  original.close();
  const changed = openDatabase(dbPath, { authSecret: OTHER_SECRET });
  const replacement = rotateAccount(changed, bound.accountId, OTHER_SECRET);
  changed.close();
  const f = await fixture(t, { dbPath, authSecret: OTHER_SECRET });
  const login = await f.login(replacement.code);
  assert.equal(login.status, 200);
  assert.deepEqual(login.data.user, { id: bound.accountId });
  assert.deepEqual((await f.request('/api/session', { cookie: login.cookie })).data.user, { id: bound.accountId });
  assert.equal((await f.request('/api/profile', { cookie: login.cookie })).data.revision, 3);
  await f.close();
  rmSync(dir, { recursive: true, force: true });
});

test('account and profile survive a restart with the same secret', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'life-weeks-code-restart-'));
  const dbPath = join(dir, 'users.sqlite');
  const first = await fixture(t, { dbPath });
  const account = first.create();
  const login = await first.login(account.code);
  await first.request('/api/profile', { method: 'PUT', cookie: login.cookie, body: { profile, revision: 0 } });
  await first.close();
  const second = await fixture(t, { dbPath });
  const nextLogin = await second.login(account.code);
  assert.equal(nextLogin.status, 200);
  assert.equal((await second.request('/api/profile', { cookie: nextLogin.cookie })).data.profile.notes['1990-01-01:2025-01-01'], '今天很好');
  await second.close();
  rmSync(dir, { recursive: true, force: true });
});

test('a slow profile write cannot use a session revoked by rotation', async (t) => {
  const f = await fixture(t);
  const account = f.create();
  const login = await f.login(account.code);
  await f.request('/api/profile', { method: 'PUT', cookie: login.cookie, body: { profile, revision: 0 } });
  const changed = { ...profile, notes: { ...profile.notes, '1990-01-01:2025-01-01': 'should not be saved' } };
  const held = heldProfilePut(f, login.cookie, { profile: changed, revision: 1 });
  await held.started;
  const replacement = f.rotate(account.accountId);
  held.finish();
  assert.equal((await held.result).status, 401);
  const newLogin = await f.login(replacement.code);
  const loaded = await f.request('/api/profile', { cookie: newLogin.cookie });
  assert.equal(loaded.data.revision, 1);
  assert.equal(loaded.data.profile.notes['1990-01-01:2025-01-01'], '今天很好');
});

test('simultaneous first profile writes return one success and one 409', async (t) => {
  const f = await fixture(t);
  const login = await f.login(f.create().code);
  const first = heldProfilePut(f, login.cookie, { profile: { ...profile, guide: { ...profile.guide, goal: 'first' } }, revision: 0 });
  const second = heldProfilePut(f, login.cookie, { profile: { ...profile, guide: { ...profile.guide, goal: 'second' } }, revision: 0 });
  await Promise.all([first.started, second.started]);
  first.finish(); second.finish();
  const responses = await Promise.all([first.result, second.result]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.deepEqual(responses.find((response) => response.status === 409).data, responses.find((response) => response.status === 200).data);
});

test('admin CLI create and rotate emit one code with stable account id', () => {
  const dir = mkdtempSync(join(tmpdir(), 'life-weeks-cli-'));
  try {
    const dbPath = join(dir, 'users.sqlite');
    const env = { ...process.env, DB_PATH: dbPath, AUTH_SECRET: SECRET };
    const command = (...args) => JSON.parse(execFileSync(process.execPath, ['scripts/invite.mjs', ...args], { cwd: process.cwd(), env, encoding: 'utf8' }).trim());
    const created = command('create');
    assert.match(created.accountId, /^[a-f0-9-]{36}$/);
    assert.match(created.inviteCode, /^[A-HJKMNP-Z2-9]{5}(?:-[A-HJKMNP-Z2-9]{5}){3}-[A-HJKMNP-Z2-9]{6}$/);
    const rotated = command('rotate', created.accountId);
    assert.equal(rotated.accountId, created.accountId);
    assert.notEqual(rotated.inviteCode, created.inviteCode);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('admin CLI bind migrates an OTP-era database before the API starts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'life-weeks-cli-bind-'));
  try {
    const dbPath = join(dir, 'users.sqlite');
    const old = new DatabaseSync(dbPath);
    old.exec(`CREATE TABLE users(email TEXT PRIMARY KEY);
      CREATE TABLE profiles(email TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL);
      CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,email TEXT,expires_at INTEGER NOT NULL);
      CREATE TABLE challenges(email TEXT PRIMARY KEY,code_hash TEXT,expires_at INTEGER,attempts INTEGER,issued_at INTEGER);`);
    old.prepare('INSERT INTO users(email) VALUES(?)').run('alice@example.com');
    old.prepare('INSERT INTO profiles(email,data,revision) VALUES(?,?,?)').run('alice@example.com', JSON.stringify(profile), 7);
    old.close();
    const output = execFileSync(process.execPath, ['scripts/invite.mjs', 'bind', 'Alice@Example.com'], {
      cwd: process.cwd(), env: { ...process.env, DB_PATH: dbPath, AUTH_SECRET: SECRET }, encoding: 'utf8',
    });
    const issued = JSON.parse(output.trim());
    assert.match(issued.inviteCode, /^[A-HJKMNP-Z2-9]{5}(?:-[A-HJKMNP-Z2-9]{5}){3}-[A-HJKMNP-Z2-9]{6}$/);
    const migrated = openDatabase(dbPath, { authSecret: SECRET });
    assert.equal(migrated.prepare('SELECT revision FROM account_profiles WHERE account_id=?').get(issued.accountId).revision, 7);
    assert.equal(migrated.prepare('SELECT COUNT(*) AS n FROM legacy_identity_links').get().n, 0);
    assert.equal(migrated.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN ('users','profiles','sessions','challenges')").get().n, 0);
    migrated.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('APP_ORIGIN normalizes a trailing slash and rejects invalid production origins', () => {
  assert.equal(normalizeAppOrigin('https://Example.com:443/', { production: true }), 'https://example.com');
  for (const value of ['http://example.com', 'https://example.com/app', 'https://example.com/?next=1', 'https://user:password@example.com']) {
    assert.throws(() => normalizeAppOrigin(value, { production: true }));
  }
});
