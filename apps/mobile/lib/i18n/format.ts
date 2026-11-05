import { LOCALE_TAGS, formatNumberFor, getActiveLanguage, translate, type Language } from "@/lib/i18n/core"

/**
 * Locale-aware numbers, dates, times and sizes. They follow the active language unless a language is
 * passed. `Intl` is used when the runtime has it (Hermes on SDK 54 does for NumberFormat and
 * DateTimeFormat); every helper falls back to a plain, locale-neutral string rather than throwing.
 */

export type DateInput = Date | number | string

function toDate(input: DateInput): Date | null {
  const date = input instanceof Date ? input : new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatNumber(
  value: number,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number },
  language: Language = getActiveLanguage(),
): string {
  return formatNumberFor(language, value, options)
}

export type DateStyle =
  | "short" // Nov 5 (en), 5 нояб. (ru)
  | "dayMonth" // 5 Nov: day first in every language
  | "dayMonthLong" // 5 November
  | "medium" // 5 Nov 2026
  | "long" // 5 November 2026
  | "weekday" // Thursday
  | "weekdayShort" // Thu
  | "monthYear" // November 2026

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "numeric", month: "short" },
  dayMonth: { day: "numeric", month: "short" },
  dayMonthLong: { day: "numeric", month: "long" },
  medium: { day: "numeric", month: "short", year: "numeric" },
  long: { day: "numeric", month: "long", year: "numeric" },
  weekday: { weekday: "long" },
  weekdayShort: { weekday: "short" },
  monthYear: { month: "long", year: "numeric" },
}

function isoFallback(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function intlFormat(
  language: Language,
  date: Date,
  options: Intl.DateTimeFormatOptions,
  tag?: string,
): string | null {
  try {
    if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat !== "function") return null
    return new Intl.DateTimeFormat(tag ?? LOCALE_TAGS[language], options).format(date)
  } catch {
    return null
  }
}

export function formatDate(
  input: DateInput,
  style: DateStyle = "medium",
  language: Language = getActiveLanguage(),
): string {
  const date = toDate(input)
  if (!date) return ""
  // English puts the month first by default; "dayMonth" asks for the day-first order ("12 Oct")
  const tag = (style === "dayMonth" || style === "dayMonthLong") && language === "en" ? "en-GB" : undefined
  return intlFormat(language, date, DATE_OPTIONS[style], tag) ?? isoFallback(date)
}

/** Clock time in the language's own convention (12 or 24 hour). */
export function formatTime(input: DateInput, language: Language = getActiveLanguage()): string {
  const date = toDate(input)
  if (!date) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    intlFormat(language, date, { hour: "numeric", minute: "2-digit" }) ??
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

export function formatDateTime(input: DateInput, language: Language = getActiveLanguage()): string {
  const date = toDate(input)
  if (!date) return ""
  return `${formatDate(date, "short", language)}, ${formatTime(date, language)}`
}

/**
 * File size in decimal units, the way the OS settings pages show it: "0.4 MB", "16 MB", "1.2 GB".
 * Unit names are dictionary strings (`unit.kb`, `unit.mb`, `unit.gb`) so Russian reads "МБ".
 */
export function formatBytes(bytes: number | null | undefined, language: Language = getActiveLanguage()): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return `0 ${translate(language, "unit.mb")}`
  const mb = bytes / 1_000_000
  if (mb < 0.1) return `<${formatNumberFor(language, 0.1, { maximumFractionDigits: 1 })} ${translate(language, "unit.mb")}`
  if (mb < 1000) {
    const digits = mb < 10 ? 1 : 0
    return `${formatNumberFor(language, mb, { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${translate(language, "unit.mb")}`
  }
  return `${formatNumberFor(language, mb / 1000, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} ${translate(language, "unit.gb")}`
}
