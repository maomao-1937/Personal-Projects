import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { clearLegacyAccountDraft, findLegacyAccountDraft, type AccountDraft } from './accountDraft.ts';

const oldKey = 'life-in-weeks-account-draft-v1:alice%40example.com';
const otherKey = 'life-in-weeks-account-draft-v1:bob%40example.com';
const draft: AccountDraft = {
  profile: {
    version: 3,
    birthDate: '2000-01-01',
    endDate: '2090-01-01',
    endMode: 'age',
    notes: { '2000-01-01:2000-01-08': '待同步' },
    mind: { selected: 'rational', day: '2026-09-25' },
    guide: { goal: '', distraction: '', soundEnabled: false },
    updatedAt: '2026-09-25T00:00:00.000Z',
  },
  revision: 2,
  pending: true,
};

function proofFor(storageKey: string) {
  const salt = 'migration-test-salt';
  return { salt, hash: createHash('sha256').update(`${salt}:${storageKey}`).digest('hex') };
}

function memoryStore(entries: Record<string, string>) {
  const values = new Map(Object.entries(entries));
  const reads: string[] = [];
  return {
    reads,
    values,
    get length() { return values.size; },
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    getItem: (storageKey: string) => { reads.push(storageKey); return values.get(storageKey) ?? null; },
    removeItem: (storageKey: string) => { values.delete(storageKey); },
  };
}

test('a server proof reveals only the matching pending old draft', async () => {
  const store = memoryStore({
    'unrelated-key': JSON.stringify(draft),
    [otherKey]: JSON.stringify(draft),
    [oldKey]: JSON.stringify(draft),
  });
  const match = await findLegacyAccountDraft(proofFor(oldKey), store, globalThis.crypto.subtle);
  assert.equal(match?.storageKey, oldKey);
  assert.deepEqual(match?.draft, draft);
  assert.deepEqual(store.reads, [oldKey]);
});

test('old drafts are ignored without a valid proof or Web Crypto', async () => {
  const store = memoryStore({ [oldKey]: JSON.stringify(draft) });
  assert.equal(await findLegacyAccountDraft(proofFor(otherKey), store, globalThis.crypto.subtle), null);
  assert.equal(await findLegacyAccountDraft(proofFor(oldKey), store, null), null);
  assert.deepEqual(store.reads, []);
});

test('matching old records still need the original pending draft format', async () => {
  const store = memoryStore({ [oldKey]: JSON.stringify({ ...draft, pending: false }) });
  assert.equal(await findLegacyAccountDraft(proofFor(oldKey), store, globalThis.crypto.subtle), null);
  store.values.set(oldKey, JSON.stringify({ ...draft, profile: { version: 2 } }));
  assert.equal(await findLegacyAccountDraft(proofFor(oldKey), store, globalThis.crypto.subtle), null);
  store.values.set(oldKey, '{broken json');
  assert.equal(await findLegacyAccountDraft(proofFor(oldKey), store, globalThis.crypto.subtle), null);
});

test('cleanup only removes a legacy draft key', () => {
  const store = memoryStore({ [oldKey]: JSON.stringify(draft), 'unrelated-key': 'keep' });
  clearLegacyAccountDraft('unrelated-key', store);
  assert.equal(store.values.get('unrelated-key'), 'keep');
  clearLegacyAccountDraft(oldKey, store);
  assert.equal(store.values.has(oldKey), false);
});
