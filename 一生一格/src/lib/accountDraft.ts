import type { ProfileData } from './profileStorage';

export type AccountDraft = { profile: ProfileData; revision: number; pending: boolean };
export type LegacyDraftProof = { salt: string; hash: string };

const LEGACY_DRAFT_PREFIX = 'life-in-weeks-account-draft-v1:';

function parseDraft(raw: string | null): AccountDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<AccountDraft>;
    return value?.profile?.version === 3 && typeof value.revision === 'number' && typeof value.pending === 'boolean'
      ? value as AccountDraft : null;
  } catch { return null; }
}

function key(accountId: string) { return `life-in-weeks-account-draft-v2:${encodeURIComponent(accountId)}`; }
function skipKey(accountId: string) { return `life-in-weeks-skip-local-import-v2:${encodeURIComponent(accountId)}`; }

export function readAccountDraft(accountId: string): AccountDraft | null {
  try { return parseDraft(localStorage.getItem(key(accountId))); }
  catch { return null; }
}

/** Match one old local draft to a server-provided proof without revealing an old account name. */
export async function findLegacyAccountDraft(
  proof: LegacyDraftProof | undefined,
  store?: Pick<Storage, 'length' | 'key' | 'getItem'>,
  subtle: SubtleCrypto | null = globalThis.crypto?.subtle ?? null,
): Promise<{ storageKey: string; draft: AccountDraft } | null> {
  if (!proof || typeof proof.salt !== 'string' || !proof.salt || typeof proof.hash !== 'string' || !/^[a-f0-9]{64}$/.test(proof.hash) || !subtle) return null;
  try {
    const storage = store ?? localStorage;
    const encoder = new TextEncoder();
    for (let index = 0; index < storage.length; index++) {
      const storageKey = storage.key(index);
      if (!storageKey?.startsWith(LEGACY_DRAFT_PREFIX)) continue;
      const bytes = encoder.encode(`${proof.salt}:${storageKey}`);
      const digest = await subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      if (hash !== proof.hash) continue;
      const draft = parseDraft(storage.getItem(storageKey));
      return draft?.pending ? { storageKey, draft } : null;
    }
  } catch { /* Storage or Web Crypto may be unavailable. */ }
  return null;
}

export function clearLegacyAccountDraft(storageKey: string, store?: Pick<Storage, 'removeItem'>): void {
  if (!storageKey.startsWith(LEGACY_DRAFT_PREFIX)) return;
  try { (store ?? localStorage).removeItem(storageKey); } catch { /* The choice remains complete even if storage is unavailable. */ }
}

export function writeAccountDraft(accountId: string, draft: AccountDraft): boolean {
  try { localStorage.setItem(key(accountId), JSON.stringify(draft)); return true; }
  catch { return false; }
}

export function clearAccountDraft(accountId: string): void {
  try { localStorage.removeItem(key(accountId)); } catch { /* A failed removal cannot expose the draft in the app. */ }
}

export function skippedLocalImport(accountId: string): boolean {
  try { return localStorage.getItem(skipKey(accountId)) === '1'; } catch { return false; }
}

export function skipLocalImport(accountId: string): void {
  try { localStorage.setItem(skipKey(accountId), '1'); } catch { /* Another login may show the question again. */ }
}
