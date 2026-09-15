import {
  compareAudioQuality,
  isLowQualityAudio,
  isOlderAudio,
  markLatestAudio,
  unwrapArchiveAudioUrl,
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

export function listSongAudio(media: SongMedia[]): RankedAudio[] {
  const ranked = media.filter(isDirectAudio).slice().sort(compareAudioQuality)
  return markLatestAudio(
    ranked.map((item) => ({
      title: item.title.trim() || "Recording",
      url: unwrapArchiveAudioUrl(item.url),
      provider: item.provider,
      isOlder: isOlderAudio(item),
      isLowQuality: isLowQualityAudio(item),
      is_latest: item.is_latest,
    })),
  )
}
