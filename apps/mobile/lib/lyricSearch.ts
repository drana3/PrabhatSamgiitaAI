import {
  confidentLyricHits,
  interpretLyricHits,
  isCatalogNumberQuery,
  isMeaningCatalogQuery,
  mergeLyricAndMeaningHits,
  normalizeLyricText,
  prepareLyricSearch,
  searchLyrics,
  searchMeanings,
  stripCatalogSearchFraming,
  type LyricSearchHit,
  type LyricSearchRow,
} from "@prabhat/core"

export {
  isCatalogNumberQuery,
  isLyricCatalogQuery,
  normalizeLyricText,
  searchLyrics,
  type LyricSearchHit,
  type LyricSearchRow,
} from "@prabhat/core"

let catalogRows: LyricSearchRow[] | undefined
let rowsByNumber: Map<number, LyricSearchRow> | undefined

function loadCatalogRows(): LyricSearchRow[] {
  if (catalogRows) return catalogRows
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rows = require("../../../data/generated/lyric_search_index.json") as LyricSearchRow[]
    catalogRows = Array.isArray(rows) ? rows : []
  } catch {
    catalogRows = []
  }
  rowsByNumber = new Map(catalogRows.map((row) => [row.n, row]))
  return catalogRows
}

export function warmLyricSearchIndex() {
  prepareLyricSearch(loadCatalogRows())
}

export function catalogLyricCount() {
  return loadCatalogRows().length
}

export function catalogSongByNumber(query: string): LyricSearchHit | null {
  if (!isCatalogNumberQuery(query)) return null
  const number = Number.parseInt(query.replace(/\D+/g, ""), 10)
  loadCatalogRows()
  const row = rowsByNumber?.get(number)
  if (!row) return null
  return {
    number: row.n,
    title: row.t,
    firstLine: row.o,
    snippet: row.o || row.t,
    score: 100,
    matchedBy: "opening_line",
  }
}

export function catalogSongsByNumbers(numbers: number[], limit = 5): LyricSearchHit[] {
  loadCatalogRows()
  const hits: LyricSearchHit[] = []
  for (const number of numbers) {
    const row = rowsByNumber?.get(number)
    if (!row) continue
    hits.push({
      number: row.n,
      title: row.t,
      firstLine: row.o,
      snippet: row.o || row.t,
      score: 100,
      matchedBy: "opening_line",
    })
    if (hits.length >= limit) break
  }
  return hits
}

export function searchCatalogLyrics(
  query: string,
  limit = 5,
  options?: { interpret?: boolean },
): LyricSearchHit[] {
  const rows = loadCatalogRows()
  if (!rows.length) return []
  const pickLyrics = (value: string) => {
    const hits = searchLyrics(value, rows, limit)
    return options?.interpret ? interpretLyricHits(hits) : confidentLyricHits(hits)
  }
  const pickMeanings = (value: string) => {
    const hits = searchMeanings(value, rows, limit)
    return options?.interpret ? interpretLyricHits(hits) : hits.filter((hit) => hit.score >= 30)
  }
  const primary = pickLyrics(query)
  const meaningPrimary =
    primary.length && !isMeaningCatalogQuery(query) ? [] : pickMeanings(query)
  if (primary.length || meaningPrimary.length) {
    return mergeLyricAndMeaningHits(primary, meaningPrimary, limit)
  }
  const stripped = stripCatalogSearchFraming(query)
  if (stripped && stripped !== normalizeLyricText(query)) {
    return mergeLyricAndMeaningHits(pickLyrics(stripped), pickMeanings(stripped), limit)
  }
  return []
}

/**
 * Word-gloss search on its own. `searchCatalogLyrics` skips meanings when a lyric
 * line already matched a short query, and the core meaning search refuses a single
 * short word, so "friend" would miss PS 1 (spec SCR-13: "Word match also searches
 * the word glosses"). Used by the unified search.
 */
export function searchCatalogGlosses(query: string, limit = 5): LyricSearchHit[] {
  const rows = loadCatalogRows()
  if (!rows.length) return []
  const normalized = normalizeLyricText(query)
  const tokens = normalized.split(" ").filter(Boolean)
  if (tokens.length !== 1) return searchMeanings(query, rows, limit).filter((hit) => hit.score >= 30)
  return singleWordGlossHits(tokens[0], rows, limit)
}

const MIN_GLOSS_WORD = 4

/** Rows whose English meaning uses the word (or a longer form of it), most uses first. */
export function singleWordGlossHits(
  word: string,
  rows: LyricSearchRow[],
  limit = 5,
): LyricSearchHit[] {
  if (word.length < MIN_GLOSS_WORD) return []
  const needle = ` ${word}`
  const scored: Array<{ row: LyricSearchRow; uses: number }> = []
  for (const row of rows) {
    if (!row.e) continue
    const haystack = ` ${row.e}`
    let uses = 0
    let at = haystack.indexOf(needle)
    while (at !== -1) {
      uses += 1
      at = haystack.indexOf(needle, at + needle.length)
    }
    if (uses) scored.push({ row, uses })
  }
  scored.sort((a, b) => b.uses - a.uses || a.row.n - b.row.n)
  return scored.slice(0, Math.max(1, limit)).map(({ row, uses }) => ({
    number: row.n,
    title: row.t,
    firstLine: row.o,
    snippet: row.o || row.t,
    score: 30 + Math.min(uses, 20),
    matchedBy: "meaning" as const,
  }))
}
