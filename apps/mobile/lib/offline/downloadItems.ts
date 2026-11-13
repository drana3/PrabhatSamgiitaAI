import { kiirtanToSong } from "@/lib/kirtan/track"
import type { KiirtanSource } from "@/lib/kirtan/track"
import type { DownloadItem } from "@/lib/offline/downloadModel"

/** A catalog song as something a download control can act on. */
export function songDownloadItem(number: number, extra: Partial<Omit<DownloadItem, "kind" | "number">> = {}): DownloadItem {
  return { kind: "song", number, ...extra }
}

/**
 * A Kiirtan or Bhajan. Registers it with the player's track table first, so its queue number and
 * its audio link can be found again from the number alone (a list works on numbers).
 */
export function kiirtanDownloadItem(k: KiirtanSource): DownloadItem {
  const song = kiirtanToSong(k)
  return {
    kind: "kiirtan",
    number: song.number,
    url: k.audioUrl,
    title: k.title,
    seconds: k.durationSec ?? undefined,
  }
}
