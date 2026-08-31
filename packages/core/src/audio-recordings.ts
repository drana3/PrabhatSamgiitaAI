/** Rank catalog audio the same way the API does: current over old/low-quality. */

export type AudioSourceLike = {
  kind?: string
  title: string
  url: string
  provider?: string
  verification_status?: string
  source_status?: string | null
  match_score?: number | null
  is_primary?: boolean
  is_older?: boolean
  is_low_quality?: boolean
  is_latest?: boolean
  version?: string | null
}

export type RankedAudio = {
  title: string
  url: string
  provider: string
  isLatest: boolean
  isOlder: boolean
  isLowQuality: boolean
}

const SOURCE_ORDER: Record<string, number> = {
  official: 0,
  verified: 0,
  verified_community: 1,
  community: 2,
}

function searchable(item: Pick<AudioSourceLike, "title" | "url">) {
  return `${item.title} ${item.url}`.toLowerCase()
}

export function isOlderAudio(item: AudioSourceLike): boolean {
  if (item.is_older === true) return true
  if (item.version === "old") return true
  return searchable(item).includes("old version")
}

export function isLowQualityAudio(item: AudioSourceLike): boolean {
  if (item.is_low_quality === true) return true
  return searchable(item).includes("low quality")
}

export function audioQualityKey(
  item: AudioSourceLike,
): [number, number, number, number, number, string] {
  const source = String(item.source_status || item.verification_status || "").toLowerCase()
  const providerFallback = item.provider === "official" ? 0 : 3
  return [
    isLowQualityAudio(item) ? 1 : 0,
    isOlderAudio(item) ? 1 : 0,
    SOURCE_ORDER[source] ?? providerFallback,
    item.is_primary ? 0 : 1,
    -(item.match_score ?? 0),
    item.title.toLowerCase(),
  ]
}

export function compareAudioQuality(left: AudioSourceLike, right: AudioSourceLike): number {
  const a = audioQualityKey(left)
  const b = audioQualityKey(right)
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] < b[i]) return -1
    if (a[i] > b[i]) return 1
  }
  return 0
}

export function markLatestAudio<T extends { url: string; isOlder: boolean; isLowQuality: boolean }>(
  ranked: T[],
): Array<T & { isLatest: boolean }> {
  const fromApi = ranked.find((item) => "is_latest" in item && (item as AudioSourceLike).is_latest)
  const latestUrl =
    fromApi?.url ??
    ranked.find((item) => !item.isOlder && !item.isLowQuality)?.url ??
    ranked[0]?.url
  return ranked.map((item) => ({ ...item, isLatest: Boolean(latestUrl) && item.url === latestUrl }))
}

export function audioFreshnessBadge(item: {
  isLatest: boolean
  isOlder: boolean
  isLowQuality: boolean
}): "Best" | "Older version" | "Low quality" | null {
  if (item.isLatest) return "Best"
  if (item.isLowQuality) return "Low quality"
  if (item.isOlder) return "Older version"
  return null
}

export function resolvePreferredAudioUrl(
  recordings: Array<{ url: string; isLatest?: boolean }>,
  savedUrl?: string | null,
): string | null {
  if (savedUrl && recordings.some((item) => item.url === savedUrl)) return savedUrl
  return recordings.find((item) => item.isLatest)?.url ?? recordings[0]?.url ?? null
}
