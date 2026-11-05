/**
 * Pure logic of the library proposal (/library-proposal): a Spotify-library-style view of what
 * Songs > Mine holds. Items are built from real counts or from the preview fixtures.
 */
export type LibraryFilterId = "playlists" | "downloads" | "saved" | "kiirtan" | "learning"

export const LIBRARY_FILTERS: readonly { id: LibraryFilterId; label: string }[] = [
  { id: "playlists", label: "Playlists" },
  { id: "downloads", label: "Downloads" },
  { id: "saved", label: "Saved" },
  { id: "kiirtan", label: "Kiirtan" },
  { id: "learning", label: "Learning" },
]

export type LibraryItem = {
  id: string
  kind: LibraryFilterId
  title: string
  /** "Playlist · 12 songs" */
  sub: string
  /** a song number whose cover the row uses */
  coverNumber: number
  /** the app route a tap opens */
  target: string
}

export function typeLabel(kind: LibraryFilterId): string {
  return kind === "playlists" ? "Playlist" : kind === "downloads" ? "Downloads" : kind === "saved" ? "Saved" : kind === "kiirtan" ? "Kiirtan" : "Learning"
}

export function countLabel(count: number, noun = "song"): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`
}

/** One chip filters to its kind; no chip selected (null) shows everything, newest first as given. */
export function filterLibrary(items: readonly LibraryItem[], filter: LibraryFilterId | null): LibraryItem[] {
  return filter ? items.filter((i) => i.kind === filter) : [...items]
}

export type LibraryLayout = "list" | "grid"

export function nextLayout(layout: LibraryLayout): LibraryLayout {
  return layout === "list" ? "grid" : "list"
}

export type LibraryInputs = {
  playlists: readonly { id: string; name: string; count: number }[]
  savedCount: number
  downloadCount: number
  /** words due today, 0 hides the row */
  wordsDue: number
  /** saved Kiirtans and the person's own uploads; 0 or left out hides the row */
  savedKiirtanCount?: number
  uploadCount?: number
}

/** Real counts to rows. Empty collections with no way in are left out. */
export function buildLibraryItems(input: LibraryInputs): LibraryItem[] {
  const items: LibraryItem[] = []
  if (input.wordsDue > 0) {
    items.push({ id: "words", kind: "learning", title: "Words to repeat", sub: `Learning · ${countLabel(input.wordsDue, "word")} due`, coverNumber: 7, target: "/learn/words" })
  }
  if (input.savedCount > 0) {
    items.push({ id: "saved", kind: "saved", title: "Saved songs", sub: `Saved · ${countLabel(input.savedCount)}`, coverNumber: 1, target: "/songs-v2?segment=mine" })
  }
  if (input.downloadCount > 0) {
    items.push({ id: "downloads", kind: "downloads", title: "Downloaded songs", sub: `Downloads · ${countLabel(input.downloadCount)}`, coverNumber: 4, target: "/songs-v2?segment=mine" })
  }
  if ((input.savedKiirtanCount ?? 0) > 0) {
    items.push({ id: "kiirtan-saved", kind: "kiirtan", title: "Saved Kiirtans", sub: `Kiirtan · ${countLabel(input.savedKiirtanCount ?? 0, "Kiirtan")}`, coverNumber: 5, target: "/v2/kiirtan?filter=saved" })
  }
  if ((input.uploadCount ?? 0) > 0) {
    items.push({ id: "kiirtan-mine", kind: "kiirtan", title: "My uploads", sub: `Kiirtan · ${countLabel(input.uploadCount ?? 0, "upload")}`, coverNumber: 6, target: "/v2/kiirtan?filter=mine" })
  }
  input.playlists.forEach((pl, i) => {
    items.push({ id: `pl-${pl.id}`, kind: "playlists", title: pl.name, sub: `Playlist · ${countLabel(pl.count)}`, coverNumber: i + 2, target: `/playlist-v2/${pl.id}` })
  })
  return items
}
