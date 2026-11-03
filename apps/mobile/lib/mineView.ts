/**
 * Pure view logic for the "Mine" content (spec SCR-11): which state a list is in,
 * row eyebrows and the sync status line. No React Native imports.
 */

export type ListViewState = "loading" | "empty" | "list"

/** Mine never shows a spinner and an empty state at the same time. */
export function listViewState(input: { loading: boolean; count: number }): ListViewState {
  if (input.count > 0) return "list"
  return input.loading ? "loading" : "empty"
}

/** `9 songs · made by you` (spec SCR-11 item 7). */
export function playlistMeta(songCount: number): string {
  if (songCount <= 0) return "No songs yet · made by you"
  return `${songCount} ${songCount === 1 ? "song" : "songs"} · made by you`
}

/** `PS 3` or `PS 3 · Offline` (spec SCR-20: a downloaded song shows Offline everywhere). */
export function songEyebrow(number: number, offline: boolean): string {
  return offline ? `PS ${number} · Offline` : `PS ${number}`
}

/** Saved songs are stored oldest first; Mine shows the newest on top. Duplicates removed. */
export function savedNewestFirst(numbers: readonly number[]): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (let i = numbers.length - 1; i >= 0; i -= 1) {
    const n = numbers[i]
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

/** Row on Mine that opens Storage: `No downloads yet` or `4 recordings · 16.9 MB`. */
export function downloadsRowSummary(count: number, sizeLabel: string): string {
  if (count <= 0) return "No downloads yet"
  return `${count} ${count === 1 ? "recording" : "recordings"} · ${sizeLabel}`
}

export type SyncStatus =
  | { kind: "hidden" }
  | { kind: "local"; text: string }
  | { kind: "syncing"; text: string }
  | { kind: "error"; text: string }

/** One quiet line about playlist sync. An error always wins over "syncing". */
export function mineSyncStatus(input: {
  mode: "guest" | "signed_in"
  syncAvailable: boolean
  syncing: boolean
  error: string | null
}): SyncStatus {
  if (input.mode !== "signed_in") {
    return { kind: "local", text: "Sign in to keep playlists and sync saved songs across devices." }
  }
  if (!input.syncAvailable) {
    return { kind: "local", text: "This build cannot sync playlists with your account yet." }
  }
  if (input.error) return { kind: "error", text: input.error }
  if (input.syncing) return { kind: "syncing", text: "Syncing your changes…" }
  return { kind: "hidden" }
}

/** Row title for a catalog hit, or the bare number when the song is not in the catalog. */
export function songTitleFromHit(
  hit: { firstLine?: string | null; title?: string | null } | null | undefined,
  number: number,
): string {
  return hit?.firstLine?.trim() || hit?.title?.trim() || `Prabhat Samgiita ${number}`
}
