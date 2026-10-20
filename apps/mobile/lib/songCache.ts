import type { SongDetail, SongLocalization, TransposedNotation } from "@prabhat/core"

import { api } from "@/lib/client"
import { isSargamEnabledForSong } from "@/lib/sargamDisplay"

const DETAIL_CACHE_MAX = 48
const LOCALIZATION_CACHE_MAX = 64
const NOTATION_CACHE_MAX = 48

const detailCache = new Map<number, SongDetail>()
const localizationCache = new Map<string, SongLocalization>()
const notationCache = new Map<string, TransposedNotation>()

function trimMap<K, V>(map: Map<K, V>, max: number) {
  while (map.size > max) {
    const oldest = map.keys().next().value
    if (oldest === undefined) break
    map.delete(oldest)
  }
}

export function peekSongDetail(number: number): SongDetail | null {
  return detailCache.get(number) ?? null
}

export async function fetchSongDetailCached(number: number): Promise<SongDetail | null> {
  const cached = detailCache.get(number)
  if (cached) return cached
  const detail = await api.fetchSong(number)
  if (!detail) return null
  detailCache.set(number, detail)
  trimMap(detailCache, DETAIL_CACHE_MAX)
  return detail
}

export function rememberSongDetail(detail: SongDetail) {
  detailCache.set(detail.number, detail)
  trimMap(detailCache, DETAIL_CACHE_MAX)
}

function localizationKey(number: number, language: string) {
  return `${number}:${language.trim().toLowerCase()}`
}

export function peekSongLocalization(number: number, language: string): SongLocalization | null {
  return localizationCache.get(localizationKey(number, language)) ?? null
}

/** Drop a cached localization so the next fetch hits the network (retry CI / translation). */
export function forgetSongLocalization(number: number, language: string) {
  localizationCache.delete(localizationKey(number, language))
}

export async function fetchSongLocalizationCached(
  number: number,
  language: string,
  options: { generateCentralIdea?: boolean; force?: boolean } = {},
): Promise<SongLocalization | null> {
  const key = localizationKey(number, language)
  if (options.force) {
    localizationCache.delete(key)
  }
  const cached = localizationCache.get(key)
  if (
    !options.force &&
    cached?.localized_meaning?.trim() &&
    (!options.generateCentralIdea || cached.localized_explanation?.trim())
  ) {
    return cached
  }
  const live = await api.fetchSongLocalization(number, language, {
    generateCentralIdea: options.generateCentralIdea,
  })
  if (live?.localized_meaning?.trim() || live?.localized_explanation?.trim()) {
    const prior = options.force ? null : cached
    const merged = prior
      ? {
          ...prior,
          ...live,
          localized_meaning: live.localized_meaning ?? prior.localized_meaning,
          localized_explanation:
            live.localized_explanation ?? prior.localized_explanation,
          explanation_kind: live.explanation_kind ?? prior.explanation_kind,
        }
      : live
    localizationCache.set(key, merged)
    trimMap(localizationCache, LOCALIZATION_CACHE_MAX)
    return merged
  }
  return live
}

function notationKey(number: number, tonic: string) {
  return `${number}:${tonic.trim().toUpperCase()}`
}

export async function fetchNotationCached(
  number: number,
  tonic = "C",
): Promise<TransposedNotation | null> {
  const key = notationKey(number, tonic)
  const cached = notationCache.get(key)
  if (cached) return cached
  const live = await api.fetchNotation(number, tonic)
  if (live) {
    notationCache.set(key, live)
    trimMap(notationCache, NOTATION_CACHE_MAX)
  }
  return live
}

/** Warm notation for a song without blocking UI. No-op while Sargam is paused. */
export function prefetchNotation(number: number, tonic = "C") {
  if (!isSargamEnabledForSong(number)) return
  void fetchNotationCached(number, tonic)
}
