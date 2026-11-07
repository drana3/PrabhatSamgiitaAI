import type { SongSummary } from "@prabhat/core"
import { create } from "zustand"

import type { CatalogLoadResult } from "@/lib/catalog"
import { REAL_SONGS_1_TO_7 } from "@/lib/fixtures/realSongs"
import { displayTitle } from "@/lib/songsV2/entry"

/**
 * Catalog of the web preview (MOCKUP_DATA, see lib/mockupMode.ts). It is loaded through the same
 * code as the real build (cache first, then lib/catalog.ts loadCatalog), so the preview shows the
 * live 5,018 songs. When the API cannot be reached and nothing is cached, it falls back to the
 * seven real songs in lib/fixtures/realSongs.ts and says so quietly (`notice`).
 *
 * This file is light (no network, no bundled JSON) so fixtures can use it; the loader that fills the
 * store is lib/previewCatalogLoader.ts.
 *
 * The store also answers the plain question "what is song N called?" for code that is not a React
 * hook (the demo player, sample fixtures): `previewTitle`.
 */

export type PreviewCatalogSource = "fallback" | "cache" | "api"

export const FALLBACK_NOTICE = "Offline sample: the song API could not be reached."

type PreviewCatalogState = {
  rows: SongSummary[]
  source: PreviewCatalogSource
  /** Shown quietly next to the count when the sample stands in for the catalog. */
  notice: string | null
  /** true until the first rows (cached, fresh or the sample) have arrived */
  loading: boolean
  refreshing: boolean
}

export const usePreviewCatalog = create<PreviewCatalogState>(() => ({
  rows: [],
  source: "fallback",
  notice: null,
  loading: true,
  refreshing: false,
}))

/** What a finished catalog load means for the preview: the rows to show, where they came from, the note. */
export function resolvePreviewRows(
  result: Pick<CatalogLoadResult, "songs" | "fromCache">,
): { rows: SongSummary[]; source: PreviewCatalogSource; notice: string | null } {
  if (result.songs.length) {
    return { rows: result.songs, source: result.fromCache ? "cache" : "api", notice: null }
  }
  return { rows: [...REAL_SONGS_1_TO_7], source: "fallback", notice: FALLBACK_NOTICE }
}

const FALLBACK_BY_NUMBER = new Map(REAL_SONGS_1_TO_7.map((row) => [row.number, row] as const))
let indexedRows: SongSummary[] | null = null
let indexed = new Map<number, SongSummary>()

/** The catalog row of a song, from the loaded catalog or (for PS 1 to 7) the built-in real rows. */
export function previewSummary(number: number): SongSummary | undefined {
  const { rows } = usePreviewCatalog.getState()
  if (rows !== indexedRows) {
    indexedRows = rows
    indexed = new Map(rows.map((row) => [row.number, row] as const))
  }
  return indexed.get(number) ?? FALLBACK_BY_NUMBER.get(number)
}

/** "Bandhu He Niye Calo" for 1, or undefined when the catalog has not loaded that song (yet). */
export function previewTitle(number: number): string | undefined {
  const row = previewSummary(number)
  return row ? displayTitle(row.title) : undefined
}

/** Title for a fixture row: the catalog's, else "Prabhat Samgiita N". Never an invented name. */
export function previewTitleOrNumber(number: number): string {
  return previewTitle(number) ?? `Prabhat Samgiita ${number}`
}
