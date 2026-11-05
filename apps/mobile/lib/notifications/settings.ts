/**
 * What the person chose to be reminded about. Pure: the store (stores/notificationSettingsStore.ts)
 * only persists this shape and `migrateSettings` makes any saved value safe to use.
 * Times are minutes after local midnight.
 */
export type TimedKind = "song" | "words"
export type ToggleKind = "song" | "festival" | "words" | "streak" | "live"

export type NotificationSettings = {
  /** one switch for everything */
  master: boolean
  song: { on: boolean; at: number }
  festival: { on: boolean }
  words: { on: boolean; at: number }
  streak: { on: boolean }
  live: { on: boolean }
  quiet: { on: boolean; from: number; to: number }
}

/** Version of the saved shape (the persist `version` of the settings store). */
export const SETTINGS_VERSION = 1

/** No more than this many notifications on one local day. */
export const MAX_PER_DAY = 2

export const SONG_TIMES: readonly number[] = range(6 * 60, 10 * 60, 30)
export const WORDS_TIMES: readonly number[] = range(7 * 60, 20 * 60, 60)
export const QUIET_FROM_TIMES: readonly number[] = range(20 * 60, 23 * 60, 60)
export const QUIET_TO_TIMES: readonly number[] = range(5 * 60, 9 * 60, 60)

/** The time a kind fires when the person has no say: eve of a festival, learning streak. */
export const FESTIVAL_EVE_AT = 17 * 60
export const STREAK_AT = 20 * 60

export const DEFAULT_SETTINGS: NotificationSettings = {
  master: true,
  song: { on: true, at: 8 * 60 },
  festival: { on: true },
  words: { on: true, at: 18 * 60 },
  streak: { on: false },
  live: { on: true },
  quiet: { on: true, from: 21 * 60, to: 7 * 60 },
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = []
  for (let m = from; m <= to; m += step) out.push(m)
  return out
}

/** "8:00", "18:30": 24-hour clock, no zero before the hour. */
export function formatMinutes(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`
}

/** The choice nearest to `value`; `fallback` when value is not a number. */
function snap(value: unknown, options: readonly number[], fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  let best = options[0] ?? fallback
  for (const option of options) if (Math.abs(option - value) < Math.abs(best - value)) best = option
  return best
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/**
 * Turn anything that was saved (nothing, an older shape, a damaged value) into valid settings: unknown
 * keys are dropped, wrong types fall back to the default, a time outside its choices snaps to the nearest.
 * `version` is the version the value was saved with; every version up to SETTINGS_VERSION is read the same way.
 */
export function migrateSettings(saved: unknown, _version = 0): NotificationSettings {
  const d = DEFAULT_SETTINGS
  const s = obj(saved)
  const song = obj(s.song)
  const festival = obj(s.festival)
  const words = obj(s.words)
  const streak = obj(s.streak)
  const live = obj(s.live)
  const quiet = obj(s.quiet)
  return {
    master: bool(s.master, d.master),
    song: { on: bool(song.on, d.song.on), at: snap(song.at, SONG_TIMES, d.song.at) },
    festival: { on: bool(festival.on, d.festival.on) },
    words: { on: bool(words.on, d.words.on), at: snap(words.at, WORDS_TIMES, d.words.at) },
    streak: { on: bool(streak.on, d.streak.on) },
    live: { on: bool(live.on, d.live.on) },
    quiet: {
      on: bool(quiet.on, d.quiet.on),
      from: snap(quiet.from, QUIET_FROM_TIMES, d.quiet.from),
      to: snap(quiet.to, QUIET_TO_TIMES, d.quiet.to),
    },
  }
}

/** True when `kind` can send: the master switch and the kind's own switch are both on. */
export function kindEnabled(settings: NotificationSettings, kind: ToggleKind): boolean {
  return settings.master && settings[kind].on
}

/** True when at least one reminder is on (what the profile row says). */
export function anyEnabled(settings: NotificationSettings): boolean {
  return (["song", "festival", "words", "streak", "live"] as const).some((kind) => kindEnabled(settings, kind))
}

export function setKindOn(settings: NotificationSettings, kind: ToggleKind, on: boolean): NotificationSettings {
  return { ...settings, [kind]: { ...settings[kind], on } }
}

export function setKindTime(settings: NotificationSettings, kind: TimedKind, at: number): NotificationSettings {
  const options = kind === "song" ? SONG_TIMES : WORDS_TIMES
  return { ...settings, [kind]: { ...settings[kind], at: snap(at, options, settings[kind].at) } }
}

export function setQuiet(settings: NotificationSettings, patch: Partial<NotificationSettings["quiet"]>): NotificationSettings {
  const next = { ...settings.quiet, ...patch }
  return {
    ...settings,
    quiet: {
      on: next.on,
      from: snap(next.from, QUIET_FROM_TIMES, settings.quiet.from),
      to: snap(next.to, QUIET_TO_TIMES, settings.quiet.to),
    },
  }
}
