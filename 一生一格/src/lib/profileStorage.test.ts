import assert from 'node:assert/strict';
import test from 'node:test';
import { PROFILE_STORAGE_KEY, clearLocalProfile, readLocalGuideDraft, readLocalProfile, writeLocalGuideDraft, writeLocalProfile } from './profileStorage.ts';
import { createGoal } from './taskPlan.ts';

function memoryStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test('a complete profile is saved and restored as one versioned record', () => {
  const store = memoryStore();
  const savedAt = writeLocalProfile({
    birthDate: '2001-01-01',
    endDate: '2091-01-01',
    endMode: 'age',
    notes: { '2001-01-01:2026-09-21': '这一周做了设计' },
    mind: { selected: 'monkey', day: '2026-09-25' },
    guide: { goal: '完成设计稿', distraction: '刷视频', soundEnabled: false },
  }, store);
  assert.ok(savedAt);
  const loaded = readLocalProfile('2026-09-25', store);
  assert.equal(loaded?.version, 3);
  assert.equal(loaded?.endDate, '2091-01-01');
  assert.equal(loaded?.endMode, 'age');
  assert.equal(loaded?.notes['2001-01-01:2026-09-21'], '这一周做了设计');
  assert.equal(loaded?.mind.selected, 'monkey');
  assert.deepEqual(loaded?.guide, { goal: '完成设计稿', distraction: '刷视频', soundEnabled: false });
  assert.equal(loaded?.updatedAt, savedAt);
});

test('old date, notes and character data migrate without losing them', () => {
  const store = memoryStore({
    'life-in-weeks-v1': JSON.stringify({ birthDate: '2000-02-29', targetAge: 90, notes: { week: '保留的记录' } }),
    'life-in-weeks-mind-v1': JSON.stringify({ mode: 'delay', day: '2026-09-25' }),
  });
  const loaded = readLocalProfile('2026-09-25', store);
  assert.equal(loaded?.endDate, '2090-02-28');
  assert.equal(loaded?.notes.week, '保留的记录');
  assert.equal(loaded?.mind.selected, 'monkey');
  assert.deepEqual(loaded?.guide, { goal: '', distraction: '', soundEnabled: true });
  assert.ok(loaded);
  assert.ok(writeLocalProfile(loaded, store));
  assert.equal(store.values.has('life-in-weeks-v1'), false);
  assert.equal(store.values.has('life-in-weeks-mind-v1'), false);
  assert.equal(store.values.has(PROFILE_STORAGE_KEY), true);
});

test('a previous day role resets while the rest of the profile remains', () => {
  const store = memoryStore();
  writeLocalProfile({ birthDate: '2001-01-01', endDate: '2091-01-01', endMode: 'age', notes: {}, mind: { selected: 'monster', day: '2026-09-24' }, guide: { goal: '写论文', distraction: '聊天', soundEnabled: true } }, store);
  const loaded = readLocalProfile('2026-09-25', store);
  assert.deepEqual(loaded?.mind, { selected: 'rational', day: '2026-09-25' });
  assert.equal(loaded?.birthDate, '2001-01-01');
  assert.equal(loaded?.guide.goal, '写论文');
});

test('a v2 profile keeps its dates and notes when upgraded to v3', () => {
  const store = memoryStore({
    'life-in-weeks-profile-v2': JSON.stringify({ version: 2, birthDate: '2000-01-01', endDate: '2082-06-15', notes: { week: '保留' }, mind: { selected: 'rational', day: '2026-09-25' } }),
  });
  const loaded = readLocalProfile('2026-09-25', store);
  assert.equal(loaded?.endMode, 'date');
  assert.equal(loaded?.notes.week, '保留');
  assert.deepEqual(loaded?.guide, { goal: '', distraction: '', soundEnabled: true });
  assert.ok(loaded && writeLocalProfile(loaded, store));
  assert.equal(store.values.has('life-in-weeks-profile-v2'), false);
});

test('a reminder draft survives before birth date setup and joins the personal profile', () => {
  const store = memoryStore();
  const guide = { goal: '整理简历', distraction: '刷视频', soundEnabled: false };
  assert.equal(writeLocalGuideDraft(guide, store), true);
  assert.deepEqual(readLocalGuideDraft(store), guide);
  assert.ok(writeLocalProfile({ birthDate: '2001-01-01', endDate: '2091-01-01', endMode: 'age', notes: {}, mind: { selected: 'rational', day: '2026-09-25' }, guide }, store));
  assert.equal(readLocalGuideDraft(store), null);
  assert.deepEqual(readLocalProfile('2026-09-25', store)?.guide, guide);
});

test('a failed write is reported and does not clear previous data', () => {
  const store = memoryStore({ 'life-in-weeks-v1': 'old-data' });
  const failingStore = { ...store, setItem: () => { throw new Error('Storage unavailable'); } };
  const result = writeLocalProfile({ birthDate: '2001-01-01', endDate: '2091-01-01', endMode: 'age', notes: {}, mind: { selected: 'rational', day: '2026-09-25' }, guide: { goal: '', distraction: '', soundEnabled: true } }, failingStore);
  assert.equal(result, null);
  assert.equal(store.values.get('life-in-weeks-v1'), 'old-data');
});

test('clear removes current and old keys together', () => {
  const store = memoryStore({ [PROFILE_STORAGE_KEY]: 'new', 'life-in-weeks-profile-v2': 'previous', 'life-in-weeks-v1': 'old', 'life-in-weeks-mind-v1': 'old-role', 'life-in-weeks-guide-draft-v1': 'draft' });
  assert.equal(clearLocalProfile(store), true);
  assert.equal(store.values.size, 0);
});

test('old profiles default to no goals and a configured calendar', () => {
  const store = memoryStore();
  writeLocalProfile({ birthDate: '2001-01-01', endDate: '2091-01-01', endMode: 'age', notes: {}, mind: { selected: 'rational', day: '2026-10-03' }, guide: { goal: '', distraction: '', soundEnabled: true } }, store);
  const loaded = readLocalProfile('2026-10-03', store);
  assert.deepEqual(loaded?.goals, []);
  assert.equal(loaded?.calendarConfigured, true);
});

test('goals with completion, feedback and rescheduling survive a local profile write', () => {
  const goal = createGoal({ title: '准备面试', kind: 'interview', context: '设计师', deadline: '2026-10-17', estimatedMinutes: 35, frequency: 'daily' }, '2026-10-03');
  goal.actions[0].completedAt = '2026-10-03T09:00:00.000Z';
  goal.actions[1].feedback = 'busy';
  goal.actions[1].scheduledDate = '2026-10-09';
  goal.actions[1].time = '19:30';
  const store = memoryStore();
  writeLocalProfile({ birthDate: '2001-01-01', endDate: '2091-01-01', endMode: 'age', notes: { week: '保留' }, mind: { selected: 'rational', day: '2026-10-03' }, guide: { goal: '', distraction: '', soundEnabled: true }, goals: [goal], calendarConfigured: false }, store);
  const loaded = readLocalProfile('2026-10-03', store);
  assert.deepEqual(loaded?.goals, [goal]);
  assert.equal(loaded?.calendarConfigured, false);
  assert.equal(loaded?.notes.week, '保留');
  assert.ok(loaded && writeLocalProfile(loaded, store));
  assert.deepEqual(readLocalProfile('2026-10-03', store)?.goals, [goal]);
  assert.equal(readLocalProfile('2026-10-03', store)?.calendarConfigured, false);
});

test('damaged goals never discard a readable calendar, and only false disables its configured flag', () => {
  const base = { version: 3, birthDate: '2001-01-01', endDate: '2091-01-01', endMode: 'age', notes: { week: '保留' }, mind: { selected: 'rational', day: '2026-10-03' }, guide: { goal: '', distraction: '', soundEnabled: true } };
  for (const goals of [null, 'damaged', [{ id: 'incomplete' }], [null]]) {
    const loaded = readLocalProfile('2026-10-03', memoryStore({ [PROFILE_STORAGE_KEY]: JSON.stringify({ ...base, goals, calendarConfigured: 'damaged' }) }));
    assert.equal(loaded?.birthDate, base.birthDate);
    assert.equal(loaded?.notes.week, '保留');
    assert.deepEqual(loaded?.goals, []);
    assert.equal(loaded?.calendarConfigured, true);
  }
});
