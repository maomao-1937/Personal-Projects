import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { legacyEmailDigest, normalizeEmail } from './invites.mjs';
import { encryptLegacyDraftMetadata } from './legacyDrafts.mjs';

function hasTable(db, name) {
  return !!db.prepare('SELECT 1 FROM sqlite_master WHERE type=? AND name=?').get('table', name);
}

export function openDatabase(dbPath = ':memory:', { authSecret } = {}) {
  if (!authSecret || String(authSecret).length < 32) throw new Error('数据库需要至少 32 字符的 AUTH_SECRET');
  if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;');
  let rewroteOldDraftMetadata = false;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        code_hash TEXT UNIQUE,
        code_version INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        code_issued_at INTEGER,
        legacy_draft_iv TEXT,
        legacy_draft_ciphertext TEXT,
        legacy_draft_tag TEXT
      );
      CREATE TABLE IF NOT EXISTS account_profiles (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id),
        data TEXT NOT NULL,
        revision INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS account_sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id),
        code_version INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS legacy_identity_links (
        email_hash TEXT PRIMARY KEY,
        account_id TEXT UNIQUE NOT NULL REFERENCES accounts(id)
      );
      CREATE TABLE IF NOT EXISTS code_login_attempts (
        id INTEGER PRIMARY KEY,
        code_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS code_login_attempts_time ON code_login_attempts(created_at);
    `);
    const accountColumns = db.prepare('PRAGMA table_info(accounts)').all();
    if (!accountColumns.some((column) => column.name === 'legacy_draft_iv')) db.exec('ALTER TABLE accounts ADD COLUMN legacy_draft_iv TEXT;');
    if (!accountColumns.some((column) => column.name === 'legacy_draft_ciphertext')) db.exec('ALTER TABLE accounts ADD COLUMN legacy_draft_ciphertext TEXT;');
    if (!accountColumns.some((column) => column.name === 'legacy_draft_tag')) db.exec('ALTER TABLE accounts ADD COLUMN legacy_draft_tag TEXT;');
    const hadSalt = accountColumns.some((column) => column.name === 'legacy_draft_salt');
    const hadHash = accountColumns.some((column) => column.name === 'legacy_draft_hash');
    if (hadSalt !== hadHash) throw new Error('旧草稿映射列不完整，迁移已中止');
    if (hadSalt) {
      rewroteOldDraftMetadata = true;
      const previous = db.prepare('SELECT id,legacy_draft_salt AS salt,legacy_draft_hash AS hash FROM accounts').all();
      for (const row of previous) {
        if (row.salt === null && row.hash === null) continue;
        const sealed = encryptLegacyDraftMetadata(authSecret, { salt: row.salt, hash: row.hash });
        db.prepare('UPDATE accounts SET legacy_draft_iv=?,legacy_draft_ciphertext=?,legacy_draft_tag=? WHERE id=?').run(
          sealed.iv, sealed.ciphertext, sealed.tag, row.id,
        );
      }
      db.exec('ALTER TABLE accounts DROP COLUMN legacy_draft_salt; ALTER TABLE accounts DROP COLUMN legacy_draft_hash;');
    }
    // A single transaction copies the old account data before dropping its email schema.
    if (hasTable(db, 'users')) {
      const emails = db.prepare(`SELECT email FROM users ${hasTable(db, 'profiles') ? 'UNION SELECT email FROM profiles' : ''}`).all();
      const oldProfile = hasTable(db, 'profiles') ? db.prepare('SELECT data,revision FROM profiles WHERE email=?') : null;
      const migratedAt = Date.now();
      for (const row of emails) {
        const email = normalizeEmail(row.email);
        if (!email) throw new Error('旧账号含无效邮箱，迁移已中止且原数据库未改动');
        const accountId = randomUUID();
        db.prepare('INSERT INTO accounts(id,code_hash,created_at,code_issued_at) VALUES(?,NULL,?,NULL)').run(accountId, migratedAt);
        db.prepare('INSERT INTO legacy_identity_links(email_hash,account_id) VALUES(?,?)').run(legacyEmailDigest(authSecret, email), accountId);
        const saved = oldProfile?.get(row.email);
        if (saved) db.prepare('INSERT INTO account_profiles(account_id,data,revision) VALUES(?,?,?)').run(accountId, saved.data, saved.revision);
      }
      db.exec(`
        DROP TABLE IF EXISTS profiles;
        DROP TABLE IF EXISTS sessions;
        DROP TABLE IF EXISTS challenges;
        DROP TABLE IF EXISTS requests;
        DROP TABLE IF EXISTS invite_tokens;
        DROP TABLE IF EXISTS auth_attempts;
        DROP TABLE users;
      `);
    }
    db.exec('COMMIT');
    if (rewroteOldDraftMetadata && dbPath !== ':memory:') {
      // Rebuild pages so dropped salt/hash bytes cannot remain in SQLite free space.
      db.exec('VACUUM');
      const checkpoint = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
      if (checkpoint.busy) throw new Error('旧草稿映射 WAL 清理未完成；请停止其他数据库连接后重试');
    }
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  return db;
}
