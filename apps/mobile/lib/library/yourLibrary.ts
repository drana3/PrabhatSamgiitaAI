import { formatBytes } from "@/lib/storageCache"

/**
 * Pure logic of "Your library" (/library-v2), opened from the profile sheet: everything that is the
 * person's own in one list, Spotify style. Rows are built from counts the stores already hold, filtered
 * by a chip and a name search, all on the phone. No React, no I/O.
 *
 * A row can belong to more than one chip: Mine, every playlist and Downloads are all songs; the saved
 * Kiirtans and the uploads are all Kiirtans.
 */

export type LibraryChipId = "all" | "songs" | "kiirtans" | "playlists" | "downloads" | "uploads"

export const LIBRARY_CHIPS: readonly { id: LibraryChipId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "songs", label: "Songs" },
  { id: "kiirtans", label: "Kiirtans" },
  { id: "playlists", label: "Playlists" },
  { id: "downloads", label: "Downloads" },
  { id: "uploads", label: "Uploads" },
]

export function isLibraryChip(value: unknown): value is LibraryChipId {
  return LIBRARY_CHIPS.some((c) => c.id === value)
}

/** What the row's picture is: a symbol tile, or a collage of the first songs of a playlist. */
export type LibraryCover =
  | { kind: "mine" }
  | { kind: "kiirtans" }
  | { kind: "downloads" }
  | { kind: "uploads" }
  | { kind: "playlist"; numbers: number[] }

export type LibraryRow = {
  id: string
  title: string
  /** one line: "Playlist · 12 songs" */
  meta: string
  /** app route a tap opens */
  target: string
  cover: LibraryCover
  chips: LibraryChipId[]
  /** extra words the search matches besides the title ("saved" finds Mine) */
  keywords: string[]
  /** ms since epoch of the last use, when the app knows it */
  recentAt: number | null
}

export type LibraryInput = {
  /** songs in Mine (preferencesStore.savedSongIds) */
  savedSongCount: number
  /** Kiirtans the person saved (kirtanStore.savedIds) */
  savedKiirtanCount: number
  /** downloaded songs; `bytes` is null while the sizes are still being read */
  downloads: { count: number; bytes: number | null }
  /** the person's own Kiirtan uploads, `pending` of them in review */
  uploads: { total: number; pending: number }
  /** the person's playlists in store order (oldest first) */
  playlists: readonly { id: string; name: string; songNumbers: readonly number[] }[]
  /** last-use times where the app has them */
  recent?: { mineAt?: number | null; uploadsAt?: number | null }
}

/** Where each row leads. Songs and Kiirtan screens read the chip from the query. */
export const LIBRARY_TARGETS = {
  mine: "/songs-v2?chip=saved",
  kiirtansSaved: "/v2/kiirtan?filter=saved",
  uploads: "/v2/kiirtan?filter=mine",
  downloads: "/storage",
  playlist: (id: string) => `/playlist-v2/${id}`,
} as const

export function songCountLabel(count: number): string {
  return `${count} ${count === 1 ? "song" : "songs"}`
}

export function downloadsMeta(count: number, bytes: number | null): string {
  if (count <= 0) return "On this phone · nothing yet"
  if (bytes == null || bytes <= 0) return `On this phone · ${songCountLabel(count)}`
  return `On this phone · ${songCountLabel(count)} · ${formatBytes(bytes)}`
}

export function uploadsMeta(total: number, pending: number): string {
  if (pending > 0) return `Your recordings · ${pending} in review`
  if (total > 0) return `Your recordings · ${total}`
  return "Your recordings · none yet"
}

export function savedSongsMeta(count: number): string {
  return count > 0 ? `Saved songs · ${count}` : "Saved songs · none yet"
}

export function savedKiirtansMeta(count: number): string {
  return count > 0 ? `Kiirtans · ${count} saved` : "Kiirtans · none saved yet"
}

/**
 * The rows, in the order Dada gave: Mine, saved Kiirtans, the playlists (newest first), Downloads, My uploads.
 * Rows with a known last-use time come first, newest use first; the rest keep that order.
 */
export function buildLibraryRows(input: LibraryInput): LibraryRow[] {
  const base: LibraryRow[] = [
    {
      id: "mine",
      title: "Mine",
      meta: savedSongsMeta(input.savedSongCount),
      target: LIBRARY_TARGETS.mine,
      cover: { kind: "mine" },
      chips: ["songs"],
      keywords: ["saved", "songs", "favourites", "favorites", "liked"],
      recentAt: input.recent?.mineAt ?? null,
    },
    {
      id: "kiirtans-saved",
      title: "Saved Kiirtans",
      meta: savedKiirtansMeta(input.savedKiirtanCount),
      target: LIBRARY_TARGETS.kiirtansSaved,
      cover: { kind: "kiirtans" },
      chips: ["kiirtans"],
      keywords: ["kiirtan", "kiirtans", "saved"],
      recentAt: null,
    },
    ...[...input.playlists].reverse().map(
      (pl): LibraryRow => ({
        id: `pl-${pl.id}`,
        title: pl.name,
        meta: `Playlist · ${songCountLabel(pl.songNumbers.length)}`,
        target: LIBRARY_TARGETS.playlist(pl.id),
        cover: { kind: "playlist", numbers: pl.songNumbers.slice(0, 4) as number[] },
        chips: ["songs", "playlists"],
        keywords: ["playlist"],
        recentAt: null,
      }),
    ),
    {
      id: "downloads",
      title: "Downloads",
      meta: downloadsMeta(input.downloads.count, input.downloads.bytes),
      target: LIBRARY_TARGETS.downloads,
      cover: { kind: "downloads" },
      chips: ["songs", "downloads"],
      keywords: ["downloaded", "offline", "storage", "phone"],
      recentAt: null,
    },
    {
      id: "uploads",
      title: "My uploads",
      meta: uploadsMeta(input.uploads.total, input.uploads.pending),
      target: LIBRARY_TARGETS.uploads,
      cover: { kind: "uploads" },
      chips: ["kiirtans", "uploads"],
      keywords: ["kiirtan", "kiirtans", "recordings", "review"],
      recentAt: input.recent?.uploadsAt ?? null,
    },
  ]
  return orderByRecent(base)
}

/** Rows with a use time first (newest first), then the others in the order given. Never mutates. */
export function orderByRecent<T extends { recentAt: number | null }>(rows: readonly T[]): T[] {
  const used = rows.filter((r) => r.recentAt != null).sort((a, b) => (b.recentAt as number) - (a.recentAt as number))
  const rest = rows.filter((r) => r.recentAt == null)
  return [...used, ...rest]
}

function normal(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ")
}

/** A chip, then the name search: the words typed must each appear in the title or a keyword. */
export function filterLibraryRows(rows: readonly LibraryRow[], chip: LibraryChipId, query: string): LibraryRow[] {
  const byChip = chip === "all" ? [...rows] : rows.filter((r) => r.chips.includes(chip))
  const words = normal(query).split(" ").filter(Boolean)
  if (!words.length) return byChip
  return byChip.filter((r) => {
    const haystack = [normal(r.title), ...r.keywords.map(normal)].join(" ")
    return words.every((w) => haystack.includes(w))
  })
}

/** "New playlist" heads the list on the chips where a playlist belongs, and never while searching. */
export function showNewPlaylistRow(chip: LibraryChipId, query: string): boolean {
  if (normal(query)) return false
  return chip === "all" || chip === "songs" || chip === "playlists"
}

/** Guests see the invitation to sign in on top; the local rows still show under it. */
export function showSignInInvite(signedIn: boolean): boolean {
  return !signedIn
}

export const INVITE_TITLE = "Sign in to keep songs and playlists"
export const INVITE_BODY = "They follow you to every phone. What is saved on this phone stays here too."

export function emptyLibraryText(chip: LibraryChipId, query: string): string {
  const q = query.trim()
  if (q) return `Nothing called “${q}” in your library.`
  const label = LIBRARY_CHIPS.find((c) => c.id === chip)?.label.toLowerCase() ?? "library"
  return chip === "all" ? "Your library is empty for now." : `No ${label} here yet.`
}
