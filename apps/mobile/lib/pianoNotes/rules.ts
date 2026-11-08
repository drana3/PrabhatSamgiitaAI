import { SA_NAMES, keyMidi } from "./keys"
import type { PianoDraft, PianoFailure, PianoHand, PianoLevel, PianoRow, PianoSheet, PianoStep } from "./types"

/** The same limits as the server (apps/api/app/schemas/piano_sheets.py): the phone says "too long" before it asks. */
export const MAX_ROWS = 24
export const MAX_STEPS_PER_ROW = 128
export const MAX_STEPS = 600
export const MAX_KEYS_PER_STEP = 6
export const MIN_KEY = -24
export const MAX_KEY = 36
export const MIN_SOUNDING_STEPS = 2
export const MAX_LABEL = 40
export const LINK_MAX = 300
export const NOTE_MAX = 300

export function sounding(rows: readonly PianoRow[]): number {
  return rows.reduce((total, row) => total + row.steps.filter((step) => step.k.length > 0).length, 0)
}

export function stepTotal(rows: readonly PianoRow[]): number {
  return rows.reduce((total, row) => total + row.steps.length, 0)
}

export function levelOf(rows: readonly PianoRow[]): PianoLevel {
  return rows.some((row) => row.hand === "left") ? "two_hands" : "one_finger"
}

/** What the phone checks before sending. Null = fine; the server checks again. */
export function validateDraft(draft: PianoDraft): PianoFailure | null {
  if (!SA_NAMES.includes(draft.saKey)) return "invalid"
  if (draft.rows.length === 0 || draft.rows.length > MAX_ROWS) return draft.rows.length === 0 ? "tooFew" : "tooLong"
  for (const row of draft.rows) {
    if (row.steps.length > MAX_STEPS_PER_ROW) return "tooLong"
    for (const step of row.steps) {
      if (step.k.length > MAX_KEYS_PER_STEP || step.k.some((k) => k < MIN_KEY || k > MAX_KEY)) return "invalid"
    }
  }
  if (stepTotal(draft.rows) > MAX_STEPS) return "tooLong"
  if (sounding(draft.rows) < MIN_SOUNDING_STEPS) return "tooFew"
  if (/https?:\/\/|www\./i.test(draft.note)) return "links"
  const link = draft.linkUrl.trim()
  if (link && (!/^https:\/\/[^\s/]+\.[^\s/]+/i.test(link) || link.length > LINK_MAX)) return "badLink"
  return null
}

export function draftToWire(draft: PianoDraft) {
  return {
    sa_key: draft.saKey,
    rows: draft.rows.map((row) => ({
      label: row.label?.trim() || null,
      repeat: row.repeat,
      hand: row.hand,
      steps: row.steps.map((step) => ({ k: step.k, b: step.b })),
    })),
    link_url: draft.linkUrl.trim() || null,
    note: draft.note.trim() || null,
    is_anonymous: draft.isAnonymous,
    replaces_id: draft.replacesId ?? null,
    based_on_id: draft.basedOnId ?? null,
  }
}

/** A draft that starts from a sheet (a copy of its notes), for "Start from this sheet". */
export function draftFromSheet(sheet: PianoSheet, mode: "copy" | "version"): PianoDraft {
  return {
    saKey: sheet.saKey,
    rows: sheet.rows.map((row) => ({ ...row, steps: row.steps.map((step) => ({ k: [...step.k], b: step.b })) })),
    linkUrl: sheet.linkUrl ?? "",
    note: sheet.note ?? "",
    isAnonymous: sheet.isAnonymous,
    replacesId: mode === "version" ? sheet.id : null,
    basedOnId: mode === "copy" ? sheet.id : null,
  }
}

// --------------------------------------------------------------------------- playing order

/** A key pressed at a moment: the semitones above Sa and the hand that plays it. */
export type MomentKey = { k: number; hand: PianoHand }
/** All the keys that go down together, and where in the rows they come from (to light the chips). */
export type Moment = { t: number; dur: number; keys: MomentKey[]; spots: Array<{ row: number; step: number }> }

/**
 * Rows to the order they are played in. A right-hand row starts a group; the left-hand rows that follow join it and
 * start with it (the two hands play together). Each row repeats on its own; a group lasts as long as its longest row,
 * and the next group starts after it. `one_finger` leaves the left hand out. Keys that start together are one moment.
 */
export function momentsOf(rows: readonly PianoRow[], level: PianoLevel): Moment[] {
  const groups: Array<Array<{ row: PianoRow; index: number }>> = []
  rows.forEach((row, index) => {
    if (level === "one_finger" && row.hand === "left") return
    if (row.hand === "right" || groups.length === 0) groups.push([{ row, index }])
    else groups[groups.length - 1]!.push({ row, index })
  })
  const byTime = new Map<number, Moment>()
  let origin = 0
  for (const group of groups) {
    let length = 0
    for (const { row, index } of group) {
      let t = origin
      for (let pass = 0; pass < Math.max(1, row.repeat); pass += 1) {
        row.steps.forEach((step: PianoStep, stepIndex) => {
          const key = Math.round(t * 4)
          const moment = byTime.get(key) ?? { t, dur: step.b, keys: [], spots: [] }
          moment.dur = Math.min(moment.dur, step.b)
          for (const k of step.k) moment.keys.push({ k, hand: row.hand })
          moment.spots.push({ row: index, step: stepIndex })
          byTime.set(key, moment)
          t += step.b
        })
      }
      length = Math.max(length, t - origin)
    }
    origin += length
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t)
}

/** Every key a sheet uses, as MIDI numbers for this Sa (to size the keyboard). */
export function midisOf(rows: readonly PianoRow[], sa: string): number[] {
  return rows.flatMap((row) => row.steps.flatMap((step) => step.k.map((k) => keyMidi(k, sa))))
}

/** Who wrote a sheet, for a line under its title. Null when nobody is named. */
export function authorLine(sheet: PianoSheet): string | null {
  return sheet.author?.name ?? null
}

/** Sheets a reader sees: live ones, and the member's own waiting ones; never one a newer version replaced. */
export function visibleSheets(items: readonly PianoSheet[]): PianoSheet[] {
  return items.filter((sheet) => !sheet.archived && (sheet.status === "published" || sheet.mine))
}
