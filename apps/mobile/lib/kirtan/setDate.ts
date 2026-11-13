/**
 * The approximate date of an event playlist: a YEAR and, when the person knows it, a MONTH. No first and last day.
 * The date can be left out. When it is given, the server files the playlist under the first of the month (or 1 January)
 * and keeps ordering by that (a playlist without a date goes last), so `firstDayOf` here gives a track the same fallback day. Pure: no React, no clock except the `now` that is passed.
 */

export const FIRST_EVENT_YEAR = 1900

/** The years to choose from, this year first, down to 1900. */
export function eventYears(now: Date = new Date()): number[] {
  const last = now.getUTCFullYear()
  const years: number[] = []
  for (let year = last; year >= FIRST_EVENT_YEAR; year -= 1) years.push(year)
  return years
}

/** The months that can be chosen in a year: all twelve, or only up to this month in the current year. */
export function monthsOf(year: number | null, now: Date = new Date()): number[] {
  const last = year !== null && year === now.getUTCFullYear() ? now.getUTCMonth() + 1 : 12
  return Array.from({ length: last }, (_, index) => index + 1)
}

export type EventDateError = "year" | "future" | null

/**
 * The date of a playlist is optional: no year is fine (a month without a year is ignored). A year that is given must be a
 * real one and not in the future; a month is only checked against the current year.
 */
export function checkEventDate(year: number | null, month: number | null, now: Date = new Date()): EventDateError {
  if (year === null) return null
  if (!Number.isInteger(year) || year < FIRST_EVENT_YEAR) return "year"
  const thisYear = now.getUTCFullYear()
  if (year > thisYear) return "future"
  if (month !== null && (month < 1 || month > 12)) return "year"
  if (year === thisYear && month !== null && month > now.getUTCMonth() + 1) return "future"
  return null
}

/** YYYY-MM-DD: the first of the month, or 1 January when the month is not known. Empty when there is no year. */
export function firstDayOf(year: number | null | undefined, month: number | null | undefined): string {
  if (year === null || year === undefined) return ""
  return `${String(year).padStart(4, "0")}-${String(month ?? 1).padStart(2, "0")}-01`
}

/** A year and month out of a YYYY-MM-DD day (an older playlist's first day). */
export function yearMonthOf(day: string | null | undefined): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})-\d{2}/.exec(day ?? "")
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null
}

/** "November 2026", or "2026" when the month is not known. `monthName` is the app's own month word. */
export function eventLabel(year: number | null | undefined, month: number | null | undefined, monthName: (month: number) => string): string {
  if (!year) return ""
  return month ? `${monthName(month)} ${year}` : String(year)
}
