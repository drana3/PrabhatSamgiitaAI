import type { ChordChart } from "@/lib/songPage/chordChart"
import { MAX_CAPO } from "@/lib/songPage/chords"

import { isChordName } from "./chordName"
import { shiftChord } from "./spelling"
import type { ChordInstrument, ChordProposal, ProposalPayload } from "./types"

/**
 * The editor's model: pure functions on a plain object, so every rule is tested without a screen.
 *
 * `lines[i]` are the chords of lyric line i as the member ENTERS them: for a guitar the SHAPES they play (with the
 * capo on), for a harmonium the chords in the key of Sa. `toPayload` turns them into the sounding chords the API and
 * the song page use, so a proposal is the same structure as any chart.
 */
export type Placement = { word: number; chord: string }

export type Draft = {
  songId: number | null
  instrument: ChordInstrument
  /** guitar: the key of the shapes; harmonium: Sa */
  key: string
  /** guitar only; 0 to 7 */
  capo: number
  strum: string
  lines: Placement[][]
  /** "I played / checked these chords" */
  playedIt: boolean
  note: string
  isAnonymous: boolean
  /** set while the member fixes a chart they already sent (a waiting or a rejected one): "send again" updates it */
  editId?: string | null
  /** set while the member makes a changed copy of a live chart: it is sent as a NEW chart */
  basedOn?: string | null
}

export const NOTE_MAX = 300
export const STRUM_MAX = 40
export const DEFAULT_KEY = "D"

export function newDraft(songId: number | null = null): Draft {
  return { songId, instrument: "guitar", key: DEFAULT_KEY, capo: 0, strum: "", lines: [], playedIt: false, note: "", isAnonymous: false }
}

/** One (possibly empty) list per lyric line. Keeps the chords of lines that still exist. */
export function fitLines(draft: Draft, lineCount: number): Draft {
  if (draft.lines.length === lineCount) return draft
  const lines = Array.from({ length: lineCount }, (_, i) => draft.lines[i] ?? [])
  return { ...draft, lines }
}

export function chordAt(draft: Draft, line: number, word: number): string | null {
  return draft.lines[line]?.find((p) => p.word === word)?.chord ?? null
}

/** Put `chord` over a word (replacing the one there); `null` or an empty text clears the word. */
export function setChord(draft: Draft, line: number, word: number, chord: string | null): Draft {
  if (line < 0 || line >= draft.lines.length || word < 0) return draft
  const rest = draft.lines[line].filter((p) => p.word !== word)
  const next = chord && chord.trim() ? [...rest, { word, chord: chord.trim() }].sort((a, b) => a.word - b.word) : rest
  const lines = draft.lines.slice()
  lines[line] = next
  return { ...draft, lines }
}

export function clearLine(draft: Draft, line: number): Draft {
  if (line < 0 || line >= draft.lines.length) return draft
  const lines = draft.lines.slice()
  lines[line] = []
  return { ...draft, lines }
}

export function replaceLines(draft: Draft, lines: Placement[][]): Draft {
  return { ...draft, lines: lines.map((line) => line.map((p) => ({ ...p }))) }
}

export function countChords(draft: Draft): number {
  return draft.lines.reduce((sum, line) => sum + line.length, 0)
}

export function linesWithChords(draft: Draft): number {
  return draft.lines.filter((line) => line.length > 0).length
}

/** The position after `(line, word)` in reading order, or null at the end of the song. */
export function nextSlot(wordCounts: readonly number[], line: number, word: number): { line: number; word: number } | null {
  if (word + 1 < (wordCounts[line] ?? 0)) return { line, word: word + 1 }
  for (let next = line + 1; next < wordCounts.length; next += 1) if ((wordCounts[next] ?? 0) > 0) return { line: next, word: 0 }
  return null
}

export function previousSlot(wordCounts: readonly number[], line: number, word: number): { line: number; word: number } | null {
  if (word > 0) return { line, word: word - 1 }
  for (let prev = line - 1; prev >= 0; prev -= 1) if ((wordCounts[prev] ?? 0) > 0) return { line: prev, word: wordCounts[prev] - 1 }
  return null
}

export function setInstrument(draft: Draft, instrument: ChordInstrument): Draft {
  if (instrument === draft.instrument) return draft
  return instrument === "harmonium" ? { ...draft, instrument, capo: 0, strum: "" } : { ...draft, instrument }
}

export function setCapo(draft: Draft, capo: number): Draft {
  if (draft.instrument !== "guitar") return draft
  const safe = Number.isFinite(capo) ? Math.min(MAX_CAPO, Math.max(0, Math.round(capo))) : 0
  return { ...draft, capo: safe }
}

/** The key the chart SOUNDS in: the shapes' key raised by the capo (a harmonium's Sa is what it is). */
export function soundingKey(draft: Pick<Draft, "instrument" | "key" | "capo">): string {
  return draft.instrument === "guitar" ? shiftChord(draft.key, draft.capo) : draft.key
}

/** What the chord sounds like: for a guitar a shape with the capo on fret `capo`, for a harmonium itself. */
export function soundingOf(draft: Pick<Draft, "instrument" | "capo">, chord: string): string {
  return draft.instrument === "guitar" ? shiftChord(chord, draft.capo) : chord
}

export type DraftProblem = "noSong" | "noChords" | "badChord" | "notPlayed" | "noteTooLong" | "strumShape"

const STRUM_OK = /^[DUduxX.\-\s^v|()0-9]*$/

/** Everything that stops a draft from being sent, in the order the form meets it. */
export function draftProblems(draft: Draft, wordCounts: readonly number[]): DraftProblem[] {
  const out: DraftProblem[] = []
  if (draft.songId === null) out.push("noSong")
  const live = draft.lines.map((line, i) => line.filter((p) => p.word < (wordCounts[i] ?? 0)))
  if (live.every((line) => line.length === 0)) out.push("noChords")
  if (live.some((line) => line.some((p) => !isChordName(p.chord)))) out.push("badChord")
  if (draft.strum.length > STRUM_MAX || !STRUM_OK.test(draft.strum)) out.push("strumShape")
  if (draft.note.length > NOTE_MAX) out.push("noteTooLong")
  if (!draft.playedIt) out.push("notPlayed")
  return out
}

/** The API payload: sounding chords, only on words that exist, the capo as a hint. Throws on an unfinished draft. */
export function toPayload(draft: Draft, wordCounts: readonly number[]): ProposalPayload {
  if (draft.songId === null) throw new Error("A chord chart needs a song")
  const lines = draft.lines.map((line, i) => ({
    placements: line.filter((p) => p.word < (wordCounts[i] ?? 0)).map((p) => ({ word: p.word, chord: soundingOf(draft, p.chord) })),
  }))
  // trailing lines without chords carry nothing
  while (lines.length > 1 && lines[lines.length - 1].placements.length === 0) lines.pop()
  const strum = draft.instrument === "guitar" ? draft.strum.replace(/\s+/g, " ").trim() : ""
  const note = draft.note.trim()
  return {
    songId: draft.songId,
    instrument: draft.instrument,
    baseKey: soundingKey(draft),
    capo: draft.instrument === "guitar" ? draft.capo : 0,
    strum: strum || null,
    lines,
    playedIt: draft.playedIt,
    note: note || null,
    isAnonymous: draft.isAnonymous,
  }
}

/** The draft as a chart of the song page's model (sounding chords), for the preview. */
export function toChart(draft: Draft, wordCounts: readonly number[]): ChordChart {
  const payload = toPayload({ ...draft, songId: draft.songId ?? 0 }, wordCounts)
  return { reviewed: true, baseKey: payload.baseKey, strum: payload.strum ?? undefined, lines: payload.lines }
}

/**
 * The editor's draft for a chart that already exists: the other way round of `toPayload`. A guitar chart is stored as
 * SOUNDING chords, the editor works in the SHAPES, so every chord and the key go down by the capo. `how` says what
 * sending does: "edit" updates this very chart (a waiting or rejected one), "copy" offers a changed copy of a live one.
 */
export function draftFromProposal(proposal: ChordProposal, how: "edit" | "copy"): Draft {
  const capo = proposal.instrument === "guitar" ? proposal.capo : 0
  const shape = (chord: string) => (capo > 0 ? shiftChord(chord, -capo) : chord)
  return {
    songId: proposal.songId,
    instrument: proposal.instrument,
    key: shiftChord(proposal.baseKey, -capo),
    capo,
    strum: proposal.instrument === "guitar" ? (proposal.strum ?? "") : "",
    lines: proposal.lines.map((line) => line.placements.map((p) => ({ word: p.word, chord: shape(p.chord) }))),
    playedIt: proposal.playedIt,
    note: proposal.note ?? "",
    isAnonymous: proposal.isAnonymous,
    editId: how === "edit" ? proposal.id : null,
    basedOn: how === "copy" ? proposal.id : null,
  }
}
