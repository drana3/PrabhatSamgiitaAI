import { useEffect, useMemo, useState } from "react"

import { songLyricsFrom, type SongLyrics } from "@/lib/songChords/lyricLines"
import { peekResolvedSong, resolveSongBundle } from "@/lib/songs"

export { songLyricsFrom, type SongLyrics } from "@/lib/songChords/lyricLines"

export function useSongLyrics(number: number | null, retry = 0): SongLyrics {
  const [state, setState] = useState<SongLyrics>({ status: "idle" })
  useEffect(() => {
    if (number === null) {
      setState({ status: "idle" })
      return
    }
    let active = true
    // Always the real catalogue text, also in the web preview: a chart is tied to the words of the song, so the
    // prototype's sample verse (PS 1 and PS 3 in the preview) would give a chart for words the song does not have.
    const peeked = peekResolvedSong(String(number))
    setState(peeked ? songLyricsFrom(peeked.song) : { status: "loading" })
    void resolveSongBundle(String(number)).then((bundle) => {
      if (!active) return
      // `resolveSongBundle` falls back to the one-line shell of a search row (the first line only) when the catalogue
      // could not be reached; that is not the song. Only a song the catalogue really answered for is the whole text.
      const whole = peekResolvedSong(String(number))
      if (bundle && whole && (whole.song.lyrics || whole.song.transliteration)) setState(songLyricsFrom(whole.song))
      else setState({ status: "error" })
    })
    return () => {
      active = false
    }
  }, [number, retry])
  return useMemo(() => state, [state])
}
