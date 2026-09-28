/** Calendar-only calculations: one cell always represents seven consecutive days. */

export type WeekStatus = 'past' | 'current' | 'future'

export interface LifeWeek {
  /** Zero-based index from the birth date. */
  index: number
  /** Age at the beginning of this week, starting at zero. */
  age: number
  /** One-based position within the age row. */
  weekOfAge: number
  /** First day of this seven-day cell, formatted YYYY-MM-DD. */
  startDate: string
  /** Seventh (inclusive) day of this cell, formatted YYYY-MM-DD. */
  endDate: string
  /** Days in this cell before the selected end date (1–7). */
  daysBeforeTarget: number
  status: WeekStatus
}

export interface LifeCalendar {
  /** One row per age containing a week start; the final row may be partial. */
  rows: LifeWeek[][]
  /** All cells in chronological order; row items reference these same objects. */
  weeks: LifeWeek[]
  pastCount: number
  /** Zero-based index of the current week; -1 before birth or on/after the end date. */
  currentIndex: number
  futureCount: number
  totalCount: number
  /** Exclusive end date of the represented lifetime. */
  targetDate: string
}

const DAY_MS = 86_400_000
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function dayNumber(year: number, month: number, day: number): number {
  const date = new Date(0)
  // setUTCFullYear handles years 0001–0099 correctly, unlike Date.UTC(year, ...).
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  return date.getTime() / DAY_MS
}

function dateParts(day: number): [year: number, month: number, date: number] {
  const value = new Date(day * DAY_MS)
  return [value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()]
}

function formatDay(day: number): string {
  const [year, month, date] = dateParts(day)
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`
}

type CivilDate = [year: number, month: number, day: number, ordinal: number]

function parseCivilDate(value: string, label: 'birthDate' | 'endDate'): CivilDate {
  const error = `${label} must be a valid YYYY-MM-DD date`
  const match = ISO_DATE.exec(value)
  if (!match) throw new RangeError(error)

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new RangeError(error)
  }

  const ordinal = dayNumber(year, month, day)
  const [actualYear, actualMonth, actualDay] = dateParts(ordinal)
  if (year !== actualYear || month !== actualMonth || day !== actualDay) {
    throw new RangeError(error)
  }
  return [year, month, day, ordinal]
}

function anniversaryDay(birthYear: number, month: number, day: number, age: number): number {
  const year = birthYear + age
  // People born on 29 February observe their birthday on 28 February in
  // non-leap years. A valid ordinary birthday never needs adjustment.
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const anniversaryDate = month === 2 && day === 29 && !isLeapYear ? 28 : day
  return dayNumber(year, month, anniversaryDate)
}

/** Build a calendar ending at `targetOrdinal` (exclusive). */
function buildLifeCalendar(
  birth: CivilDate,
  targetOrdinal: number,
  now: Date,
): LifeCalendar {
  const [birthYear, birthMonth, birthDay, birthOrdinal] = birth
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new RangeError('now must be a valid Date')
  }

  const today = dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate())
  const rows: LifeWeek[][] = [[]]
  const weeks: LifeWeek[] = []
  let pastCount = 0
  let currentIndex = -1
  let futureCount = 0
  let age = 0
  let nextBirthday = anniversaryDay(birthYear, birthMonth, birthDay, 1)

  for (let start = birthOrdinal; start < targetOrdinal; start += 7) {
    while (start >= nextBirthday) {
      age += 1
      rows.push([])
      nextBirthday = anniversaryDay(birthYear, birthMonth, birthDay, age + 1)
    }

    const index = weeks.length
    const endExclusive = Math.min(start + 7, targetOrdinal)
    const status: WeekStatus = today >= endExclusive
      ? 'past'
      : today >= start
        ? 'current'
        : 'future'

    if (status === 'past') pastCount += 1
    else if (status === 'current') currentIndex = index
    else futureCount += 1

    const week: LifeWeek = {
      index,
      age,
      weekOfAge: rows[age].length + 1,
      startDate: formatDay(start),
      endDate: formatDay(start + 6),
      daysBeforeTarget: endExclusive - start,
      status,
    }
    rows[age].push(week)
    weeks.push(week)
  }

  return {
    rows,
    weeks,
    pastCount,
    currentIndex,
    futureCount,
    totalCount: weeks.length,
    targetDate: formatDay(targetOrdinal),
  }
}

/**
 * Build a life calendar from a local civil birth date and target age. `now` is
 * read in the viewer's local timezone. Each cell is a real, uninterrupted
 * seven-day span; an age row owns cells whose *first* day falls before its
 * next birthday. The final cell may extend past `targetDate`;
 * `daysBeforeTarget` gives the number of its days inside the selected span.
 */
export function createLifeCalendar(
  birthDate: string,
  targetAge: number,
  now: Date = new Date(),
): LifeCalendar {
  const birth = parseCivilDate(birthDate, 'birthDate')
  const [birthYear, birthMonth, birthDay] = birth
  if (!Number.isSafeInteger(targetAge) || targetAge < 1 || birthYear + targetAge > 9999) {
    throw new RangeError('targetAge must be a positive whole number with a target year at most 9999')
  }
  const targetOrdinal = anniversaryDay(birthYear, birthMonth, birthDay, targetAge)
  return buildLifeCalendar(birth, targetOrdinal, now)
}

/**
 * Build a calendar ending at any civil date. `endDate` is exclusive, so a
 * matching birthday produces exactly the same cells as `createLifeCalendar`.
 */
export function createLifeCalendarToDate(
  birthDate: string,
  endDate: string,
  now: Date = new Date(),
): LifeCalendar {
  const birth = parseCivilDate(birthDate, 'birthDate')
  const [, , , endOrdinal] = parseCivilDate(endDate, 'endDate')
  if (endOrdinal <= birth[3]) {
    throw new RangeError('endDate must be later than birthDate')
  }
  return buildLifeCalendar(birth, endOrdinal, now)
}
