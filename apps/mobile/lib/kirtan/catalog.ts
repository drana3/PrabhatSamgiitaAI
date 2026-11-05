import { KIRTAN_FIXTURES } from "@/lib/fixtures/kirtan"
import { approvedOnly, newestFirst } from "@/lib/kirtan/list"
import { kiirtanSongForNumber, registerKiirtans } from "@/lib/kirtan/track"
import type { Kirtan } from "@/lib/kirtan/types"
import type { MockSong } from "@/data/mock"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * The Kiirtans the app can play, outside React: the sample catalog plus the person's own submissions.
 * (The hook `useKirtans` gives the same data to screens.)
 * TODO(api): the catalog comes from the backend.
 */
export function allKirtans(): Kirtan[] {
  return [...KIRTAN_FIXTURES, ...useKirtanStore.getState().submissions]
}

/** Approved Kiirtans, newest first. */
export function approvedKirtans(): Kirtan[] {
  return newestFirst(approvedOnly(allKirtans()))
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
