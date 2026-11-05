import { sampleKirtans } from "@/lib/fixtures/kirtanGate"
import { mergeCatalog, publishedOnly, newestFirst } from "@/lib/kirtan/list"
import { kiirtanSongForNumber, registerKiirtans } from "@/lib/kirtan/track"
import type { Kirtan } from "@/lib/kirtan/types"
import type { MockSong } from "@/data/mock"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * The Kiirtans the app can play, outside React: the person's own uploads, what the server publishes (minus the authors
 * they blocked) and the demo samples (empty outside the preview).
 * (The hook `useKirtans` gives the same data to screens.)
 */
export function allKirtans(): Kirtan[] {
  const { submissions, catalog, blockedAuthorIds } = useKirtanStore.getState()
  return mergeCatalog(submissions, catalog, sampleKirtans(), blockedAuthorIds)
}

/** Published Kiirtans, newest first. */
export function publishedKirtans(): Kirtan[] {
  return newestFirst(publishedOnly(allKirtans()))
}

export function kirtanById(id: string): Kirtan | null {
  return allKirtans().find((k) => k.id === id) ?? null
}

/** Hands out queue numbers for every known Kiirtan, so a number found in a queue can be turned back into a track. */
export function ensureKirtansRegistered(): void {
  registerKiirtans(allKirtans())
}

/** The track record behind a Kiirtan queue number. */
export function kiirtanSongByNumber(n: number): MockSong | null {
  ensureKirtansRegistered()
  return kiirtanSongForNumber(n)
}
