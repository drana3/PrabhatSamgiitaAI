import { t } from "@/lib/i18n"
/**
 * What the person chose to be reminded about. Pure: the store (stores/notificationSettingsStore.ts)
 * only persists this shape and `migrateSettings` makes any saved value safe to use.
 * Times are minutes after local midnight, any minute of the day (0 to 1439).
 */
export type TimedKind = "song" | "words"
export type ToggleKind = "song" | "festival" | "words" | "streak"

export type NotificationSettings = {
  /** one switch for everything */
  master: boolean
  /** every time is its own notification; sorted, no duplicates, 1 to MAX_TIMES.song entries */
  song: { on: boolean; times: number[] }
  festival: { on: boolean }
  words: { on: boolean; times: number[] }
  streak: { on: boolean }
}

/**
 * Version of the saved shape (the persist `version` of the settings store).
 * 1: one `at` per kind, `live`, `quiet`. 2: `times[]` per kind, no `live`, no `quiet`.
 */
export const SETTINGS_VERSION = 2

/** How many times a day the person can add for each kind. */
export const MAX_TIMES: Record<TimedKind, number> = { song: 3, words: 5 }

/** The time a kind fires when the person has no say: eve of a festival, learning streak. */
export const FESTIVAL_EVE_AT = 17 * 60
export const STREAK_AT = 20 * 60

export const DAY_MINUTES = 1440

export const DEFAULT_SETTINGS: NotificationSettings = {
  master: true,
  song: { on: true, times: [8 * 60] },
  festival: { on: true },
  words: { on: true, times: [18 * 60] },
  streak: { on: false },
}

/* ------------------------------------------------------------------ times */

/** A whole minute of the day: rounds, then wraps into 0 to 1439. */
export function wrapMinutes(minutes: number): number {
  return ((Math.round(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
}

/** Hour (0 to 23), minute (0 to 59) to minutes after midnight. Out-of-range values are clamped. */
export function toMinutes(hour: number, minute: number): number {
  const h = Math.min(23, Math.max(0, Math.round(hour)))
  const m = Math.min(59, Math.max(0, Math.round(minute)))
  return h * 60 + m
}

export type TimeParts = { hour24: number; minute: number }

/** The pieces a picker shows: hour (0 to 23) and minute (0 to 59). */
export function timeParts(minutes: number): TimeParts {
  const m = wrapMinutes(minutes)
  return { hour24: Math.floor(m / 60), minute: m % 60 }
}

/** The time as the app shows it everywhere: a 24-hour clock with two digits each, "07:45", "00:05", "18:00". */
export function formatMinutes(minutes: number): string {
  const { hour24, minute } = timeParts(minutes)
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

/** The live line of the picker: "Every day at 07:45". */
export function everyDayAt(minutes: number): string {
  return t("notif.picker.preview", { time: formatMinutes(minutes) })
}

/**
 * Anything that may be a list of times -> a valid one: whole minutes, wrapped into the day, sorted,
 * without duplicates, at most `max`. Non-numbers are dropped. May be empty (the caller decides what then).
 */
export function normalizeTimes(value: unknown, max: number): number[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<number>()
  for (const item of value) {
    if (typeof item === "number" && Number.isFinite(item)) seen.add(wrapMinutes(item))
  }
  return Array.from(seen)
    .sort((a, b) => a - b)
    .slice(0, max)
}

/** True when `minutes` is already one of `times`, ignoring the entry at `exceptIndex` (the one being edited). */
export function hasTime(times: readonly number[], minutes: number, exceptIndex?: number): boolean {
  const m = wrapMinutes(minutes)
  return times.some((t, i) => i !== exceptIndex && t === m)
}

/**
 * A free time to start a new entry on: the middle of the longest gap between the existing times,
 * counted between 6:00 and 22:00, rounded to a quarter of an hour. Never a time already in `times`
 * (unless all 1440 minutes are taken).
 */
export function suggestTime(times: readonly number[]): number {
  const from = 6 * 60
  const to = 22 * 60
  const inside = Array.from(new Set(times.map(wrapMinutes)))
    .filter((t) => t > from && t < to)
    .sort((a, b) => a - b)
  const points = [from, ...inside, to]
  let best = { gap: -1, start: from }
  for (let i = 0; i + 1 < points.length; i += 1) {
    const gap = points[i + 1]! - points[i]!
    if (gap > best.gap) best = { gap, start: points[i]! }
  }
  let candidate = wrapMinutes(Math.round((best.start + best.gap / 2) / 15) * 15)
  for (let i = 0; i < DAY_MINUTES && hasTime(times, candidate); i += 1) candidate = wrapMinutes(candidate + 15)
  return candidate
}

/* -------------------------------------------------------------- migration */

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** Version 2 `times`, or a version 1 `at` (any number, kept as that minute), else the default. */
function readTimes(saved: Record<string, unknown>, max: number, fallback: readonly number[]): number[] {
  const fromList = normalizeTimes(saved.times, max)
  if (fromList.length) return fromList
  const fromAt = normalizeTimes(typeof saved.at === "number" ? [saved.at] : [], max)
  return fromAt.length ? fromAt : [...fallback]
}

/**
 * Turn anything that was saved (nothing, an older shape, a damaged value) into valid settings: unknown
 * keys are dropped (the old `live` and `quiet` among them), wrong types fall back to the default, a
 * version 1 `at` becomes `times: [at]`, a list of times is sorted, de-duplicated and cut to its limit,
 * and an empty list falls back to the default time. `version` is the version the value was saved with;
 * every version up to SETTINGS_VERSION is read the same way.
 */
export function migrateSettings(saved: unknown, _version = 0): NotificationSettings {
  const d = DEFAULT_SETTINGS
  const s = obj(saved)
  const song = obj(s.song)
  const festival = obj(s.festival)
  const words = obj(s.words)
  const streak = obj(s.streak)
  return {
    master: bool(s.master, d.master),
    song: { on: bool(song.on, d.song.on), times: readTimes(song, MAX_TIMES.song, d.song.times) },
    festival: { on: bool(festival.on, d.festival.on) },
    words: { on: bool(words.on, d.words.on), times: readTimes(words, MAX_TIMES.words, d.words.times) },
    streak: { on: bool(streak.on, d.streak.on) },
  }
}

/* ---------------------------------------------------------------- queries */

/** True when `kind` can send: the master switch and the kind's own switch are both on. */
export function kindEnabled(settings: NotificationSettings, kind: ToggleKind): boolean {
  return settings.master && settings[kind].on
}

/** True when at least one reminder is on (what the profile row says). */
export function anyEnabled(settings: NotificationSettings): boolean {
  return (["song", "festival", "words", "streak"] as const).some((kind) => kindEnabled(settings, kind))
}

export function canAddTime(settings: NotificationSettings, kind: TimedKind): boolean {
  return settings[kind].times.length < MAX_TIMES[kind]
}

/* ---------------------------------------------------------------- changes */

export function setKindOn(settings: NotificationSettings, kind: ToggleKind, on: boolean): NotificationSettings {
  return { ...settings, [kind]: { ...settings[kind], on } }
}

/**
 * Change the time at `index` to `minutes`. Ignored when `index` is not an entry, or when `minutes` is
 * already another entry (two notifications at one moment are one too many).
 */
export function setKindTime(settings: NotificationSettings, kind: TimedKind, index: number, minutes: number): NotificationSettings {
  const current = settings[kind].times
  if (!Number.isInteger(index) || index < 0 || index >= current.length) return settings
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || hasTime(current, minutes, index)) return settings
  const times = normalizeTimes(current.map((t, i) => (i === index ? minutes : t)), MAX_TIMES[kind])
  return { ...settings, [kind]: { ...settings[kind], times } }
}

/** Add a time. Ignored at the limit, or when `minutes` is already there. */
export function addKindTime(settings: NotificationSettings, kind: TimedKind, minutes: number): NotificationSettings {
  const current = settings[kind].times
  if (current.length >= MAX_TIMES[kind]) return settings
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || hasTime(current, minutes)) return settings
  return { ...settings, [kind]: { ...settings[kind], times: normalizeTimes([...current, minutes], MAX_TIMES[kind]) } }
}

/** Remove the time at `index`. Never removes the last one: a kind that is on keeps at least one time. */
export function removeKindTime(settings: NotificationSettings, kind: TimedKind, index: number): NotificationSettings {
  const current = settings[kind].times
  if (current.length <= 1 || !Number.isInteger(index) || index < 0 || index >= current.length) return settings
  return { ...settings, [kind]: { ...settings[kind], times: current.filter((_, i) => i !== index) } }
}
