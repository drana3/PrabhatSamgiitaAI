import {
  confidentLyricHits,
  searchLyrics,
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

function loadCatalogRows(): LyricSearchRow[] {
  if (catalogRows) return catalogRows
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rows = require("../../../data/generated/lyric_search_index.json") as LyricSearchRow[]
    catalogRows = Array.isArray(rows) ? rows : []
  } catch {
    catalogRows = []
  }
  return catalogRows
}

export function warmLyricSearchIndex() {
  loadCatalogRows()
}

export function catalogLyricCount() {
  return loadCatalogRows().length
}

export function searchCatalogLyrics(query: string, limit = 5): LyricSearchHit[] {
  const rows = loadCatalogRows()
  if (!rows.length) return []
  return confidentLyricHits(searchLyrics(query, rows, limit))
}
