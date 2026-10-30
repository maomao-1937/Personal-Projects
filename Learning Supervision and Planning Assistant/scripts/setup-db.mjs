import 'dotenv/config';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';

const url = process.env.DATABASE_URL ?? 'file:./dev.db';
if (!url.startsWith('file:')) throw new Error('DATABASE_URL must use a file: SQLite URL');
const filename = resolve(url.slice('file:'.length));
// Prisma migrate deploy can fail on Windows when the SQLite file does not exist.
// Create only a missing file; existing databases are migrated without resetting data.
if (!existsSync(filename)) {
  mkdirSync(dirname(filename), { recursive: true });
  new Database(filename).close();
}

const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
