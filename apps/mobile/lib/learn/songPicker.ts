import { isCatalogNumberQuery, normalizeLyricText } from "@prabhat/core"

import { displayTitle, type CatalogEntry } from "@/lib/songsV2/entry"

/**
 * Search of the "Add a song to learn" picker. Pure functions over the catalog rows (the same
 * `CatalogEntry` the Songs tab lists), so the tests do not need React or the song index.
 *
 * What a person can type: a song number ("12", "PS 12"), words of the title, or words of the first
 * line. Capitals and diacritics do not matter: "shesete" finds "Sheśete", "ANDHARA" finds "Ándhára".
 */

/** Fixed row height of the picker list, so the list can jump to any row without measuring. */
export const PICKER_ROW_HEIGHT = 68

export type PickerIndexRow = {
  entry: CatalogEntry
  /** title and first line with capitals and marks folded away, ready to search */
  title: string
  line: string
}

/** Fold once per song, not once per key press. */
export function buildPickerIndex(entries: readonly CatalogEntry[]): PickerIndexRow[] {
  return entries.map((entry) => ({
    entry,
    title: normalizeLyricText(entry.title),
    line: normalizeLyricText(entry.firstLine ?? ""),
  }))
}

/** A catalog row from a row of the bundled lyric index (number, title, first line). */
export function entryFromIndexRow(
  row: { n: number; t: string; o?: string | null },
  hasAudio: (number: number) => boolean,
): CatalogEntry {
  const title = displayTitle(row.t)
  const line = row.o ? displayTitle(row.o) : ""
  return {
    number: row.n,
    title,
    // the index repeats the title when the song has no separate opening line
    firstLine: line && line !== title ? line : null,
    category: "",
    language: null,
    durationSeconds: null,
    hasAudio: hasAudio(row.n),
    hasDevanagari: null,
    addedRank: null,
    plays: null,
  }
}

export type PickerQuery =
  | { kind: "all" }
  | { kind: "number"; digits: string }
  | { kind: "words"; tokens: string[] }

/** "12", "PS 12", "ps-12" are numbers; anything else is words. */
export function parsePickerQuery(raw: string): PickerQuery {
  const text = raw.trim()
  if (!text) return { kind: "all" }
  if (isCatalogNumberQuery(text)) {
    const digits = text.replace(/\D+/g, "").replace(/^0+(?=\d)/, "")
    return { kind: "number", digits }
  }
  const tokens = normalizeLyricText(text).split(" ").filter(Boolean)
  return tokens.length ? { kind: "words", tokens } : { kind: "all" }
}

/** 0 = best. A title that starts with the query beats a title that has it inside, which beats the first line. */
function wordScore(row: PickerIndexRow, tokens: readonly string[], phrase: string): number {
  if (row.title.startsWith(phrase)) return 0
  if (tokens.every((token) => row.title.split(" ").some((word) => word.startsWith(token)))) return 1
  if (tokens.every((token) => row.title.includes(token))) return 2
  return 3
}

/**
 * The rows for what is typed.
 *  - nothing typed: every song, in number order;
 *  - a number: songs whose number starts with it, the exact one first;
 *  - words: songs whose title or first line has every word, best match first, then by number.
 * `withAudio` keeps songs that have a recording (a song whose audio is not known stays).
 */
export function searchPicker(
  index: readonly PickerIndexRow[],
  raw: string,
  options: { withAudio?: boolean } = {},
): CatalogEntry[] {
  const query = parsePickerQuery(raw)
  const audioOk = (entry: CatalogEntry) => !options.withAudio || entry.hasAudio !== false

  if (query.kind === "all") {
    return index.filter((row) => audioOk(row.entry)).map((row) => row.entry)
  }

  if (query.kind === "number") {
    const hits = index.filter((row) => audioOk(row.entry) && String(row.entry.number).startsWith(query.digits))
    const exact = hits.filter((row) => String(row.entry.number) === query.digits)
    const rest = hits.filter((row) => String(row.entry.number) !== query.digits)
    return [...exact, ...rest].map((row) => row.entry)
  }

  const phrase = query.tokens.join(" ")
  const scored: Array<{ entry: CatalogEntry; score: number }> = []
  for (const row of index) {
    if (!audioOk(row.entry)) continue
    const haystack = `${row.title} ${row.line}`
    if (!query.tokens.every((token) => haystack.includes(token))) continue
    scored.push({ entry: row.entry, score: wordScore(row, query.tokens, phrase) })
  }
  scored.sort((a, b) => a.score - b.score || a.entry.number - b.entry.number)
  return scored.map((hit) => hit.entry)
}

/** "No song matches “xyz”" needs the typed words trimmed the way the field shows them. */
export function queryLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}
