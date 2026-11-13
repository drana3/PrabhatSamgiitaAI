import type { PhotoCategory, PhotoMood, PhotoPeople, StockPhotoMeta } from "@/lib/photos/photoData"

/**
 * Pure picking rules for the stock photos, generic over the list so they run without images (tests).
 * - Warm first: cool photos (Milky Way, starry lake, lotus on dark or teal) are chosen only for the night and
 *   long moods, where a cool, quiet picture fits.
 * - People: photos with `close` or `children` are never picked unless the caller opts in with `allowPeople`
 *   (Stories, About). Calm moods (night, long, morning) prefer `none` or `far` even then.
 * - Baba: a photo with `subject: "baba"` is never picked (his photographs are shown only by BabaPhoto, never under text).
 * - Resolution: `lowRes` photos (long side under 1000 px) are picked only for `size: "small"` (small covers,
 *   thumbnails), never for a full-bleed hero.
 */

const COOL_OK: readonly PhotoMood[] = ["night", "long"]
const CALM_MOODS: readonly PhotoMood[] = ["night", "long", "morning"]
const PEOPLE_OK: readonly PhotoPeople[] = ["none", "far"]

export type PickOptions = {
  /** allow `close` and `children` photos (default false) */
  allowPeople?: boolean
  /** "small" also allows `lowRes` photos (default: large, they are excluded) */
  size?: "small" | "large"
}

type Pickable = Pick<StockPhotoMeta, "tone" | "moods"> & Partial<Pick<StockPhotoMeta, "people" | "lowRes" | "subject">>

/** FNV-1a, 32 bit: stable across runs and devices, so one mix always gets the same photo. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * The pool a seed picks from: eligible photos (people and resolution rules above), warm ones of the mood,
 * cool ones too for night/long. Empty only when the list is empty or nothing in it is eligible.
 */
export function pickPool<T extends Pickable>(list: readonly T[], mood?: PhotoMood, opts: PickOptions = {}): T[] {
  const allowPeople = opts.allowPeople === true
  const allowLow = opts.size === "small"
  let eligible = list.filter((p) => p.subject !== "baba" && (allowPeople || PEOPLE_OK.includes(p.people ?? "none")) && (allowLow || !p.lowRes))
  if (allowPeople && mood !== undefined && CALM_MOODS.includes(mood)) {
    const quiet = eligible.filter((p) => PEOPLE_OK.includes(p.people ?? "none"))
    if (quiet.length > 0) eligible = quiet
  }
  if (eligible.length === 0) return []
  const allowCool = mood !== undefined && COOL_OK.includes(mood)
  const byTone = eligible.filter((p) => allowCool || p.tone === "warm")
  const warmFirst = [...byTone].sort((a, b) => Number(a.tone === "cool") - Number(b.tone === "cool"))
  const byMood = mood ? warmFirst.filter((p) => p.moods.includes(mood)) : warmFirst
  if (byMood.length > 0) return byMood
  if (warmFirst.length > 0) return warmFirst
  return [...eligible]
}

/**
 * Same seed (and mood, options) gives the same photo. Returns one while the list holds an eligible photo;
 * undefined only for an empty list or one with nothing eligible.
 */
export function pickFromList<T extends Pickable>(list: readonly T[], seed: string, mood?: PhotoMood, opts: PickOptions = {}): T | undefined {
  const pool = pickPool(list, mood, opts)
  return pool.length === 0 ? undefined : pool[hashSeed(seed) % pool.length]
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
