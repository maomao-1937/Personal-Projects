import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { encryptLegacyDraftMetadata } from './legacyDrafts.mjs';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{26}$/;

function digest(secret, scope, value) {
  return createHmac('sha256', secret).update(`${scope}:${value}`).digest('hex');
}

export function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

export const legacyEmailDigest = (secret, email) => digest(secret, 'legacy-email', email);
export const sessionDigest = (secret, token) => digest(secret, 'session', token);

export function normalizeAccessCode(value) {
  if (typeof value !== 'string' || value.length > 80) return null;
  const normalized = value.replace(/[\s-]/g, '').toUpperCase();
  return CODE_PATTERN.test(normalized) ? normalized : null;
}

export function accessCodeDigest(secret, code) {
  const normalized = normalizeAccessCode(code);
  return normalized ? digest(secret, 'access-code', normalized) : null;
}

function freshCode() {
  // 31 choices over 26 positions yield about 128.8 bits of entropy.
  const raw = Array.from({ length: 26 }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join('');
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}-${raw.slice(20)}`;
}

export function createAccount(db, secret, now = Date.now()) {
  const accountId = randomUUID();
  const code = freshCode();
  db.prepare('INSERT INTO accounts(id,code_hash,created_at,code_issued_at) VALUES(?,?,?,?)').run(
    accountId, accessCodeDigest(secret, code), now, now,
  );
  return { accountId, code };
}

export function bindLegacyAccount(db, email, secret, now = Date.now()) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error('旧邮箱格式不正确');
  const emailHash = legacyEmailDigest(secret, normalized);
  const code = freshCode();
  const salt = randomBytes(16).toString('hex');
  const oldDraftKey = `life-in-weeks-account-draft-v1:${encodeURIComponent(normalized)}`;
  const draftHash = createHash('sha256').update(`${salt}:${oldDraftKey}`).digest('hex');
  const sealed = encryptLegacyDraftMetadata(secret, { salt, hash: draftHash });
  db.exec('BEGIN IMMEDIATE');
  try {
    const link = db.prepare('SELECT account_id FROM legacy_identity_links WHERE email_hash=?').get(emailHash);
    if (!link) throw new Error('找不到尚未绑定邀请码的旧账号');
    const updated = db.prepare('UPDATE accounts SET code_hash=?,code_issued_at=?,legacy_draft_iv=?,legacy_draft_ciphertext=?,legacy_draft_tag=? WHERE id=? AND code_hash IS NULL').run(
      accessCodeDigest(secret, code), now, sealed.iv, sealed.ciphertext, sealed.tag, link.account_id,
    );
    if (!updated.changes) throw new Error('旧账号已绑定邀请码；请按账号 ID 轮换');
    db.prepare('DELETE FROM legacy_identity_links WHERE email_hash=?').run(emailHash);
    db.exec('COMMIT');
    return { accountId: link.account_id, code };
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
}

export function rotateAccount(db, accountId, secret, now = Date.now()) {
  if (typeof accountId !== 'string' || !/^[a-f0-9-]{36}$/i.test(accountId)) throw new Error('账号 ID 无效');
  const code = freshCode();
  db.exec('BEGIN IMMEDIATE');
  try {
    const updated = db.prepare('UPDATE accounts SET code_hash=?,code_issued_at=?,code_version=code_version+1 WHERE id=?').run(accessCodeDigest(secret, code), now, accountId);
    if (!updated.changes) throw new Error('找不到账号');
    db.prepare('DELETE FROM account_sessions WHERE account_id=?').run(accountId);
    db.exec('COMMIT');
    return { accountId, code };
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
}
