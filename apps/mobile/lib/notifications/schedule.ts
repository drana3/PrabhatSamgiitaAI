import { liveStatus, type LiveItem } from "@/lib/kirtan/live"
import type { WordCard } from "@/lib/learn/srs"
import type { LearningStreak } from "@/lib/learn/streak"
import type { AppNotification, NotificationKind } from "@/lib/notifications"
import {
  FESTIVAL_EVE_AT,
  MAX_PER_DAY,
  STREAK_AT,
  kindEnabled,
  type NotificationSettings,
} from "@/lib/notifications/settings"

/**
 * The scheduler. Pure: from the settings, the state of the app and `now` it returns the notifications
 * that should reach the person, each with a deterministic id so scheduling again replaces instead of
 * duplicating. Native scheduling (native.ts) and the inbox (what has fired) both read this one output.
 *
 * Rules, in the order they are applied:
 * 1. A kind that is off, or the master switch off, produces nothing.
 * 2. Quiet hours: a time inside them moves to the end of the quiet hours. Live Kiirtan reminders are
 *    exempt: the person asked for that exact moment, a shifted one would arrive after the start.
 * 3. At most 2 per local day. When there are more, the higher priority stays:
 *    live > festival > words > song > streak.
 * 4. Words are planned only when words are due at that time.
 */

const MIN = 60_000
const DAY_MS = 86_400_000

/** How far ahead notifications are scheduled. */
export const WINDOW_DAYS = 7
/** A live reminder arrives this long before the broadcast. */
export const LIVE_LEAD_MIN = 15

export type SongPick = {
  number: number
  title: string
  /** the day of the year the song was composed, when known: it makes the "composed on this day" text */
  composed?: { month: number; day: number; year: number }
}

export type FestivalEntry = { id: string; title: string; month: number; day: number; year: number }

export type PlanInput = {
  /** the clock, ms since epoch: what is already past counts as sent */
  now: number
  settings: NotificationSettings
  songs: readonly SongPick[]
  festivals: readonly FestivalEntry[]
  cards: Readonly<Record<string, WordCard>>
  streak: LearningStreak
  live: readonly LiveItem[]
  /** ids of the broadcasts the person asked to be reminded about */
  remindIds: readonly string[]
}

export type PlannedNotification = {
  /** "song:2026-11-05": kind and the day (or the thing) it is about. Never contains the time. */
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

/** Lower number wins a place on a crowded day. */
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

/** Move a time that falls inside quiet hours to the end of them; any other time stays. */
export function shiftOutOfQuiet(fireAt: number, quiet: NotificationSettings["quiet"]): number {
  if (!quiet.on || quiet.from === quiet.to) return fireAt
  const d = new Date(fireAt)
  const m = d.getHours() * 60 + d.getMinutes()
  const wraps = quiet.from > quiet.to
  const inside = wraps ? m >= quiet.from || m < quiet.to : m >= quiet.from && m < quiet.to
  if (!inside) return fireAt
  const day = startOfDay(fireAt)
  return atMinutes(m < quiet.to ? day : addDays(day, 1), quiet.to)
}

/* --------------------------------------------------------------- the kinds */

type Candidate = PlannedNotification & { exemptFromQuiet?: boolean }

function songCandidate(input: PlanInput, day: number): Candidate {
  const { songs, settings } = input
  const d = new Date(day)
  const fireAt = atMinutes(day, settings.song.at)
  const id = `song:${dateKey(day)}`
  const composed = songs.find((s) => s.composed && s.composed.month === d.getMonth() + 1 && s.composed.day === d.getDate())
  if (composed?.composed) {
    return {
      id,
      kind: "song",
      fireAt,
      title: "Song of the day",
      text: `${composed.title} was composed on this day in ${composed.composed.year}.`,
      target: `/song-v2/ps-${composed.number}`,
      coverNumber: composed.number,
    }
  }
  const pick = songs.length ? songs[dayNumber(day) % songs.length] : undefined
  if (pick) {
    return {
      id,
      kind: "song",
      fireAt,
      title: "Song of the day",
      text: `Start the day with ${pick.title}.`,
      target: `/song-v2/ps-${pick.number}`,
      coverNumber: pick.number,
    }
  }
  return { id, kind: "song", fireAt, title: "Song of the day", text: "Open today's song.", target: "/v2/today" }
}

function dueCount(cards: PlanInput["cards"], at: number): number {
  let n = 0
  for (const card of Object.values(cards)) if (card.status !== "new" && card.dueAt <= at) n += 1
  return n
}

function wordsCandidate(input: PlanInput, day: number): Candidate | null {
  const fireAt = atMinutes(day, input.settings.words.at)
  const n = dueCount(input.cards, fireAt)
  if (n === 0) return null
  return {
    id: `words:${dateKey(day)}`,
    kind: "words",
    fireAt,
    title: "Words to repeat",
    text: `${n === 1 ? "1 word is due." : `${n} words are due.`} It takes a minute.`,
    target: "/learn/words",
  }
}

function festivalCandidates(input: PlanInput, day: number): Candidate[] {
  const out: Candidate[] = []
  for (const f of input.festivals) {
    const eve = addDays(new Date(f.year, f.month - 1, f.day).getTime(), -1)
    if (eve !== day) continue
    out.push({
      id: `festival:${f.id}`,
      kind: "festival",
      fireAt: atMinutes(day, FESTIVAL_EVE_AT),
      title: "Festival tomorrow",
      text: `${f.title} is tomorrow. Its songs are ready.`,
      target: `/festival/${f.id}`,
    })
  }
  return out
}

/**
 * The streak reminder is planned only for the evening when it can still help: today when no word has
 * been reviewed yet, tomorrow when today is already safe. A streak shorter than 2 days is not a streak.
 */
function streakCandidate(input: PlanInput, day: number): Candidate | null {
  const { streak } = input
  if (streak.days < 2) return null
  const today = startOfDay(input.now)
  const ok = (day === today && !streak.reviewedToday) || (day === addDays(today, 1) && streak.reviewedToday)
  if (!ok) return null
  return {
    id: `streak:${dateKey(day)}`,
    kind: "streak",
    fireAt: atMinutes(day, STREAK_AT),
    title: "Learning streak",
    text: `${streak.days} days in a row. Keep it going.`,
    target: "/v2/learn",
  }
}

function liveCandidates(input: PlanInput): Candidate[] {
  const out: Candidate[] = []
  for (const id of new Set(input.remindIds)) {
    const item = input.live.find((l) => l.id === id)
    if (!item || liveStatus(item, input.now) === "ended") continue
    out.push({
      id: `live:${item.id}`,
      kind: "live",
      fireAt: item.startsAt - LIVE_LEAD_MIN * MIN,
      title: "Live Kiirtan",
      text: `Starts in ${LIVE_LEAD_MIN} minutes. ${item.title.trim().replace(/\.$/, "")}.`,
      target: `/kiirtan-live?id=${encodeURIComponent(item.id)}`,
      exemptFromQuiet: true,
    })
  }
  return out
}

/* ------------------------------------------------------------------- plan */

function byPriority(a: PlannedNotification, b: PlannedNotification): number {
  return PRIORITY[a.kind] - PRIORITY[b.kind] || a.fireAt - b.fireAt || a.id.localeCompare(b.id)
}

/**
 * Everything that falls in `(from, to]`, after quiet hours and the daily limit.
 *
 * The limit is judged per local day over the whole day: what is already past `input.now` counts as
 * sent and is judged among itself first, the rest of the day fills the places that are left.
 */
export function plan(input: PlanInput, from: number, to: number): PlannedNotification[] {
  const { settings } = input
  if (!settings.master || to <= from) return []

  const found: Candidate[] = []
  // one day before the window too: an evening time can be moved into the window by quiet hours
  for (let day = addDays(startOfDay(from), -1); day <= startOfDay(to); day = addDays(day, 1)) {
    if (kindEnabled(settings, "song")) found.push(songCandidate(input, day))
    if (kindEnabled(settings, "festival")) found.push(...festivalCandidates(input, day))
    if (kindEnabled(settings, "words")) {
      const words = wordsCandidate(input, day)
      if (words) found.push(words)
    }
    if (kindEnabled(settings, "streak")) {
      const streak = streakCandidate(input, day)
      if (streak) found.push(streak)
    }
  }
  if (kindEnabled(settings, "live")) found.push(...liveCandidates(input))

  const moved = found.map<PlannedNotification>(({ exemptFromQuiet, ...n }) => ({
    ...n,
    fireAt: exemptFromQuiet ? n.fireAt : shiftOutOfQuiet(n.fireAt, settings.quiet),
  }))

  const days = new Map<string, PlannedNotification[]>()
  for (const n of moved) {
    const key = dateKey(n.fireAt)
    days.set(key, [...(days.get(key) ?? []), n])
  }

  const kept: PlannedNotification[] = []
  for (const list of days.values()) {
    const past = list.filter((n) => n.fireAt <= input.now).sort(byPriority).slice(0, MAX_PER_DAY)
    const future = list
      .filter((n) => n.fireAt > input.now)
      .sort(byPriority)
      .slice(0, Math.max(0, MAX_PER_DAY - past.length))
    kept.push(...past, ...future)
  }

  return kept.filter((n) => n.fireAt > from && n.fireAt <= to).sort((a, b) => a.fireAt - b.fireAt || byPriority(a, b))
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
