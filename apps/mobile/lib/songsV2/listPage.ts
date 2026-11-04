import { coverFor, type HomeCoverId } from "@/lib/homeShelves"
import { plainTitle, type CatalogEntry } from "@/lib/songsV2/entry"

/**
 * Pure logic of the playlist-style pages (All songs and a collection): chips, sort, totals, the
 * play queue, the download-all state. No React, no I/O, so every rule is unit tested.
 */

/* ------------------------------------------------------------------ chips */

export type ChipDef = { id: string; label: string }

/** The three chips every list has. */
export const BASE_CHIPS: readonly ChipDef[] = [
  { id: "all", label: "All" },
  { id: "saved", label: "Saved" },
  { id: "downloaded", label: "Downloaded" },
]

/** Categories the app already has (lib/categorySongs ids); a chip shows only when the list holds a song of it. */
export const CATEGORY_CHIPS: readonly ChipDef[] = [
  { id: "morning", label: "Morning" },
  { id: "evening", label: "Evening" },
  { id: "festival", label: "Festival" },
  { id: "meditation", label: "Meditation" },
]

export type ListContext = {
  saved: ReadonlySet<number>
  downloaded: ReadonlySet<number>
  /** category id -> song numbers of that category */
  categories: Readonly<Record<string, ReadonlySet<number>>>
}

/** All, Saved, Downloaded, then the categories that really have songs in this list. */
export function visibleChips(entries: readonly CatalogEntry[], ctx: Pick<ListContext, "categories">): ChipDef[] {
  const inList = new Set(entries.map((e) => e.number))
  const extra = CATEGORY_CHIPS.filter((chip) => {
    const members = ctx.categories[chip.id]
    if (!members || !members.size) return false
    for (const n of members) if (inList.has(n)) return true
    return false
  })
  return [...BASE_CHIPS, ...extra]
}

export function filterByChip(entries: readonly CatalogEntry[], chip: string, ctx: ListContext): CatalogEntry[] {
  switch (chip) {
    case "all":
      return [...entries]
    case "saved":
      return entries.filter((e) => ctx.saved.has(e.number))
    case "downloaded":
      return entries.filter((e) => ctx.downloaded.has(e.number))
    default: {
      const members = ctx.categories[chip]
      return members ? entries.filter((e) => members.has(e.number)) : []
    }
  }
}

/** Drops the songs the listener hid from this list. */
export function withoutHidden(entries: readonly CatalogEntry[], hidden: ReadonlySet<number>): CatalogEntry[] {
  return hidden.size ? entries.filter((e) => !hidden.has(e.number)) : [...entries]
}

/** Text under the list when a chip has no songs. */
export function emptyMessage(chip: string, chipLabel: string): string {
  if (chip === "saved") return "No saved songs here yet. Tap the three dots on a song and choose Save."
  if (chip === "downloaded") return "Nothing downloaded from this list yet."
  return `No ${chipLabel.toLowerCase()} songs in this list.`
}

/* ------------------------------------------------------------------- sort */

export type ListSortKey = "num" | "az" | "duration" | "recent"
export const DEFAULT_LIST_SORT: ListSortKey = "num"

export const LIST_SORTS: readonly { key: ListSortKey; title: string; subtitle: string }[] = [
  { key: "num", title: "Number", subtitle: "The order of the book" },
  { key: "az", title: "A to Z", subtitle: "By the title of the song" },
  { key: "duration", title: "Duration", subtitle: "Shortest first" },
  { key: "recent", title: "Recently played", subtitle: "What you listened to last" },
]

export function isListSort(value: unknown): value is ListSortKey {
  return LIST_SORTS.some((s) => s.key === value)
}

/**
 * Sorts a copy. Duration puts songs of unknown length last; Recently played lists what was played
 * (newest first, `recent` is newest first) and then everything else by number.
 */
export function sortList(entries: readonly CatalogEntry[], key: ListSortKey, recent: readonly number[] = []): CatalogEntry[] {
  const byNumber = (a: CatalogEntry, b: CatalogEntry) => a.number - b.number
  const copy = [...entries]
  switch (key) {
    case "az":
      return copy.sort((a, b) => plainTitle(a.title).localeCompare(plainTitle(b.title)) || byNumber(a, b))
    case "duration":
      return copy.sort((a, b) => {
        const x = a.durationSeconds
        const y = b.durationSeconds
        if (x == null && y == null) return byNumber(a, b)
        if (x == null) return 1
        if (y == null) return -1
        return x - y || byNumber(a, b)
      })
    case "recent": {
      const rank = new Map<number, number>()
      recent.forEach((n, i) => {
        if (!rank.has(n)) rank.set(n, i)
      })
      return copy.sort((a, b) => {
        const x = rank.get(a.number)
        const y = rank.get(b.number)
        if (x == null && y == null) return byNumber(a, b)
        if (x == null) return 1
        if (y == null) return -1
        return x - y
      })
    }
    default:
      return copy.sort(byNumber)
  }
}

/* ----------------------------------------------------------------- totals */

/** Sum of the known lengths, and how many songs had one. */
export function totalSeconds(entries: readonly CatalogEntry[]): { seconds: number; known: number } {
  let seconds = 0
  let known = 0
  for (const e of entries) {
    if (e.durationSeconds != null && e.durationSeconds > 0) {
      seconds += e.durationSeconds
      known += 1
    }
  }
  return { seconds, known }
}

/** 15120 -> "4 h 12 min", 2280 -> "38 min", 7200 -> "2 h". Null when nothing is known. */
export function formatTotal(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  const minutes = Math.max(1, Math.round(seconds / 60))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export function songCountText(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "song" : "songs"}`
}

/** "68 songs · 4 h 12 min"; just the count while no length is known. */
export function metaLine(entries: readonly CatalogEntry[]): string {
  const total = formatTotal(totalSeconds(entries).seconds)
  return total ? `${songCountText(entries.length)} · ${total}` : songCountText(entries.length)
}

/* ------------------------------------------------------------- play queue */

export type PlayPlan = { start: number; queue: number[] }

const unique = (numbers: readonly number[]) => numbers.filter((n, i) => numbers.indexOf(n) === i)

/**
 * Play: the list in the order shown, from the first song (or from `startAt`, a song tapped in the
 * list). A start with no audio moves on to the next song that has some, else stays. Null when empty.
 */
export function buildPlayPlan(
  numbers: readonly number[],
  hasAudio: (n: number) => boolean,
  startAt?: number | null,
): PlayPlan | null {
  const queue = unique(numbers)
  if (!queue.length) return null
  if (startAt != null && queue.includes(startAt)) {
    if (hasAudio(startAt)) return { start: startAt, queue }
    const after = queue.slice(queue.indexOf(startAt) + 1).find(hasAudio)
    return { start: after ?? startAt, queue }
  }
  return { start: queue.find(hasAudio) ?? queue[0], queue }
}

/** Fisher-Yates on a copy; `random` returns [0, 1). */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Shuffle: the same songs in random order, starting at the first one that has audio. */
export function buildShufflePlan(
  numbers: readonly number[],
  hasAudio: (n: number) => boolean,
  random: () => number = Math.random,
): PlayPlan | null {
  return buildPlayPlan(shuffled(unique(numbers), random), hasAudio)
}

/** Where a list starts playing from: stable id and the name the player shows ("Playing from All songs"). */
export function listSourceId(listId: string): string {
  return `songs-v2:${listId}`
}

/* --------------------------------------------------------------- download */

export type DownloadAllState = "idle" | "downloading" | "done"

/** Downloads one request may start; a whole catalog is too much for a phone. */
export const DOWNLOAD_ALL_LIMIT = 100

export function downloadAllState(
  numbers: readonly number[],
  downloaded: ReadonlySet<number>,
  downloading: ReadonlySet<number>,
): DownloadAllState {
  if (numbers.some((n) => downloading.has(n))) return "downloading"
  if (numbers.length > 0 && numbers.every((n) => downloaded.has(n))) return "done"
  return "idle"
}

/** Songs of the list that still need a download (have audio, are not on the phone, not running). */
export function pendingDownloads(
  numbers: readonly number[],
  downloaded: ReadonlySet<number>,
  downloading: ReadonlySet<number>,
  hasAudio: (n: number) => boolean,
): number[] {
  return unique(numbers).filter((n) => hasAudio(n) && !downloaded.has(n) && !downloading.has(n))
}

/* ------------------------------------------------------------------ cover */

/** Up to four different pictures for the collage, taken from the first songs; short lists repeat. */
export function collageCoverIds(numbers: readonly number[]): HomeCoverId[] {
  const ids: HomeCoverId[] = []
  for (const n of numbers) {
    const id = coverFor(n)
    if (!ids.includes(id)) ids.push(id)
    if (ids.length === 4) break
  }
  if (!ids.length) return []
  while (ids.length < 4) ids.push(ids[ids.length % Math.max(1, ids.length)])
  return ids.slice(0, 4)
}

/** Stable accent for a collection: index into the four strip tones from its name. */
export function accentIndex(label: string, size = 4): number {
  // FNV-1a with a final mix, so short names do not all land on the same tone
  let hash = 2166136261
  for (let i = 0; i < label.length; i += 1) hash = Math.imul(hash ^ label.charCodeAt(i), 16777619)
  hash ^= hash >>> 15
  hash = Math.imul(hash, 2246822507)
  hash ^= hash >>> 13
  return (hash >>> 0) % size
}

/* ------------------------------------------------------------------ title */

/** Splits a list name into the light lead word and the heavy rest: "Ánanda Púrńimá" -> ["Ánanda", "Púrńimá"]. */
export function splitTitle(title: string): { lead: string; rest: string } {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return { lead: "", rest: words[0] ?? "" }
  return { lead: words[0], rest: words.slice(1).join(" ") }
}
