import {
  compareAudioQuality,
  isLowQualityAudio,
  isOlderAudio,
  markLatestAudio,
  type RankedAudio,
} from "@prabhat/core"

type SongMedia = {
  kind: string
  title: string
  url: string
  provider: string
  verification_status?: string
  source_status?: string | null
  match_score?: number | null
  is_older?: boolean
  is_low_quality?: boolean
  is_latest?: boolean
}

function isDirectAudio(item: SongMedia) {
  if (item.kind !== "audio") return false
  const url = item.url.toLowerCase()
  return !/youtube\.com\/results|youtube\.com\/watch|youtu\.be\//i.test(url)
}

/** Azure-proxied prabhatasamgiita.net streams often return HTML instead of MP3. */
function isBrokenArchiveProxy(url: string) {
  return /\/api\/v1\/media\/stream\?/i.test(url)
}

export function listSongAudio(media: SongMedia[]): RankedAudio[] {
  const direct = media.filter(isDirectAudio)
  const hasPlayableMirror = direct.some(
    (item) =>
      !isBrokenArchiveProxy(item.url) && !isOlderAudio(item) && !isLowQualityAudio(item),
  )
  const pool = hasPlayableMirror ? direct.filter((item) => !isBrokenArchiveProxy(item.url)) : direct
  const ranked = pool.slice().sort(compareAudioQuality)
  return markLatestAudio(
    ranked.map((item) => ({
      title: item.title.trim() || "Recording",
      url: item.url,
      provider: item.provider,
      isOlder: isOlderAudio(item),
      isLowQuality: isLowQualityAudio(item),
    })),
  )
}
