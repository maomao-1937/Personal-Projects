import { useCallback, useEffect, useRef, useState } from 'react';
import { ProfileConflictError, putRemoteProfile, type RemoteProfile } from './cloudApi';
import { clearAccountDraft, writeAccountDraft } from './accountDraft';
import type { ProfileChanges, ProfileData } from './profileStorage';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'conflict';

function fingerprint(profile: ProfileChanges | ProfileData | null | undefined) {
  if (!profile) return '';
  return JSON.stringify({ birthDate: profile.birthDate, endDate: profile.endDate, endMode: profile.endMode, notes: profile.notes, mind: profile.mind, guide: profile.guide });
}

export function useAccountSync(accountId: string | null, initialProfile: ProfileData | null, initialRevision: number, forceSyncInitial: boolean, changes: ProfileChanges, enabled: boolean) {
  const [status, setStatus] = useState<SyncStatus>(initialProfile && !forceSyncInitial ? 'synced' : 'idle');
  const [conflict, setConflict] = useState<RemoteProfile | null>(null);
  const revisionRef = useRef(initialRevision);
  const baselineRef = useRef(forceSyncInitial ? '' : fingerprint(initialProfile));
  const lastSyncedProfileRef = useRef(initialProfile);
  const queuedFingerprintRef = useRef('');
  const latestRef = useRef<ProfileData | null>(null);
  const inFlightRef = useRef(false);
  const conflictRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const changeFingerprint = fingerprint(changes);

  const flush = useCallback(async () => {
    if (!accountId || inFlightRef.current || conflictRef.current || !latestRef.current) return;
    const draft = latestRef.current;
    inFlightRef.current = true;
    let succeeded = false;
    try {
      const saved = await putRemoteProfile(draft, revisionRef.current);
      succeeded = true;
      revisionRef.current = saved.revision;
      baselineRef.current = fingerprint(draft);
      lastSyncedProfileRef.current = saved.profile;
      if (latestRef.current === draft) {
        if (saved.profile) writeAccountDraft(accountId, { profile: saved.profile, revision: saved.revision, pending: false });
        setStatus('synced');
      } else {
        const newest = latestRef.current;
        if (newest) writeAccountDraft(accountId, { profile: newest, revision: saved.revision, pending: true });
      }
    } catch (cause) {
      if (cause instanceof ProfileConflictError) {
        conflictRef.current = true;
        setConflict(cause.remote);
        setStatus('conflict');
      } else setStatus('error');
    } finally {
      inFlightRef.current = false;
      if (succeeded && !conflictRef.current && latestRef.current !== draft) window.setTimeout(() => void flush(), 0);
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId || !enabled) return;
    if (changeFingerprint === baselineRef.current && !inFlightRef.current) {
      latestRef.current = null;
      queuedFingerprintRef.current = changeFingerprint;
      if (lastSyncedProfileRef.current) writeAccountDraft(accountId, { profile: lastSyncedProfileRef.current, revision: revisionRef.current, pending: false });
      else clearAccountDraft(accountId);
      setStatus(lastSyncedProfileRef.current ? 'synced' : 'idle');
      return;
    }
    if (changeFingerprint !== queuedFingerprintRef.current) {
      queuedFingerprintRef.current = changeFingerprint;
      const draft: ProfileData = { ...changes, version: 3, updatedAt: new Date().toISOString() };
      latestRef.current = draft;
      const cached = writeAccountDraft(accountId, { profile: draft, revision: revisionRef.current, pending: true });
      setStatus(cached ? 'syncing' : 'error');
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void flush(), 650);
    return () => { if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; } };
  }, [accountId, enabled, changeFingerprint, flush]);

  useEffect(() => {
    if (!accountId) return;
    const retry = () => { if (!conflictRef.current && latestRef.current) void flush(); };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [accountId, flush]);

  function keepLocal() {
    if (!conflict) return;
    revisionRef.current = conflict.revision;
    conflictRef.current = false;
    setConflict(null);
    setStatus('syncing');
    void flush();
  }

  return { status, conflict, keepLocal, retry: () => void flush() };
}
