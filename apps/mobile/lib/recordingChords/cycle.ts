import { isChordName } from "@/lib/songChords/chordName"
import { linkCount, stripInvisible } from "@/lib/songComments/rules"

import { KEY_PATTERN, provesAChart, SHEET_NOTE_MAX } from "./rules"
import type { RecordingSheet, SheetCycle, SheetCycleForm, SheetCycleFormDraft, SheetFailure, SheetInstrument } from "./types"

/**
 * The chord CYCLE of a Kiirtan (docs/kiirtan-cycle.md). A Kiirtan has no lines of words to hang chords on: the same few
 * chords go round and round. So a recording has a list of FORMS (a slow round, then a fast one); each form is a ring of
 * chords, four by default, up to eight, with the chord the ring starts on (required) and how many rounds are played
 * (optional). The same limits as the API (apps/api/app/schemas/recording_extras.py `CycleIn`).
 *
 * Pure, no React. Nothing here is "now playing": a cycle carries no timing and the screen never highlights a part.
 */
export const CYCLE_DEFAULT_SLOTS = 4
export const CYCLE_MIN_SLOTS = 2
export const CYCLE_MAX_SLOTS = 8
export const CYCLE_MAX_FORMS = 8
export const CYCLE_NAME_MAX = 30
export const CYCLE_TIMES_MAX = 99

export type CycleDraft = {
  forms: SheetCycleFormDraft[]
  instrument: SheetInstrument
  /** "" when the player did not say */
  key: string
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

export type CycleProblem = "noChords" | "fewChords" | "noStart" | "tooLong" | "links" | "notPlayed" | "badKey" | "noteTooLong" | "badTimes" | "sameForm"

/** An empty ring of `slots` places, the first one the start. */
export function emptyForm(slots: number = CYCLE_DEFAULT_SLOTS): SheetCycleFormDraft {
  const n = Math.min(CYCLE_MAX_SLOTS, Math.max(CYCLE_MIN_SLOTS, Math.round(slots)))
  return { name: "", slots: Array.from({ length: n }, () => null), start: 0, times: "" }
}

/** A new draft with `forms` empty rings (the question "how many forms are played in the recording?"). */
export function newCycleDraft(forms = 1, instrument: SheetInstrument = "guitar"): CycleDraft {
  const n = Math.min(CYCLE_MAX_FORMS, Math.max(1, Math.round(forms)))
  return { forms: Array.from({ length: n }, () => emptyForm()), instrument, key: "", capo: 0, playedIt: false, note: "", isAnonymous: false, editId: null, replacesId: null, basedOn: null }
}

/** Changes the number of forms: new ones are empty rings, the surplus is cut from the end. */
export function setFormCount(draft: CycleDraft, count: number): CycleDraft {
  const n = Math.min(CYCLE_MAX_FORMS, Math.max(1, Math.round(count)))
  if (n === draft.forms.length) return draft
  const forms = n > draft.forms.length ? [...draft.forms, ...Array.from({ length: n - draft.forms.length }, () => emptyForm())] : draft.forms.slice(0, n)
  return { ...draft, forms }
}

function mapForm(draft: CycleDraft, index: number, change: (form: SheetCycleFormDraft) => SheetCycleFormDraft): CycleDraft {
  const form = draft.forms[index]
  if (!form) return draft
  return { ...draft, forms: draft.forms.map((f, i) => (i === index ? change(f) : f)) }
}

/** Puts a chord on a slot, or empties it with `null`. */
export function setSlot(draft: CycleDraft, form: number, slot: number, chord: string | null): CycleDraft {
  return mapForm(draft, form, (f) => (slot < 0 || slot >= f.slots.length ? f : { ...f, slots: f.slots.map((c, i) => (i === slot ? chord : c)) }))
}

/** Marks the slot the round starts on. */
export function setStart(draft: CycleDraft, form: number, slot: number): CycleDraft {
  return mapForm(draft, form, (f) => (slot < 0 || slot >= f.slots.length ? f : { ...f, start: slot }))
}

/** Adds a slot at the end (up to eight) or takes the last one away (down to two); the start stays inside the ring. */
export function resizeForm(draft: CycleDraft, form: number, slots: number): CycleDraft {
  return mapForm(draft, form, (f) => {
    const n = Math.min(CYCLE_MAX_SLOTS, Math.max(CYCLE_MIN_SLOTS, Math.round(slots)))
    if (n === f.slots.length) return f
    const next = n > f.slots.length ? [...f.slots, ...Array.from({ length: n - f.slots.length }, () => null)] : f.slots.slice(0, n)
    return { ...f, slots: next, start: Math.min(f.start, n - 1) }
  })
}

export function setFormName(draft: CycleDraft, form: number, name: string): CycleDraft {
  return mapForm(draft, form, (f) => ({ ...f, name: name.slice(0, CYCLE_NAME_MAX + 10) }))
}

export function setFormTimes(draft: CycleDraft, form: number, times: string): CycleDraft {
  return mapForm(draft, form, (f) => ({ ...f, times: times.replace(/\D+/g, "").slice(0, 2) }))
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

/** The form as the server keeps it, or null while a slot is still empty. */
function formOf(f: SheetCycleFormDraft): SheetCycleForm | null {
  const chords = f.slots.map((c) => (c ?? "").trim())
  if (chords.some((c) => !c)) return null
  const times = timesOf(f.times)
  return { name: cleanName(f.name), chords, start: Math.min(f.start, chords.length - 1), times: times === "bad" ? null : times }
}

/** What stops the cycle from being sent, in the order a person fixes it. Empty: it can go. */
export function cycleProblems(draft: CycleDraft): CycleProblem[] {
  const out: CycleProblem[] = []
  const chordsOf = draft.forms.flatMap((f) => f.slots.filter((c): c is string => Boolean(c && c.trim())))
  if (chordsOf.length === 0) out.push("noChords")
  // every place of a ring must hold a chord (a ring with a hole has no round to play)
  else if (draft.forms.some((f) => f.slots.some((c) => !c || !c.trim()))) out.push("noChords")
  else if (chordsOf.some((c) => !isChordName(c))) out.push("noChords")
  else if (!provesAChart(chordsOf)) out.push("fewChords")
  if (draft.forms.some((f) => f.start < 0 || f.start >= f.slots.length)) out.push("noStart")
  if (draft.forms.some((f) => timesOf(f.times) === "bad")) out.push("badTimes")
  const names = draft.forms.map((f) => cleanName(f.name) ?? "")
  if (names.some((n) => Array.from(n).length > CYCLE_NAME_MAX)) out.push("tooLong")
  if (names.some((n) => linkCount(n) > 0)) out.push("links")
  const forms = draft.forms.map(formOf)
  if (forms.every(Boolean)) {
    const keys = (forms as SheetCycleForm[]).map((f) => JSON.stringify([f.chords, f.start, f.times]))
    if (new Set(keys).size < keys.length) out.push("sameForm")
  }
  const key = draft.key.trim()
  if (key && !KEY_PATTERN.test(key)) out.push("badKey")
  if (Array.from(draft.note.trim()).length > SHEET_NOTE_MAX) out.push("noteTooLong")
  else if (linkCount(stripInvisible(draft.note)) > 0) out.push("links")
  if (!draft.playedIt) out.push("notPlayed")
  return out
}

/** True when nothing was entered yet (a collapsed prompt sends nothing; leaving asks nothing). */
export function isBlankCycle(draft: CycleDraft): boolean {
  return draft.forms.every((f) => f.slots.every((c) => !c) && !f.name.trim() && !f.times.trim())
}

/** How many chords were put on the rings. */
export function cycleChordCount(draft: CycleDraft): number {
  return draft.forms.reduce((sum, f) => sum + f.slots.filter(Boolean).length, 0)
}

/** The chords used so far in the draft, in order of first use (the chord sheet shows them first). */
export function cycleUsedChords(draft: CycleDraft): string[] {
  const seen: string[] = []
  for (const f of draft.forms) for (const c of f.slots) if (c && !seen.includes(c)) seen.push(c)
  return seen
}

/** What the member sends. Only for a draft with no problems. */
export function toCyclePayload(draft: CycleDraft): { instrument: SheetInstrument; key: string | null; capo: number; cycle: SheetCycle; playedIt: boolean; note: string | null; isAnonymous: boolean; replacesId: string | null; basedOnId: string | null } {
  const forms = draft.forms.map(formOf).filter((f): f is SheetCycleForm => f !== null)
  return {
    instrument: draft.instrument,
    key: draft.key.trim() || null,
    capo: draft.instrument === "guitar" ? draft.capo : 0,
    cycle: { forms },
    playedIt: draft.playedIt,
    note: draft.note.trim() || null,
    isAnonymous: draft.isAnonymous,
    replacesId: draft.replacesId,
    basedOnId: draft.basedOn?.id ?? null,
  }
}

export type CyclePayload = ReturnType<typeof toCyclePayload>

/** The request body (snake_case) of a cycle. */
export function cycleToWire(payload: CyclePayload): Record<string, unknown> {
  return {
    instrument: payload.instrument,
    chart_key: payload.key,
    capo: payload.capo,
    cycle: { forms: payload.cycle.forms.map((f) => ({ name: f.name, chords: f.chords, start: f.start, times: f.times })) },
    played_it: payload.playedIt,
    note: payload.note,
    is_anonymous: payload.isAnonymous,
    ...(payload.replacesId ? { replaces_id: payload.replacesId } : {}),
    ...(payload.basedOnId ? { based_on_id: payload.basedOnId } : {}),
  }
}

/** A sheet is a cycle when it carries one. */
export function isCycle(sheet: Pick<RecordingSheet, "cycle">): boolean {
  return Boolean(sheet.cycle && sheet.cycle.forms.length > 0)
}

function formDraftOf(f: SheetCycleForm): SheetCycleFormDraft {
  return { name: f.name ?? "", slots: [...f.chords], start: f.start, times: f.times ? String(f.times) : "" }
}

/** A draft from a cycle of the member's own (fix a waiting or rejected one, or change a live one into a replacement). */
export function cycleDraftFromSheet(sheet: RecordingSheet, mode: "edit" | "copy"): CycleDraft {
  const base = newCycleDraft(1, sheet.instrument)
  return {
    ...base,
    forms: (sheet.cycle?.forms ?? []).map(formDraftOf),
    key: sheet.chartKey ?? "",
    capo: sheet.capo ?? 0,
    playedIt: sheet.playedIt,
    note: sheet.note ?? "",
    isAnonymous: sheet.isAnonymous,
    editId: mode === "edit" ? sheet.id : null,
    replacesId: mode === "copy" ? sheet.id : null,
  }
}

/** A draft that starts from somebody else's published cycle: the chords are copied and the first author is credited. */
export function cycleDraftFromOther(sheet: RecordingSheet): CycleDraft {
  return {
    ...cycleDraftFromSheet(sheet, "copy"),
    replacesId: null,
    playedIt: false,
    isAnonymous: false,
    note: "",
    basedOn: { id: sheet.basedOn?.id ?? sheet.id, name: sheet.basedOn?.name ?? sheet.author?.name ?? null },
  }
}

/** One line for a form of a cycle: the chords in order, as a listener reads them: `Em - C - G - D`. */
export function formLine(form: SheetCycleForm): string {
  return form.chords.join(" - ")
}

/** The chord slots of a form in the order they are played, starting with the start. */
export function roundOrder(form: SheetCycleForm): string[] {
  return form.chords.map((_, i) => form.chords[(form.start + i) % form.chords.length] as string)
}

/** The failure a cycle problem is told as (the screens have a sentence for each). */
export function cycleProblemFailure(problem: CycleProblem): SheetFailure | null {
  switch (problem) {
    case "noChords":
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
