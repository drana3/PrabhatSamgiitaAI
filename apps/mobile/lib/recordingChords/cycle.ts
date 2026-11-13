import { isChordName } from "@/lib/songChords/chordName"
import { linkCount, stripInvisible } from "@/lib/songComments/rules"

import { KEY_PATTERN, provesAChart, SHEET_NOTE_MAX } from "./rules"
import type { RecordingSheet, SheetCycle, SheetCycleTune, SheetCycleTuneDraft, SheetFailure, SheetInstrument } from "./types"

/**
 * The chord CYCLE of a Kiirtan (docs/kiirtan-cycle.md). A Kiirtan has no lines of words to hang chords on: the same few
 * chords go round and round. A recording can play more than one TUNE (melody), so a cycle has a list of tunes, up to thirty;
 * each tune is a ring of chords, four by default, up to eight, with the chord the ring starts on (required), its own key
 * (optional) and how many rounds are played (optional). A tune nobody has chords for stays in the recording as
 * "no chords yet" and another member can add it later. The same limits as the API
 * (apps/api/app/schemas/recording_extras.py `CycleIn`).
 *
 * Pure, no React. Nothing here is "now playing": a cycle carries no timing and the screen never highlights a part.
 */
export const CYCLE_DEFAULT_SLOTS = 4
export const CYCLE_MIN_SLOTS = 2
export const CYCLE_MAX_SLOTS = 8
export const CYCLE_MAX_TUNES = 30
export const CYCLE_NAME_MAX = 30
export const CYCLE_TIMES_MAX = 99

export type CycleDraft = {
  /** one entry per tune of the recording, in the order they are played; a tune with no chords is `skipped` */
  tunes: SheetCycleTuneDraft[]
  instrument: SheetInstrument
  capo: number
  playedIt: boolean
  note: string
  isAnonymous: boolean
  /** a waiting or rejected cycle of the member's own that is being fixed */
  editId: string | null
  /** a live cycle of the member's own that is being changed: the new one replaces it once accepted */
  replacesId: string | null
  /** somebody else's published cycle the chords were copied from (credited) */
  basedOn: { id: string; name: string | null } | null
}

export type CycleProblem = "noChords" | "noTune" | "fewChords" | "noStart" | "tooLong" | "links" | "notPlayed" | "badKey" | "noteTooLong" | "badTimes"

/** An empty ring of `slots` places, the first one the start, in no key, with its chords still to come. */
export function emptyTune(slots: number = CYCLE_DEFAULT_SLOTS): SheetCycleTuneDraft {
  const n = Math.min(CYCLE_MAX_SLOTS, Math.max(CYCLE_MIN_SLOTS, Math.round(slots)))
  return { name: "", slots: Array.from({ length: n }, () => null), start: 0, times: "", key: "", skipped: false }
}

const clampCount = (count: number) => Math.min(CYCLE_MAX_TUNES, Math.max(1, Math.round(count)))

/** A new draft with `tunes` empty rings (the question "how many tunes are played in the recording?"). */
export function newCycleDraft(tunes = 1, instrument: SheetInstrument = "guitar"): CycleDraft {
  return { tunes: Array.from({ length: clampCount(tunes) }, () => emptyTune()), instrument, capo: 0, playedIt: false, note: "", isAnonymous: false, editId: null, replacesId: null, basedOn: null }
}

/** Changes the number of tunes: new ones are empty rings, the surplus is cut from the end. */
export function setTuneCount(draft: CycleDraft, count: number): CycleDraft {
  const n = clampCount(count)
  if (n === draft.tunes.length) return draft
  const tunes = n > draft.tunes.length ? [...draft.tunes, ...Array.from({ length: n - draft.tunes.length }, () => emptyTune())] : draft.tunes.slice(0, n)
  return { ...draft, tunes }
}

function mapTune(draft: CycleDraft, index: number, change: (tune: SheetCycleTuneDraft) => SheetCycleTuneDraft): CycleDraft {
  const tune = draft.tunes[index]
  if (!tune) return draft
  return { ...draft, tunes: draft.tunes.map((f, i) => (i === index ? change(f) : f)) }
}

/** Puts a chord on a slot, or empties it with `null`. */
export function setSlot(draft: CycleDraft, tune: number, slot: number, chord: string | null): CycleDraft {
  return mapTune(draft, tune, (f) => (slot < 0 || slot >= f.slots.length ? f : { ...f, slots: f.slots.map((c, i) => (i === slot ? chord : c)) }))
}

/** Marks the slot the round starts on. */
export function setStart(draft: CycleDraft, tune: number, slot: number): CycleDraft {
  return mapTune(draft, tune, (f) => (slot < 0 || slot >= f.slots.length ? f : { ...f, start: slot }))
}

/** Adds a slot at the end (up to eight) or takes the last one away (down to two); the start stays inside the ring. */
export function resizeTune(draft: CycleDraft, tune: number, slots: number): CycleDraft {
  return mapTune(draft, tune, (f) => {
    const n = Math.min(CYCLE_MAX_SLOTS, Math.max(CYCLE_MIN_SLOTS, Math.round(slots)))
    if (n === f.slots.length) return f
    const next = n > f.slots.length ? [...f.slots, ...Array.from({ length: n - f.slots.length }, () => null)] : f.slots.slice(0, n)
    return { ...f, slots: next, start: Math.min(f.start, n - 1) }
  })
}

export function setTuneName(draft: CycleDraft, tune: number, name: string): CycleDraft {
  return mapTune(draft, tune, (f) => ({ ...f, name: name.slice(0, CYCLE_NAME_MAX + 10) }))
}

export function setTuneTimes(draft: CycleDraft, tune: number, times: string): CycleDraft {
  return mapTune(draft, tune, (f) => ({ ...f, times: times.replace(/\D+/g, "").slice(0, 2) }))
}

/** The key of one tune ("" = not sure). Every tune has its own: different tunes can be in different keys. */
export function setTuneKey(draft: CycleDraft, tune: number, key: string): CycleDraft {
  return mapTune(draft, tune, (f) => ({ ...f, key }))
}

/** "No chords yet" for a tune (or back to being filled in). */
export function setTuneSkipped(draft: CycleDraft, tune: number, skipped: boolean): CycleDraft {
  return mapTune(draft, tune, (f) => ({ ...f, skipped }))
}

/** The tune before this one that is being filled in (a skipped tune has no key to copy), or null. */
export function previousTune(draft: CycleDraft, tune: number): number | null {
  for (let i = tune - 1; i >= 0; i -= 1) if (draft.tunes[i] && !draft.tunes[i]!.skipped) return i
  return null
}

/** "Same as previous tune": copies the key of the previous tune. Does nothing for the first tune. */
export function keyLikePrevious(draft: CycleDraft, tune: number): CycleDraft {
  const prev = previousTune(draft, tune)
  return prev === null ? draft : setTuneKey(draft, tune, draft.tunes[prev]!.key)
}

/** The answer to "do you have chords for all the tunes, or only for some?": `chosen` are the tunes to enter, the rest are skipped. */
export function chooseTunes(draft: CycleDraft, chosen: readonly number[]): CycleDraft {
  return { ...draft, tunes: draft.tunes.map((f, i) => ({ ...f, skipped: !chosen.includes(i) })) }
}

/** The tunes that are being entered (not skipped), as places in the list. */
export function activeTunes(draft: CycleDraft): number[] {
  return draft.tunes.flatMap((f, i) => (f.skipped ? [] : [i]))
}

/** The next tune to fill in after `from` (or the first one for -1), or null when it was the last: the walk of the entry screen. */
export function nextTune(draft: CycleDraft, from: number): number | null {
  for (let i = from + 1; i < draft.tunes.length; i += 1) if (!draft.tunes[i]!.skipped) return i
  return null
}

/** The tune to fill in before `from`, or null when it is the first. */
export function priorTune(draft: CycleDraft, from: number): number | null {
  for (let i = from - 1; i >= 0; i -= 1) if (!draft.tunes[i]!.skipped) return i
  return null
}

function cleanName(raw: string): string | null {
  const name = stripInvisible(raw).split(/\s+/).filter(Boolean).join(" ")
  return name || null
}

function timesOf(raw: string): number | null | "bad" {
  const text = raw.trim()
  if (!text) return null
  const n = Number(text)
  return Number.isInteger(n) && n >= 1 && n <= CYCLE_TIMES_MAX ? n : "bad"
}

/** True when every place of the ring holds a chord. */
export function tuneFilled(f: SheetCycleTuneDraft): boolean {
  return f.slots.length >= CYCLE_MIN_SLOTS && f.slots.every((c) => Boolean(c && c.trim()) && isChordName((c ?? "").trim()))
}

/** True when nothing was put in the ring yet. */
export function tuneEmpty(f: SheetCycleTuneDraft): boolean {
  return f.slots.every((c) => !c)
}

/** Where a tune stands on the entry screen: finished, left as "no chords yet", partly filled, or not started. */
export type TuneState = "done" | "skipped" | "partial" | "empty"

export function tuneState(f: SheetCycleTuneDraft): TuneState {
  if (f.skipped) return "skipped"
  if (tuneFilled(f)) return "done"
  return tuneEmpty(f) ? "empty" : "partial"
}

/** How many tunes are in each state (the line over the list of tunes). */
export function tuneStates(draft: CycleDraft): Record<TuneState, number> {
  const out: Record<TuneState, number> = { done: 0, skipped: 0, partial: 0, empty: 0 }
  for (const f of draft.tunes) out[tuneState(f)] += 1
  return out
}

/** Jump to any tune: a tune that was left as "no chords yet" is taken back into the walk. */
export function openTune(draft: CycleDraft, tune: number): CycleDraft {
  return draft.tunes[tune]?.skipped ? setTuneSkipped(draft, tune, false) : draft
}

/**
 * The tunes named by a typed range such as "1-5, 8" (numbers from 1, as people count), as places in the list. Anything
 * else (a letter, 0, a number past `max`, a backwards range) makes the whole text invalid: null. An empty text is [].
 */
export function parseTuneRange(text: string, max: number): number[] | null {
  const out = new Set<number>()
  for (const raw of text.split(/[,;\s]+/)) {
    const part = raw.trim()
    if (!part) continue
    const m = /^(\d{1,3})(?:\s*[-\u2013]\s*(\d{1,3}))?$/.exec(part)
    if (!m) return null
    const from = Number(m[1])
    const to = m[2] === undefined ? from : Number(m[2])
    if (from < 1 || to < from || to > max) return null
    for (let n = from; n <= to; n += 1) out.add(n - 1)
  }
  return [...out].sort((a, b) => a - b)
}

/** The tune as the server keeps it, or null while a slot is still empty (or the tune is skipped). */
function tuneOf(f: SheetCycleTuneDraft, number: number): SheetCycleTune | null {
  if (f.skipped) return null
  const chords = f.slots.map((c) => (c ?? "").trim())
  if (chords.some((c) => !c)) return null
  const times = timesOf(f.times)
  return { number, name: cleanName(f.name), key: f.key.trim() || null, chords, start: Math.min(f.start, chords.length - 1), times: times === "bad" ? null : times }
}

/** What stops one tune from being finished (the "Next" button of its step). Empty: it can go on. */
export function tuneProblems(f: SheetCycleTuneDraft): CycleProblem[] {
  const out: CycleProblem[] = []
  if (!tuneFilled(f)) out.push("noChords")
  if (f.start < 0 || f.start >= f.slots.length) out.push("noStart")
  if (timesOf(f.times) === "bad") out.push("badTimes")
  const name = cleanName(f.name) ?? ""
  if (Array.from(name).length > CYCLE_NAME_MAX) out.push("tooLong")
  if (linkCount(name) > 0) out.push("links")
  const key = f.key.trim()
  if (key && !KEY_PATTERN.test(key)) out.push("badKey")
  return out
}

/** What stops the cycle from being sent, in the order a person fixes it. Empty: it can go. */
export function cycleProblems(draft: CycleDraft): CycleProblem[] {
  const out: CycleProblem[] = []
  const active = draft.tunes.filter((f) => !f.skipped)
  const add = (p: CycleProblem) => {
    if (!out.includes(p)) out.push(p)
  }
  if (active.length === 0) add("noTune")
  for (const f of active) for (const p of tuneProblems(f)) add(p)
  const chordsOf = active.flatMap((f) => f.slots.filter((c): c is string => Boolean(c && c.trim())))
  if (active.length > 0 && !out.includes("noChords") && !provesAChart(chordsOf)) add("fewChords")
  if (Array.from(draft.note.trim()).length > SHEET_NOTE_MAX) add("noteTooLong")
  else if (linkCount(stripInvisible(draft.note)) > 0) add("links")
  if (!draft.playedIt) add("notPlayed")
  return out
}

/** True when nothing was entered yet (a collapsed prompt sends nothing; leaving asks nothing). */
export function isBlankCycle(draft: CycleDraft): boolean {
  return draft.tunes.every((f) => tuneEmpty(f) && !f.name.trim() && !f.times.trim() && !f.key)
}

/** How many chords were put on the rings. */
export function cycleChordCount(draft: CycleDraft): number {
  return draft.tunes.reduce((sum, f) => sum + (f.skipped ? 0 : f.slots.filter(Boolean).length), 0)
}

/** The chords used so far in the draft, in order of first use (the chord sheet shows them first). */
export function cycleUsedChords(draft: CycleDraft): string[] {
  const seen: string[] = []
  for (const f of draft.tunes) for (const c of f.slots) if (c && !seen.includes(c)) seen.push(c)
  return seen
}

export type CyclePayload = {
  instrument: SheetInstrument
  /** the key of the first tune that has one: the sheet is listed under it */
  key: string | null
  capo: number
  cycle: SheetCycle
  playedIt: boolean
  note: string | null
  isAnonymous: boolean
  replacesId: string | null
  basedOnId: string | null
}

/** What the member sends. Only for a draft with no problems. Tunes that were skipped are not sent: they stay "no chords yet". */
export function toCyclePayload(draft: CycleDraft): CyclePayload {
  const tunes = draft.tunes.map((f, i) => tuneOf(f, i + 1)).filter((f): f is SheetCycleTune => f !== null)
  return {
    instrument: draft.instrument,
    key: tunes.find((f) => f.key)?.key ?? null,
    capo: draft.instrument === "guitar" ? draft.capo : 0,
    cycle: { tuneCount: draft.tunes.length, tunes },
    playedIt: draft.playedIt,
    note: draft.note.trim() || null,
    isAnonymous: draft.isAnonymous,
    replacesId: draft.replacesId,
    basedOnId: draft.basedOn?.id ?? null,
  }
}

/** The request body (snake_case) of a cycle. */
export function cycleToWire(payload: CyclePayload): Record<string, unknown> {
  return {
    instrument: payload.instrument,
    chart_key: payload.key,
    capo: payload.capo,
    cycle: {
      tune_count: payload.cycle.tuneCount,
      tunes: payload.cycle.tunes.map((f) => ({ number: f.number, name: f.name, key: f.key, chords: f.chords, start: f.start, times: f.times })),
    },
    played_it: payload.playedIt,
    note: payload.note,
    is_anonymous: payload.isAnonymous,
    ...(payload.replacesId ? { replaces_id: payload.replacesId } : {}),
    ...(payload.basedOnId ? { based_on_id: payload.basedOnId } : {}),
  }
}

type WireCycle = {
  tune_count?: number
  tunes?: Array<{ number?: number; name: string | null; key?: string | null; chords: string[]; start: number; times: number | null }>
  /** the first build's name for a tune: read as tunes numbered by their place (the server already does this) */
  forms?: Array<{ name: string | null; chords: string[]; start: number; times: number | null }>
}

/** The cycle as the app keeps it. An answer of the first build (`forms`, no numbers, no keys) is read as tunes in order. */
export function cycleFromWire(w: WireCycle): SheetCycle {
  const raw: Array<{ number?: number; name: string | null; key?: string | null; chords: string[]; start: number; times: number | null }> = w.tunes ?? w.forms ?? []
  const tunes: SheetCycleTune[] = raw.map((f, i) => ({
    number: f.number || i + 1,
    name: f.name ?? null,
    key: f.key || null,
    chords: [...f.chords],
    start: f.start,
    times: f.times ?? null,
  }))
  const top = tunes.reduce((m, f) => Math.max(m, f.number), 0)
  return { tuneCount: Math.max(w.tune_count ?? 0, tunes.length, top), tunes }
}

/** A sheet is a cycle when it carries one. */
export function isCycle(sheet: Pick<RecordingSheet, "cycle">): boolean {
  return Boolean(sheet.cycle && sheet.cycle.tunes.length > 0)
}

/** How many tunes of the recording have no chords yet in this cycle. */
export function missingTunes(cycle: SheetCycle): number[] {
  const have = new Set(cycle.tunes.map((f) => f.number))
  return Array.from({ length: cycle.tuneCount }, (_, i) => i + 1).filter((n) => !have.has(n))
}

function tuneDraftOf(f: SheetCycleTune): SheetCycleTuneDraft {
  return { name: f.name ?? "", slots: [...f.chords], start: f.start, times: f.times ? String(f.times) : "", key: f.key ?? "", skipped: false }
}

/** The drafts of a cycle, one per tune of the recording: tunes without chords are skipped ("no chords yet"). */
function tunesOfSheet(cycle: SheetCycle): SheetCycleTuneDraft[] {
  return Array.from({ length: cycle.tuneCount }, (_, i) => {
    const found = cycle.tunes.find((f) => f.number === i + 1)
    return found ? tuneDraftOf(found) : { ...emptyTune(), skipped: true }
  })
}

/** A draft from a cycle of the member's own (fix a waiting or rejected one, or change a live one into a replacement). */
export function cycleDraftFromSheet(sheet: RecordingSheet, mode: "edit" | "copy"): CycleDraft {
  const base = newCycleDraft(1, sheet.instrument)
  return {
    ...base,
    tunes: sheet.cycle ? tunesOfSheet(sheet.cycle) : base.tunes,
    capo: sheet.capo ?? 0,
    playedIt: sheet.playedIt,
    note: sheet.note ?? "",
    isAnonymous: sheet.isAnonymous,
    editId: mode === "edit" ? sheet.id : null,
    replacesId: mode === "copy" ? sheet.id : null,
  }
}

/**
 * A draft that starts from somebody else's published cycle: the chords are copied and the first author is credited.
 * `fill` is the number of a tune with no chords yet that the member is adding: it is opened for entering, the other
 * tunes without chords stay "no chords yet".
 */
export function cycleDraftFromOther(sheet: RecordingSheet, fill?: number): CycleDraft {
  const copy = cycleDraftFromSheet(sheet, "copy")
  const tunes = fill && fill >= 1 && fill <= copy.tunes.length && copy.tunes[fill - 1]!.skipped ? copy.tunes.map((f, i) => (i === fill - 1 ? { ...f, skipped: false } : f)) : copy.tunes
  return {
    ...copy,
    tunes,
    replacesId: null,
    playedIt: false,
    isAnonymous: false,
    note: "",
    basedOn: { id: sheet.basedOn?.id ?? sheet.id, name: sheet.basedOn?.name ?? sheet.author?.name ?? null },
  }
}

/** One line for a tune of a cycle: the chords in order, as a listener reads them: `Em - C - G - D`. */
export function tuneLine(tune: Pick<SheetCycleTune, "chords">): string {
  return tune.chords.join(" - ")
}

/** The chord slots of a tune in the order they are played, starting with the start. */
export function roundOrder(tune: Pick<SheetCycleTune, "chords" | "start">): string[] {
  return tune.chords.map((_, i) => tune.chords[(tune.start + i) % tune.chords.length] as string)
}

/** The tune with this number, or undefined while it has no chords yet. */
export function tuneNumbered(cycle: SheetCycle, number: number): SheetCycleTune | undefined {
  return cycle.tunes.find((f) => f.number === number)
}

/** The failure a cycle problem is told as (the screens have a sentence for each). */
export function cycleProblemFailure(problem: CycleProblem): SheetFailure | null {
  switch (problem) {
    case "noChords":
    case "noTune":
      return "noChords"
    case "fewChords":
      return "fewChords"
    case "tooLong":
      return "tooLong"
    case "links":
      return "links"
    default:
      return null
  }
}
