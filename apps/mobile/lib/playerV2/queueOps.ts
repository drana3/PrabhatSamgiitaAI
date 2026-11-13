import { t } from "@/lib/i18n"
/** Pure queue operations (spec SCR-12 item 8, PLR-04). Queues are lists of catalog numbers. */

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return [...list]
  const target = Math.max(0, Math.min(list.length - 1, to))
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(target, 0, item as T)
  return copy
}

export function removeNumber(queue: readonly number[], number: number): number[] {
  return queue.filter((n) => n !== number)
}

/** Insert right after the current song; a number already queued moves there. */
export function playNext(queue: readonly number[], current: number | null, number: number): number[] {
  const without = removeNumber(queue, number)
  const at = current == null ? -1 : without.indexOf(current)
  const copy = [...without]
  copy.splice(at + 1, 0, number)
  return copy
}

export function addToQueue(queue: readonly number[], number: number): number[] {
  return queue.includes(number) ? [...queue] : [...queue, number]
}

/** Drop everything after the current song. */
export function clearUpcoming(queue: readonly number[], current: number | null): number[] {
  if (current == null) return []
  const at = queue.indexOf(current)
  return at < 0 ? [current] : queue.slice(0, at + 1)
}

/** Shuffle what comes after the current song; played songs and the current one stay put. */
export function shuffleUpcoming(
  queue: readonly number[],
  current: number | null,
  rng: () => number = Math.random,
): number[] {
  const at = current == null ? -1 : queue.indexOf(current)
  const head = queue.slice(0, at + 1)
  const tail = queue.slice(at + 1)
  for (let i = tail.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[tail[i], tail[j]] = [tail[j] as number, tail[i] as number]
  }
  return [...head, ...tail]
}

/**
 * Undo a shuffle. Songs removed meanwhile stay removed, songs added meanwhile
 * go to the end in their current order.
 */
export function restoreOrder(current: readonly number[], original: readonly number[]): number[] {
  const present = new Set(current)
  const kept = original.filter((n) => present.has(n))
  const known = new Set(original)
  return [...kept, ...current.filter((n) => !known.has(n))]
}

/**
 * Next or previous playable number. Unplayable songs are skipped (PLR-04);
 * `wrap` continues from the other end (repeat all).
 */
export function stepPlayable(
  queue: readonly number[],
  current: number,
  direction: 1 | -1,
  isPlayable: (n: number) => boolean,
  wrap = false,
): number | null {
  const at = queue.indexOf(current)
  if (at < 0 || queue.length < 2) return null
  for (let step = 1; step < queue.length; step += 1) {
    let index = at + direction * step
    if (index < 0 || index >= queue.length) {
      if (!wrap) return null
      index = (index + queue.length) % queue.length
    }
    const candidate = queue[index] as number
    if (isPlayable(candidate)) return candidate
  }
  return null
}

export type QueueOrigin = "Mine" | "Catalog"

/** "from Mine / from Catalog" caption on a queue row. */
export function queueOrigin(number: number, savedNumbers: ReadonlySet<number>): QueueOrigin {
  return savedNumbers.has(number) ? "Mine" : "Catalog"
}

export type SourceInput = {
  playbackMode: "default" | "playlist" | "random"
  playlistName: string | null
  /** Optional caller-supplied label (Today, a collection). */
  override?: string | null
}

/** `Playing from <source>` chip text. */
export function sourceLabel(input: SourceInput): string {
  if (input.override?.trim()) return input.override.trim()
  if (input.playbackMode === "playlist") return input.playlistName?.trim() || t("player.playlist")
  if (input.playbackMode === "random") return t("player.source.random")
  return t("songs.allSongs")
}
