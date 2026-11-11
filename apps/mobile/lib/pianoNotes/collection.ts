import collectionFile from "@/data/psPianoFromPdf.json"

import { SA_NAMES } from "./keys"
import type { PianoRow, PianoSheet } from "./types"

/**
 * The sheet music of the collection "50 PS with translation" (a PDF made in MuseScore), read by
 * scripts/ps_piano_from_pdf.py into data/curated/ps_piano_from_pdf/ and bundled here as one compact file, so these songs
 * play on the piano with no server. A step in the file is `[beats, key, key ...]`, keys in semitones above Sa, no keys =
 * a rest; the beats are quarter notes, as in the printed score. The team has not checked these sheets yet.
 */
type CollectionSong = {
  title: string
  capo: number | null
  sa: string
  saUncertain: boolean
  doubts: number
  rows: Array<{ label: string | null; repeat: number; steps: number[][] }>
}

const SONGS = (collectionFile as { songs: Record<string, CollectionSong> }).songs

/** The songs of the collection, by number. */
export const COLLECTION_PIANO_SONGS: readonly number[] = Object.keys(SONGS)
  .map(Number)
  .sort((a, b) => a - b)

export function hasCollectionPiano(songNumber: number): boolean {
  return Object.prototype.hasOwnProperty.call(SONGS, String(songNumber))
}

/** The collection's notes of a song as one sheet (one row per printed line, a volta played twice is two rows), or null. */
export function collectionPianoSheet(songNumber: number): PianoSheet | null {
  const song = hasCollectionPiano(songNumber) ? SONGS[String(songNumber)] : undefined
  if (!song) return null
  const rows: PianoRow[] = song.rows
    .map((row) => ({
      label: row.label,
      repeat: row.repeat,
      hand: "right" as const,
      steps: row.steps.map(([b, ...k]) => ({ k, b: b! })),
    }))
    .filter((row) => row.steps.length > 0)
  if (rows.length === 0) return null
  return {
    id: `collection-${songNumber}`,
    target: { kind: "song", number: songNumber },
    saKey: SA_NAMES.includes(song.sa) ? song.sa : "C",
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
    fromCollection: { doubts: song.doubts, saUncertain: song.saUncertain },
  }
}
