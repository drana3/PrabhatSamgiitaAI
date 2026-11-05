import type { PhotoCategory, PhotoMood, StockPhotoMeta } from "@/lib/photos/photoData"

/**
 * Pure picking rules for the stock photos, generic over the list so they run without images (tests).
 * Default picks are warm-first: cool photos (Milky Way, starry lake, lotus on dark or teal) are chosen
 * only for the night and long moods, where a cool, quiet picture fits.
 */

const COOL_OK: readonly PhotoMood[] = ["night", "long"]

/** FNV-1a, 32 bit: stable across runs and devices, so one mix always gets the same photo. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** The pool a seed picks from: warm photos of the mood, cool ones too for night/long; never empty. */
export function pickPool<T extends Pick<StockPhotoMeta, "tone" | "moods">>(list: readonly T[], mood?: PhotoMood): T[] {
  if (list.length === 0) return []
  const allowCool = mood !== undefined && COOL_OK.includes(mood)
  const byTone = list.filter((p) => allowCool || p.tone === "warm")
  const warmFirst = [...byTone].sort((a, b) => Number(a.tone === "cool") - Number(b.tone === "cool"))
  const byMood = mood ? warmFirst.filter((p) => p.moods.includes(mood)) : warmFirst
  if (byMood.length > 0) return byMood
  if (warmFirst.length > 0) return warmFirst
  return [...list]
}

/** Same seed (and mood) gives the same photo; always returns one while the list is not empty. */
export function pickFromList<T extends Pick<StockPhotoMeta, "tone" | "moods">>(list: readonly T[], seed: string, mood?: PhotoMood): T {
  const pool = pickPool(list, mood)
  return pool[hashSeed(seed) % pool.length] as T
}

export function groupByCategory<T extends Pick<StockPhotoMeta, "category">>(list: readonly T[], category: PhotoCategory): T[] {
  return list.filter((p) => p.category === category)
}

/** Mood for a Kiirtan from its title and length: night, morning, evening, long, live or festival. */
export function moodForText(title: string, durationSec?: number | null): PhotoMood | undefined {
  const t = title.toLowerCase()
  if (/\b(night|sleep)\b/.test(t)) return "night"
  if (/\b(morning|dawn|sunrise)\b/.test(t)) return "morning"
  if (/\bevening\b/.test(t)) return "evening"
  if (/\b(dipavali|purnima|festival|akhanda)\b/.test(t)) return "festival"
  if (durationSec != null && durationSec >= 60 * 60) return "long"
  return undefined
}
