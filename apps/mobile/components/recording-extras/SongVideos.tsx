import { useState, type ReactNode } from "react"

import type { SpTheme } from "@/constants/tokens/amSong"
import { useT } from "@/lib/i18n"
import { commentableSong } from "@/lib/songComments/rules"

import { AddVideoSheet } from "./AddVideoSheet"
import { VideosSection } from "./VideosSection"
import { useVideos } from "./useVideos"

/**
 * The members' video links of one Prabhat Samgiita song, split in two because a spring sheet must sit over the whole
 * page, not inside the scrolling list: `section` goes under the Recordings, `sheet` goes with the page's other sheets.
 * Both share one list. The curated videos of a song (components/song-page/Watch.tsx) are a different thing and stay.
 */
export function useSongVideos(t: SpTheme, songNumber: number | undefined, onFlash: (text: string) => void): { section: ReactNode; sheet: ReactNode } {
  const number = commentableSong(songNumber)
  // the hook runs for every song; a song that cannot take links (a demo number) asks the server nothing
  const tr = useT()
  const videos = useVideos(number === null ? null : { kind: "song", id: number })
  const [adding, setAdding] = useState(false)
  if (number === null) return { section: null, sheet: null }
  return {
    section: <VideosSection t={t} videos={videos} onAdd={() => setAdding(true)} onFlash={onFlash} />,
    sheet: <AddVideoSheet t={t} visible={adding} onClose={() => setAdding(false)} videos={videos} onAdded={() => onFlash(tr("recVideos.added"))} />,
  }
}
