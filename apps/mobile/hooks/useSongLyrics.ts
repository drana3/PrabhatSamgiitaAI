import { useEffect, useMemo, useState } from "react"

import { mockupSong } from "@/lib/fixtures/songMockup"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { splitWords } from "@/lib/songPage/chordChart"
import { buildLyricSources } from "@/lib/songPage/scripts"
import { peekResolvedSong, resolveSongBundle } from "@/lib/songs"
import type { MockSong } from "@/data/mock"

/**
 * The Roman lyric lines of one Prabhat Samgiita song, split exactly as the song page splits them, so that "word 3 of
 * line 2" means the same word here and on the page. `none` is a song without Roman lyrics: chords need the words.
 */
export type SongLyrics =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "none"; title: string }
  | { status: "ready"; number: number; title: string; lines: string[]; wordCounts: number[] }

function fromSong(song: MockSong): SongLyrics {
  const roman = buildLyricSources({ lyrics: song.lyrics, transliteration: song.transliteration, lyricsDevanagari: song.lyricsDevanagari }).roman
  if (!roman.length) return { status: "none", title: song.title }
  return { status: "ready", number: song.number, title: song.title, lines: roman, wordCounts: roman.map((line) => splitWords(line).length) }
}

export function useSongLyrics(number: number | null, retry = 0): SongLyrics {
  const [state, setState] = useState<SongLyrics>({ status: "idle" })
  useEffect(() => {
    if (number === null) {
      setState({ status: "idle" })
      return
    }
    let active = true
    const sample = MOCKUP_DATA ? mockupSong(number) : null
    if (sample) {
      setState(fromSong(sample))
      return
    }
    const peeked = peekResolvedSong(String(number))
    setState(peeked ? fromSong(peeked.song) : { status: "loading" })
    void resolveSongBundle(String(number)).then((bundle) => {
      if (!active) return
      // a placeholder shell (no lyrics yet) is not an answer when the catalogue could not be reached
      if (bundle && (bundle.song.lyrics || bundle.song.transliteration)) setState(fromSong(bundle.song))
      else setState({ status: "error" })
    })
    return () => {
      active = false
    }
  }, [number, retry])
  return useMemo(() => state, [state])
}
