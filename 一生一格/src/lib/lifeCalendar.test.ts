import assert from 'node:assert/strict'
import test from 'node:test'
import { createLifeCalendar, createLifeCalendarToDate } from './lifeCalendar.ts'

const localDate = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day, 12)

test('each cell is a continuous seven-day span and age rows cover every cell once', () => {
  const calendar = createLifeCalendar('1996-05-20', 90, localDate(2026, 9, 25))

  assert.equal(calendar.rows.length, 90)
  assert.equal(calendar.rows.flat().length, calendar.totalCount)
  assert.deepEqual(calendar.rows.flat(), calendar.weeks)
  assert.ok(calendar.rows.every((row) => row.length === 52 || row.length === 53))

  calendar.weeks.forEach((week, index) => {
    const start = Date.parse(`${week.startDate}T00:00:00Z`)
    const end = Date.parse(`${week.endDate}T00:00:00Z`)
    assert.equal(end - start, 6 * 86_400_000)
    assert.equal(week.index, index)
    if (index > 0) {
      const priorStart = Date.parse(`${calendar.weeks[index - 1].startDate}T00:00:00Z`)
      assert.equal(start - priorStart, 7 * 86_400_000)
    }
  })
  assert.equal(calendar.pastCount + 1 + calendar.futureCount, calendar.totalCount)
  assert.equal(calendar.weeks[calendar.currentIndex].status, 'current')
})

test('leap day birthdays use February 28 in ordinary years', () => {
  const calendar = createLifeCalendar('2000-02-29', 4, localDate(2001, 2, 28))
  assert.equal(calendar.targetDate, '2004-02-29')
  assert.equal(calendar.rows[0].at(-1)?.startDate, '2001-02-27')
  assert.equal(calendar.rows[1][0].startDate, '2001-03-06')
  assert.equal(calendar.weeks[calendar.currentIndex].startDate, '2001-02-27')
  assert.equal(calendar.weeks[calendar.currentIndex].age, 0)
})

test('leap year and target boundary preserve a complete final week', () => {
  const during = createLifeCalendar('2024-01-01', 1, localDate(2024, 12, 31))
  assert.equal(during.targetDate, '2025-01-01')
  assert.equal(during.totalCount, 53)
  assert.equal(during.weeks.at(-1)?.startDate, '2024-12-30')
  assert.equal(during.weeks.at(-1)?.endDate, '2025-01-05')
  assert.equal(during.weeks.at(-1)?.daysBeforeTarget, 2)
  assert.equal(during.currentIndex, 52)

  const complete = createLifeCalendar('2024-01-01', 1, localDate(2025, 1, 1))
  assert.equal(complete.currentIndex, -1)
  assert.equal(complete.pastCount, 53)
  assert.equal(complete.futureCount, 0)
})

test('a future birth has no current or past week', () => {
  const beforeBirth = createLifeCalendar('2030-01-01', 90, localDate(2026, 9, 25))
  assert.equal(beforeBirth.currentIndex, -1)
  assert.equal(beforeBirth.pastCount, 0)
  assert.equal(beforeBirth.futureCount, beforeBirth.totalCount)

  const atBirth = createLifeCalendar('2030-01-01', 1, localDate(2030, 1, 1))
  assert.equal(atBirth.currentIndex, 0)
  assert.equal(atBirth.weeks[0].status, 'current')
})

test('invalid input is rejected rather than silently normalized', () => {
  assert.throws(() => createLifeCalendar('1900-02-29', 90), RangeError)
  assert.throws(() => createLifeCalendar('2024-04-31', 90), RangeError)
  assert.throws(() => createLifeCalendar('2024-01-01', 0), RangeError)
  assert.throws(() => createLifeCalendar('2024-01-01', 1.5), RangeError)
  assert.throws(() => createLifeCalendar('2024-01-01', 1, new Date('invalid')), RangeError)
  assert.doesNotThrow(() => createLifeCalendar('2000-02-29', 1))
})

test('an anniversary end date matches the age-based API exactly', () => {
  const now = localDate(2026, 9, 25)
  const byAge = createLifeCalendar('2000-02-29', 90, now)
  const byDate = createLifeCalendarToDate('2000-02-29', '2090-02-28', now)
  assert.deepEqual(byDate, byAge)
})

test('a non-anniversary end date leaves a partial final age row and week', () => {
  const calendar = createLifeCalendarToDate('2000-01-01', '2001-07-01', localDate(2001, 6, 30))
  assert.equal(calendar.targetDate, '2001-07-01')
  assert.equal(calendar.rows.length, 2)
  assert.equal(calendar.rows[0].length, 53)
  assert.equal(calendar.rows[1].length, 26)
  assert.equal(calendar.totalCount, 79)
  assert.equal(calendar.weeks.at(-1)?.startDate, '2001-06-30')
  assert.equal(calendar.weeks.at(-1)?.endDate, '2001-07-06')
  assert.equal(calendar.weeks.at(-1)?.daysBeforeTarget, 1)
  assert.equal(calendar.currentIndex, 78)

  const complete = createLifeCalendarToDate('2000-01-01', '2001-07-01', localDate(2001, 7, 1))
  assert.equal(complete.currentIndex, -1)
  assert.equal(complete.pastCount, 79)
})

test('an end date just after birth yields one clipped cell', () => {
  const calendar = createLifeCalendarToDate('2024-02-29', '2024-03-01', localDate(2024, 2, 29))
  assert.equal(calendar.totalCount, 1)
  assert.equal(calendar.rows.length, 1)
  assert.equal(calendar.weeks[0].daysBeforeTarget, 1)
  assert.equal(calendar.weeks[0].endDate, '2024-03-06')
})

test('end dates must be valid and later than birth', () => {
  assert.throws(() => createLifeCalendarToDate('2024-02-29', '2024-02-30'), /endDate/)
  assert.throws(() => createLifeCalendarToDate('2024-01-01', '2024-1-02'), /endDate/)
  assert.throws(() => createLifeCalendarToDate('2024-01-01', '2024-01-01'), /later than birthDate/)
  assert.throws(() => createLifeCalendarToDate('2024-01-02', '2024-01-01'), /later than birthDate/)
  assert.throws(() => createLifeCalendarToDate('1900-02-29', '2024-01-01'), /birthDate/)
})
