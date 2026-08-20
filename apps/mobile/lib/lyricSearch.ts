import {
  confidentLyricHits,
  interpretLyricHits,
  isCatalogNumberQuery,
  mergeLyricAndMeaningHits,
  normalizeLyricText,
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
  loadCatalogRows()
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
  const meaningPrimary = pickMeanings(query)
  if (primary.length || meaningPrimary.length) {
    return mergeLyricAndMeaningHits(primary, meaningPrimary, limit)
  }
  const stripped = stripCatalogSearchFraming(query)
  if (stripped && stripped !== normalizeLyricText(query)) {
    return mergeLyricAndMeaningHits(pickLyrics(stripped), pickMeanings(stripped), limit)
  }
  return []
}
