import type { MockSong } from "@/data/mock"
import { splitWords } from "@/lib/songPage/chordChart"
import { buildLyricSources } from "@/lib/songPage/scripts"

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

/** The whole text of a catalogue song as chord lines (every line of every stanza, in the order sung). */
export function songLyricsFrom(song: MockSong): SongLyrics {
  const roman = buildLyricSources({ lyrics: song.lyrics, transliteration: song.transliteration, lyricsDevanagari: song.lyricsDevanagari }).roman
  if (!roman.length) return { status: "none", title: song.title }
  return { status: "ready", number: song.number, title: song.title, lines: roman, wordCounts: roman.map((line) => splitWords(line).length) }
}
