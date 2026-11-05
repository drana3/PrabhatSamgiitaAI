import { t } from "@/lib/i18n"
import type { WordCard } from "@/lib/learn/srs"
import type { LearningStreak } from "@/lib/learn/streak"
import type { AppNotification, NotificationKind } from "@/lib/notifications"
import { FESTIVAL_EVE_AT, STREAK_AT, kindEnabled, type NotificationSettings } from "@/lib/notifications/settings"

/**
 * The scheduler. Pure: from the settings, the state of the app and `now` it returns the notifications
 * that should reach the person, each with a deterministic id so scheduling again replaces instead of
 * duplicating. Native scheduling (native.ts) and the inbox (what has fired) both read this one output.
 *
 * Rules:
 * 1. A kind that is off, or the master switch off, produces nothing.
 * 2. Every time the person chose is its own notification, at exactly that minute. There is no quiet
 *    window and no daily limit: the person's own times are the limit (at most 3 song times and 5 word
 *    times a day, see settings.ts).
 * 3. Words are planned only when words are due at that time.
 * 4. The phone holds only so many pending notifications (iOS 64): `capForPlatform` keeps the soonest.
 */

const DAY_MS = 86_400_000

/** How far ahead notifications are scheduled. */
export const WINDOW_DAYS = 7
/** iOS keeps at most 64 pending local notifications; stay below it. The app refills the rest when it runs. */
export const MAX_PENDING = 60

export type SongPick = {
  number: number
  title: string
  /** the day of the year the song was composed, when known: it makes the "composed on this day" text */
  composed?: { month: number; day: number; year: number }
}

export type FestivalEntry = { id: string; title: string; month: number; day: number; year: number }

export type PlanInput = {
  /** the clock, ms since epoch (the streak reminder depends on whether today is still ahead) */
  now: number
  settings: NotificationSettings
  songs: readonly SongPick[]
  festivals: readonly FestivalEntry[]
  cards: Readonly<Record<string, WordCard>>
  streak: LearningStreak
}

export type PlannedNotification = {
  /**
   * "song:2026-11-05@0745": kind, the day and (for a time the person chose) that time. Stable: the same
   * time on the same day always has the same id, so scheduling again replaces instead of duplicating.
   */
  id: string
  kind: NotificationKind
  /** when it should arrive, ms since epoch */
  fireAt: number
  title: string
  text: string
  /** an app route */
  target: string
  coverNumber?: number
}

/** Order of notifications that fire at the same minute (lower number first). `live` is only an inbox kind now. */
export const PRIORITY: Record<NotificationKind, number> = {
  live: 0,
  festival: 1,
  words: 2,
  song: 3,
  streak: 4,
  story: 5,
  upload: 5,
  announcement: 5,
}

/* ------------------------------------------------------------------ dates */

export function startOfDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function addDays(dayStartMs: number, days: number): number {
  const d = new Date(dayStartMs)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime()
}

function atMinutes(dayStartMs: number, minutes: number): number {
  const d = new Date(dayStartMs)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minutes / 60), minutes % 60).getTime()
}

/** "2026-11-05" in local time. */
export function dateKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function dayNumber(ms: number): number {
  const d = new Date(ms)
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS)
}

/** "0745": the time in an id. */
function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}${String(minutes % 60).padStart(2, "0")}`
}

/* --------------------------------------------------------------- the kinds */

function songCandidates(input: PlanInput, day: number): PlannedNotification[] {
  const { songs, settings } = input
  const d = new Date(day)
  const composed = songs.find((s) => s.composed && s.composed.month === d.getMonth() + 1 && s.composed.day === d.getDate())
  const pick = songs.length ? songs[dayNumber(day) % songs.length] : undefined
  const base: Pick<PlannedNotification, "kind" | "title" | "text" | "target" | "coverNumber"> = composed?.composed
    ? {
        kind: "song",
        title: t("notif.song"),
        text: t("notif.item.song.composed", { title: composed.title, year: String(composed.composed.year) }),
        target: `/song-v2/ps-${composed.number}`,
        coverNumber: composed.number,
      }
    : pick
      ? {
          kind: "song",
          title: t("notif.song"),
          text: t("notif.item.song.pick", { title: pick.title }),
          target: `/song-v2/ps-${pick.number}`,
          coverNumber: pick.number,
        }
      : { kind: "song", title: t("notif.song"), text: t("notif.item.song.open"), target: "/v2/today" }
  return settings.song.times.map((at) => ({ ...base, id: `song:${dateKey(day)}@${hhmm(at)}`, fireAt: atMinutes(day, at) }))
}

function dueCount(cards: PlanInput["cards"], at: number): number {
  let n = 0
  for (const card of Object.values(cards)) if (card.status !== "new" && card.dueAt <= at) n += 1
  return n
}

function wordsCandidates(input: PlanInput, day: number): PlannedNotification[] {
  const out: PlannedNotification[] = []
  for (const at of input.settings.words.times) {
    const fireAt = atMinutes(day, at)
    const n = dueCount(input.cards, fireAt)
    if (n === 0) continue
    out.push({
      id: `words:${dateKey(day)}@${hhmm(at)}`,
      kind: "words",
      fireAt,
      title: t("notif.words"),
      text: t("notif.item.words", { count: n }),
      target: "/learn/words",
    })
  }
  return out
}

function festivalCandidates(input: PlanInput, day: number): PlannedNotification[] {
  const out: PlannedNotification[] = []
  for (const f of input.festivals) {
    const eve = addDays(new Date(f.year, f.month - 1, f.day).getTime(), -1)
    if (eve !== day) continue
    out.push({
      id: `festival:${f.id}`,
      kind: "festival",
      fireAt: atMinutes(day, FESTIVAL_EVE_AT),
      title: t("notif.item.festival.title"),
      text: t("notif.item.festival.text", { title: f.title }),
      target: `/festival/${f.id}`,
    })
  }
  return out
}

/**
 * The streak reminder is planned only for the evening when it can still help: today when no word has
 * been reviewed yet, tomorrow when today is already safe. A streak shorter than 2 days is not a streak.
 */
function streakCandidate(input: PlanInput, day: number): PlannedNotification | null {
  const { streak } = input
  if (streak.days < 2) return null
  const today = startOfDay(input.now)
  const ok = (day === today && !streak.reviewedToday) || (day === addDays(today, 1) && streak.reviewedToday)
  if (!ok) return null
  return {
    id: `streak:${dateKey(day)}`,
    kind: "streak",
    fireAt: atMinutes(day, STREAK_AT),
    title: t("notif.streak"),
    text: t("notif.item.streak", { count: streak.days }),
    target: "/v2/learn",
  }
}

/* ------------------------------------------------------------------- plan */

function byTime(a: PlannedNotification, b: PlannedNotification): number {
  return a.fireAt - b.fireAt || PRIORITY[a.kind] - PRIORITY[b.kind] || a.id.localeCompare(b.id)
}

/** Everything that falls in `(from, to]`, in the order it fires. */
export function plan(input: PlanInput, from: number, to: number): PlannedNotification[] {
  const { settings } = input
  if (!settings.master || to <= from) return []

  const found: PlannedNotification[] = []
  for (let day = startOfDay(from); day <= startOfDay(to); day = addDays(day, 1)) {
    if (kindEnabled(settings, "song")) found.push(...songCandidates(input, day))
    if (kindEnabled(settings, "festival")) found.push(...festivalCandidates(input, day))
    if (kindEnabled(settings, "words")) found.push(...wordsCandidates(input, day))
    if (kindEnabled(settings, "streak")) {
      const streak = streakCandidate(input, day)
      if (streak) found.push(streak)
    }
  }

  return found.filter((n) => n.fireAt > from && n.fireAt <= to).sort(byTime)
}

/** The soonest `limit` of a plan: what the phone can hold. The rest is planned again when the app runs. */
export function capForPlatform(planned: readonly PlannedNotification[], limit = MAX_PENDING): PlannedNotification[] {
  return [...planned].sort(byTime).slice(0, Math.max(0, limit))
}

/** What to schedule on the phone: the next 7 days after `now`. */
export function scheduleNext7Days(input: PlanInput): PlannedNotification[] {
  return plan(input, input.now, input.now + WINDOW_DAYS * DAY_MS)
}

/** What has fired since `since` (and is due now): the inbox fills from this. */
export function firedSince(input: PlanInput, since: number): PlannedNotification[] {
  return plan(input, since, input.now)
}

/** The inbox item for a planned notification that fired. */
export function toInboxItem(n: PlannedNotification): AppNotification {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    text: n.text,
    target: n.target,
    firedAt: n.fireAt,
    ...(n.coverNumber != null ? { coverNumber: n.coverNumber } : {}),
  }
}

/**
 * Compare the notifications the phone already holds with the plan: cancel what is no longer planned,
 * schedule everything planned (an id that already exists is replaced, never duplicated).
 */
export function diffSchedule(
  existingIds: readonly string[],
  planned: readonly PlannedNotification[],
): { cancel: string[]; schedule: PlannedNotification[] } {
  const wanted = new Set(planned.map((n) => n.id))
  return { cancel: Array.from(new Set(existingIds)).filter((id) => !wanted.has(id)), schedule: [...planned] }
}
