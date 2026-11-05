import type { MixItem } from "@/lib/kirtan/mix"
import { kiirtanNumber } from "@/lib/kirtan/track"
import type { KindFilter, Kirtan } from "@/lib/kirtan/types"

/**
 * Building the ONE queue of the player from Prabhat Samgiita songs and Kiirtans.
 * A queue is a list of numbers: a song is its catalog number, a Kiirtan its synthetic number
 * (lib/kirtan/track.ts). Pure, no React, no stores; the random source is injectable for tests.
 */

/** Names shown after "Playing from" for the sources that only Kiirtans and mixes have. */
export const SOURCE_ALL_KIIRTANS = "All Kiirtans"
export const SOURCE_ALL_BHAJANS = "All Bhajans"
export const SOURCE_ALL_RECORDINGS = "All Kiirtans and Bhajans"
export const SOURCE_EVERYTHING = "Everything"

/** `Mix · Morning`. */
export function mixSourceName(title: string): string {
  return `Mix · ${title}`
}

/**
 * Source name of a Kiirtan or Bhajan list: the type filter's label plus the kind's noun ("Lila Kiirtans",
 * "Morning Bhajans"), or "All Kiirtans" / "All Bhajans" / "All Kiirtans and Bhajans". `kind` is what the
 * list holds ("all" for a mix of both); it defaults to Kiirtans.
 */
export function kiirtanListSourceName(label: string | null | undefined, kind: KindFilter = "kiirtan"): string {
  const text = (label ?? "").trim()
  const noun = kind === "bhajan" ? "Bhajans" : kind === "all" ? "Kiirtans and Bhajans" : "Kiirtans"
  if (text && text.toLowerCase() !== "all") return `${text} ${noun}`
  return kind === "bhajan" ? SOURCE_ALL_BHAJANS : kind === "all" ? SOURCE_ALL_RECORDINGS : SOURCE_ALL_KIIRTANS
}

/** The queue number of one mix item. */
export function mixItemNumber(item: MixItem): number {
  return item.kind === "ps" ? item.number : kiirtanNumber(item.id)
}

/**
 * The queue of a mix: every item in order, PS and Kiirtan together. Kiirtans that are not published
 * (or unknown) are left out, the order of the rest is kept.
 */
export function mixQueue(items: readonly MixItem[], kirtans: ReadonlyMap<string, Pick<Kirtan, "status">>): number[] {
  return items
    .filter((item) => item.kind === "ps" || kirtans.get(item.id)?.status === "published")
    .map(mixItemNumber)
}

/** Queue numbers of a Kiirtan list, in the order shown. */
export function kiirtanQueue(list: readonly Pick<Kirtan, "id">[]): number[] {
  return list.map((k) => kiirtanNumber(k.id))
}

/** Fisher-Yates on a copy. */
export function shuffled<T>(list: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}

/**
 * "Shuffle everything": all Prabhat Samgiita songs with audio plus all published Kiirtans, shuffled
 * together into one queue. Each number appears once.
 */
export function everythingQueue(
  psNumbers: readonly number[],
  publishedKiirtans: readonly Pick<Kirtan, "id" | "status">[],
  rng: () => number = Math.random,
): number[] {
  const kiirtans = publishedKiirtans.filter((k) => k.status === "published").map((k) => kiirtanNumber(k.id))
  return shuffled([...new Set([...psNumbers, ...kiirtans])], rng)
}

/** Where a queue starts: the asked number if it is in the list, else the first. null for an empty queue. */
export function startOf(queue: readonly number[], wanted?: number | null): number | null {
  if (!queue.length) return null
  return wanted != null && queue.includes(wanted) ? wanted : (queue[0] as number)
}

/** `3 songs + 2 kiirtans` for an already built queue of numbers. */
export function queueCaption(queue: readonly number[], isKiirtan: (n: number) => boolean): string {
  const kiirtans = queue.filter(isKiirtan).length
  const songs = queue.length - kiirtans
  const parts: string[] = []
  if (songs) parts.push(`${songs} ${songs === 1 ? "song" : "songs"}`)
  if (kiirtans) parts.push(`${kiirtans} ${kiirtans === 1 ? "kiirtan" : "kiirtans"}`)
  return parts.length ? parts.join(" + ") : "Empty"
}
