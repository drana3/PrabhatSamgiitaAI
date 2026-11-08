import type { Draft } from "./draft"
import type { ChordInstrument } from "./types"

/**
 * How the "offer chords" screen was opened, read from its address. Pure, so the doors into the screen are tested:
 *  - `/upload-chords`                      a new chart (or a way back into drafts)
 *  - `/upload-chords?song=7`               a new chart for song 7 (from the song page)
 *  - `/upload-chords?song=7&instrument=harmonium`   "offer another version" for that song and instrument
 *  - `/upload-chords?edit=<id>`            fix a waiting or rejected chart (it is updated, same id)
 *  - `/upload-chords?copy=<id>`            a changed copy of a live chart (sent as a new chart)
 *  - `/upload-chords?draft=<key>`          continue exactly this draft (from Unfinished charts on Upload)
 *  - `/upload-chords?from=<id>&song=7`     start from someone else's published chart of song 7 (a new chart, nobody's
 *                                          words are copied but the chords; the member plays and confirms them)
 */
export type EntryParams = { song?: string; instrument?: string; edit?: string; copy?: string; draft?: string; from?: string }

export type Entry =
  | { kind: "new"; song: number | null; instrument: ChordInstrument | null }
  | { kind: "edit"; id: string }
  | { kind: "copy"; id: string }
  | { kind: "draft"; key: string }
  | { kind: "from"; id: string; song: number | null }

function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === "string" && v.trim() ? v.trim() : undefined
}

export function parseEntry(params: Record<string, string | string[] | undefined>): Entry {
  const edit = one(params.edit)
  if (edit) return { kind: "edit", id: edit }
  const copy = one(params.copy)
  if (copy) return { kind: "copy", id: copy }
  const draft = one(params.draft)
  if (draft) return { kind: "draft", key: draft }
  const song = Number(one(params.song))
  const from = one(params.from)
  if (from) return { kind: "from", id: from, song: Number.isInteger(song) && song > 0 ? song : null }
  const instrument = one(params.instrument)
  return {
    kind: "new",
    song: Number.isInteger(song) && song > 0 ? song : null,
    instrument: instrument === "guitar" || instrument === "harmonium" ? instrument : null,
  }
}

/** What identifies the member's work in a draft; two drafts with the same signature are the same work. */
export function draftSignature(d: Draft): string {
  const lines = d.lines.map((line) => line.map((p) => `${p.word}:${p.chord}`).join(","))
  return JSON.stringify([d.songId, d.instrument, d.key, d.capo, d.strum, lines, d.note.trim(), d.isAnonymous, d.playedIt, d.editId ?? null, d.basedOn ?? null, d.startedFrom ?? null, d.keptFrom ?? null])
}
