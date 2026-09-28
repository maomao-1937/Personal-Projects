export type MindRole = 'rational' | 'monkey' | 'monster';

export type MindSelection = { selected: MindRole; day: string };
export type MindGuide = { goal: string; distraction: string; soundEnabled: boolean };
export type EndMode = 'age' | 'date';

export type ProfileData = {
  version: 3;
  birthDate: string;
  endDate: string;
  endMode: EndMode;
  notes: Record<string, string>;
  mind: MindSelection;
  guide: MindGuide;
  updatedAt: string;
};

export type ProfileChanges = Pick<ProfileData, 'birthDate' | 'endDate' | 'endMode' | 'notes' | 'mind' | 'guide'>;

export const PROFILE_STORAGE_KEY = 'life-in-weeks-profile-v3';
const PREVIOUS_PROFILE_KEY = 'life-in-weeks-profile-v2';
const GUIDE_DRAFT_KEY = 'life-in-weeks-guide-draft-v1';
const LEGACY_CALENDAR_KEY = 'life-in-weeks-v1';
const LEGACY_MIND_KEY = 'life-in-weeks-mind-v1';

type LocalStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function validIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function anniversary(birthDate: string, years: number): string {
  const [birthYear, month, day] = birthDate.split('-').map(Number);
  const year = birthYear + years;
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const adjustedDay = month === 2 && day === 29 && !isLeapYear ? 28 : day;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(adjustedDay).padStart(2, '0')}`;
}

function isRole(value: unknown): value is MindRole {
  return value === 'rational' || value === 'monkey' || value === 'monster';
}

function normalizeNotes(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function normalizeMind(value: unknown, today: string): MindSelection {
  if (!value || typeof value !== 'object') return { selected: 'rational', day: today };
  const candidate = value as Partial<MindSelection> & { mode?: string };
  const selected = isRole(candidate.selected) ? candidate.selected : candidate.mode === 'delay' ? 'monkey' : 'rational';
  return candidate.day === today ? { selected, day: today } : { selected: 'rational', day: today };
}

function normalizeGuide(value: unknown): MindGuide {
  if (!value || typeof value !== 'object') return { goal: '', distraction: '', soundEnabled: true };
  const candidate = value as Partial<MindGuide>;
  return {
    goal: typeof candidate.goal === 'string' ? candidate.goal.slice(0, 80) : '',
    distraction: typeof candidate.distraction === 'string' ? candidate.distraction.slice(0, 60) : '',
    soundEnabled: candidate.soundEnabled !== false,
  };
}

/** Keep reminder text and mute preference while the calendar is still a demo. */
export function readLocalGuideDraft(store?: LocalStore): MindGuide | null {
  try {
    const raw = (store ?? localStorage).getItem(GUIDE_DRAFT_KEY);
    return raw ? normalizeGuide(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeLocalGuideDraft(guide: MindGuide, store?: LocalStore): boolean {
  try {
    const target = store ?? localStorage;
    const safe = normalizeGuide(guide);
    if (!safe.goal && !safe.distraction && safe.soundEnabled) target.removeItem(GUIDE_DRAFT_KEY);
    else target.setItem(GUIDE_DRAFT_KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}

function inferEndMode(birthDate: string, endDate: string): EndMode {
  const years = Number(endDate.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return years >= 1 && years <= 120 && anniversary(birthDate, years) === endDate ? 'age' : 'date';
}

function normalizeProfile(value: unknown, today: string, legacyMind: unknown): ProfileData | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ProfileData> & { targetAge?: number };
  if (!validIsoDate(candidate.birthDate)) return null;
  const endDate = validIsoDate(candidate.endDate) ? candidate.endDate
    : Number.isInteger(candidate.targetAge) && candidate.targetAge! >= 1 && candidate.targetAge! <= 120
      ? anniversary(candidate.birthDate, candidate.targetAge!) : null;
  if (!endDate || endDate <= candidate.birthDate || endDate > anniversary(candidate.birthDate, 120)) return null;
  return {
    version: 3,
    birthDate: candidate.birthDate,
    endDate,
    endMode: candidate.endMode === 'age' || candidate.endMode === 'date'
      ? candidate.endMode : inferEndMode(candidate.birthDate, endDate),
    notes: normalizeNotes(candidate.notes),
    mind: normalizeMind(candidate.mind ?? legacyMind, today),
    guide: normalizeGuide(candidate.guide),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : '',
  };
}

/** Read the current profile, or migrate v2 and earlier calendar records. */
export function readLocalProfile(today: string, store?: LocalStore): ProfileData | null {
  try {
    const target = store ?? localStorage;
    const current = target.getItem(PROFILE_STORAGE_KEY);
    if (current) {
      try {
        const parsed = normalizeProfile(JSON.parse(current), today, null);
        if (parsed) return parsed;
      } catch { /* The previous profile may still be readable. */ }
    }
    const previous = target.getItem(PREVIOUS_PROFILE_KEY);
    if (previous) {
      try {
        const parsed = normalizeProfile(JSON.parse(previous), today, null);
        if (parsed) return parsed;
      } catch { /* A v1 calendar may still be readable. */ }
    }
    const legacy = target.getItem(LEGACY_CALENDAR_KEY);
    if (!legacy) return null;
    const legacyMind = target.getItem(LEGACY_MIND_KEY);
    let parsedMind: unknown = null;
    if (legacyMind) {
      try { parsedMind = JSON.parse(legacyMind); } catch { /* Keep the calendar even if this entry is damaged. */ }
    }
    return normalizeProfile(JSON.parse(legacy), today, parsedMind);
  } catch {
    return null;
  }
}

/** Return a timestamp only after the complete profile was written successfully. */
export function writeLocalProfile(changes: ProfileChanges, store?: LocalStore): string | null {
  const updatedAt = new Date().toISOString();
  const profile: ProfileData = { ...changes, version: 3, updatedAt };
  try {
    const target = store ?? localStorage;
    target.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    // The old entries are removed only after the new profile is safely written.
    try {
      target.removeItem(LEGACY_CALENDAR_KEY);
      target.removeItem(LEGACY_MIND_KEY);
      target.removeItem(PREVIOUS_PROFILE_KEY);
      target.removeItem(GUIDE_DRAFT_KEY);
    } catch { /* A successful new write is still the source of truth. */ }
    return updatedAt;
  } catch {
    return null;
  }
}

export function clearLocalProfile(store?: LocalStore): boolean {
  try {
    const target = store ?? localStorage;
    target.removeItem(LEGACY_CALENDAR_KEY);
    target.removeItem(LEGACY_MIND_KEY);
    target.removeItem(PREVIOUS_PROFILE_KEY);
    target.removeItem(GUIDE_DRAFT_KEY);
    target.removeItem(PROFILE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
