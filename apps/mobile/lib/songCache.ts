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

export async function fetchSongLocalizationCached(
  number: number,
  language: string,
): Promise<SongLocalization | null> {
  const key = localizationKey(number, language)
  const cached = localizationCache.get(key)
  if (cached?.localized_meaning?.trim()) return cached
  const live = await api.fetchSongLocalization(number, language)
  if (live?.localized_meaning?.trim()) {
    localizationCache.set(key, live)
    trimMap(localizationCache, LOCALIZATION_CACHE_MAX)
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
