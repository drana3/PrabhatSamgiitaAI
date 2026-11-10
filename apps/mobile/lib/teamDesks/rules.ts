import type { FlagAction, FlagItem, FlagStatus, TakedownAction, TakedownItem, WordField, WordItem } from "./types"

/**
 * Rules of the team desks, pure and free of React so a test can pin them (docs/team-desks.md).
 */

/** A reason the claimant or the uploader may be sent: 3 to 1000 characters, as the API. */
export const REASON_MIN = 3
export const REASON_MAX = 1000
export const NOTE_MAX = 1000

export function reasonProblem(raw: string): "short" | null {
  return raw.trim().length < REASON_MIN ? "short" : null
}

// ---------------------------------------------------------------- words

export const WORD_FIELDS: readonly WordField[] = ["instrument", "style", "mood", "language", "mantra"]

/** The filter row: every kind, or one. */
export type WordFilter = "all" | WordField
export const WORD_FILTERS: readonly WordFilter[] = ["all", ...WORD_FIELDS]

export function wordsOf(items: readonly WordItem[], filter: WordFilter): WordItem[] {
  return filter === "all" ? [...items] : items.filter((w) => w.field === filter)
}

export function countsByField(items: readonly WordItem[]): Record<WordFilter, number> {
  const counts: Record<WordFilter, number> = { all: items.length, instrument: 0, style: 0, mood: 0, language: 0, mantra: 0 }
  for (const item of items) counts[item.field] += 1
  return counts
}

/** The listed value the merge picker starts on: the one the word looks like, if it is on the list. */
export function suggestedTarget(item: Pick<WordItem, "similar_to" | "merge_targets">): string | null {
  return item.similar_to && item.merge_targets.some((t) => t.code === item.similar_to) ? item.similar_to : null
}

/** The listed value's name for the "looks like" hint, or the code when the list does not carry it. */
export function targetLabel(item: Pick<WordItem, "merge_targets">, code: string | null): string | null {
  if (!code) return null
  return item.merge_targets.find((t) => t.code === code)?.label ?? code
}

/** Merge targets that match what the team types in the picker's search (case and accents ignored). */
export function filterTargets<T extends { label: string; code: string }>(targets: readonly T[], query: string): T[] {
  const needle = plain(query)
  if (!needle) return [...targets]
  return targets.filter((t) => plain(t.label).includes(needle) || plain(t.code).includes(needle))
}

function plain(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

// ---------------------------------------------------------------- takedowns

export type TakedownTab = "waiting" | "down" | "waitingPeriod" | "finished"
export const TAKEDOWN_TABS: readonly TakedownTab[] = ["waiting", "down", "waitingPeriod", "finished"]

/** The statuses each tab asks the server for (the API takes a comma list). */
export const TAB_STATUSES: Record<TakedownTab, string> = {
  waiting: "new",
  down: "taken_down,counter_received",
  waitingPeriod: "forwarded",
  finished: "rejected,restored,closed",
}

/**
 * What the team can do with a request, in the order the buttons show. Follows the server's rules
 * (apps/api/app/services/takedowns.py; docs/takedown-process.md); the server checks again.
 *  - a new notice: take the recording down (needs a linked recording) or turn the request down;
 *  - a turned-down notice may still be taken down;
 *  - a new counter-notice: pass it on to the claimant (the waiting time starts);
 *  - a passed-on counter-notice: put the recording back, once the time has passed or the claimant withdrew;
 *  - anything not yet finished can be closed (the recording stays down).
 */
export function takedownActions(item: Pick<TakedownItem, "kind" | "status" | "recording_id" | "waiting_until">, now: Date = new Date()): TakedownAction[] {
  const out: TakedownAction[] = []
  if (item.kind === "notice") {
    if (item.status === "new" || item.status === "rejected") {
      if (!item.recording_id) out.push("link")
      else out.push("takeDown")
    }
    if (item.status === "new") out.push("reject")
    if (item.status === "taken_down" || item.status === "counter_received") out.push("close")
  } else {
    if (item.status === "new") out.push("forward")
    if (item.status === "forwarded") {
      out.push(waitIsOver(item.waiting_until, now) ? "restore" : "restoreWithdrawn")
      out.push("close")
    }
    if (item.status === "new") out.push("close")
  }
  return out
}

/** True when there is no waiting time left (or none was set). */
export function waitIsOver(waitingUntil: string | null, now: Date = new Date()): boolean {
  if (!waitingUntil) return true
  const end = Date.parse(waitingUntil)
  return Number.isNaN(end) || end <= now.getTime()
}

/** Actions that need a written reason before they are sent. */
export function needsReason(action: TakedownAction): boolean {
  return action === "reject" || action === "close"
}

/** The path of a recording's page, or null. The id is encoded; a missing id gives no link. */
export function recordingPath(id: string | null | undefined): string | null {
  return id ? `/recording/${encodeURIComponent(id)}` : null
}

// ---------------------------------------------------------------- play flags

export const FLAG_TABS: readonly FlagStatus[] = ["open", "cleared", "confirmed"]

/** What the team can do with a flagged day, by where it stands. */
export function flagActions(item: Pick<FlagItem, "status" | "confirmed_held">): FlagAction[] {
  // an open flag can carry a part that was confirmed earlier (a later surge on the same day): that part can be taken back too
  if (item.status === "open") return item.confirmed_held > 0 ? ["clear", "confirm", "unconfirm"] : ["clear", "confirm"]
  if (item.status === "cleared") return item.confirmed_held > 0 ? ["confirm", "unconfirm"] : ["confirm"]
  return ["unconfirm"]
}

/** Plays that stay out of the numbers for this day: the confirmed part, plus the suspected part while it is open. */
export function leftOut(item: Pick<FlagItem, "status" | "held" | "confirmed_held">): number {
  return item.confirmed_held + (item.status === "open" ? item.held : 0)
}

/** "10", "12.5": the usual daily plays, one decimal at most. */
export function baselineLabel(value: number): string {
  if (!Number.isFinite(value)) return "0"
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** The key of a flag in a list: one row per recording and day. */
export function flagKey(item: Pick<FlagItem, "recording_id" | "day">): string {
  return `${item.recording_id}:${item.day}`
}

/** A calendar day ("2026-11-10") as a local date at noon, so no time zone moves it to the day before. Null when it is not a day. */
export function localDay(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)
}
