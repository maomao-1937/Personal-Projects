import { backup, DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = resolve(process.env.DB_PATH ?? './data/life.sqlite');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = resolve(process.argv[2] ?? `./backups/life-${stamp}.sqlite`);

if (!existsSync(source)) throw new Error(`数据库不存在：${source}`);
if (target === source || existsSync(target)) throw new Error('备份目标与源文件相同，或目标文件已存在');
mkdirSync(dirname(target), { recursive: true });
const db = new DatabaseSync(source);
try {
  await backup(db, target);
  const copy = new DatabaseSync(target);
  try {
    if (copy.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('备份完整性检查失败');
  } finally { copy.close(); }
  console.log(`备份已完成并通过完整性检查：${target}`);
} finally { db.close(); }
