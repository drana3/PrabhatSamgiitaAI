import { bookletHarmoniumSong, parseSargamPlayBeats, westernToMidi } from "@prabhat/core"

import { MIDDLE_C } from "./keys"
import type { PianoRow, PianoSheet, PianoStep } from "./types"

/**
 * Stage 0: the sargam that already ships in the app (the booklet of Prabhat Samgiita 1, 2 and 27) as a piano sheet.
 * It needs no server: the notes are the booklet's, read once with Sa on C and kept as semitones above Sa.
 */
export const BOOKLET_PIANO_SONGS = [1, 2, 27] as const

export function hasBookletPiano(songNumber: number): boolean {
  return (BOOKLET_PIANO_SONGS as readonly number[]).includes(songNumber)
}

/** The octave is not in `playBeats`, so the line is read from its `sargam` text (Sa on C): the booklet's own reader. */
function stepsOfLine(line: { sargam: string }): PianoStep[] {
  const beats = parseSargamPlayBeats(line.sargam, "C")
  const steps: PianoStep[] = []
  for (const beat of beats) {
    const midi = beat.western ? westernToMidi(beat.western) : null
    if (midi == null) continue
    steps.push({ k: [midi - MIDDLE_C], b: Math.max(0.25, Math.round(beat.beats * 4) / 4) })
  }
  return steps
}

/** The booklet notes of a song as one sheet (one row per line of the song), or null when the booklet has none. */
export function bookletPianoSheet(songNumber: number): PianoSheet | null {
  const song = bookletHarmoniumSong(songNumber)
  if (!song) return null
  const rows: PianoRow[] = song.lines
    .map((line) => ({ label: line.lyric.trim() || null, repeat: 1, hand: "right" as const, steps: stepsOfLine(line) }))
    .filter((row) => row.steps.length > 0)
  if (rows.length === 0) return null
  return {
    id: `booklet-${songNumber}`,
    target: { kind: "song", number: songNumber },
    saKey: "C",
    level: "one_finger",
    rows,
    stepsCount: rows.reduce((n, r) => n + r.steps.length, 0),
    linkUrl: null,
    note: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    isAnonymous: true,
    author: null,
    byRecordingAuthor: false,
    basedOn: null,
    archived: false,
    replacedBy: null,
    replaces: null,
    mine: false,
    status: "published",
    rejectedReason: null,
    canReview: false,
    recordingTitle: null,
    fromBooklet: true,
  }
}
