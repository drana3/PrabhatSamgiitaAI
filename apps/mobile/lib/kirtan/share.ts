import type { SharePayload } from "@/lib/playerV2/playerShare"
import type { Kirtan } from "@/lib/kirtan/types"
import { youtubeWatchUrl } from "@/lib/kirtan/youtube"

/**
 * What a share of a kirtan carries: the link to the video on YouTube, nothing of ours.
 * Sent through the same channels as a song (lib/playerV2/playerShare SHARE_TARGETS, runShare).
 */
export function kirtanSharePayload(k: Pick<Kirtan, "title" | "videoId">): SharePayload {
  const url = youtubeWatchUrl(k.videoId)
  const title = k.title.trim() || "Kiirtan"
  return { title: `Kiirtan · ${title}`, message: `${title}, a kiirtan on YouTube.\n${url}`, url }
}
