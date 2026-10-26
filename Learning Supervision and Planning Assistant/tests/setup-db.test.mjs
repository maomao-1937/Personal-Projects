import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';

test('fresh SQLite setup applies migrations and repeated setup preserves tasks', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'study-planner-setup-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = join(directory, 'nested', 'study.db');
  function setup() {
    const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'db:setup'], {
      env: { ...process.env, DATABASE_URL: 'file:' + filename.replaceAll('\\', '/') },
      encoding: 'utf8', timeout: 60_000,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
  setup();
  let db = new Database(filename);
  try {
    assert.equal(db.prepare('SELECT count(*) AS n FROM _prisma_migrations').get().n, 4);
    db.prepare('INSERT INTO Task (id, title, updatedAt) VALUES (?, ?, ?)')
      .run('keep-task', '保留已有学习任务', new Date().toISOString());
  } finally { db.close(); }
  setup();
  db = new Database(filename);
  try {
    assert.equal(db.prepare('SELECT title FROM Task WHERE id = ?').get('keep-task').title, '保留已有学习任务');
  } finally { db.close(); }
});

test('the duration rename migration preserves existing pomodoro records', () => {
  const db = new Database(':memory:');
  const migrations = [
    '20260803015033_init_task',
    '20260803020641_add_pomodoro_session',
    '20260803023226_add_checkin',
  ];
  const sql = name => readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
  try {
    for (const migration of migrations) db.exec(sql(migration));
    db.prepare('INSERT INTO Task (id, title, updatedAt) VALUES (?, ?, ?)')
      .run('legacy-task', '原有任务', '2026-08-03T00:00:00.000Z');
    db.prepare('INSERT INTO PomodoroSession (id, phase, plannedMin, actualSec, taskId, finishedAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run('legacy-session', 'WORK', 25, 1500, 'legacy-task', '2026-08-03T00:25:00.000Z');
    db.exec(sql('20260803080912_rename_actual_sec_to_planned_sec'));
    assert.deepEqual(db.prepare('SELECT * FROM PomodoroSession').get(), {
      id: 'legacy-session', phase: 'WORK', plannedMin: 25, plannedSec: 1500,
      taskId: 'legacy-task', finishedAt: '2026-08-03T00:25:00.000Z',
    });
  } finally { db.close(); }
});
