import { sargamPlayEvents } from "./harmonium-keyboard"
import { type SheetPlayEvent } from "./notation-sheet"

export type HarmoniumSampleSongLine = {
  lyric: string
  lyricHi: string
  sargam: string
}

export type HarmoniumSampleSong = {
  id: string
  title: string
  titleHi: string
  sourceUrl?: string
  sourceLabel?: string
  /** How classic online apps map a tune: sargam + lyrics, played on chromatic keys. */
  lines: HarmoniumSampleSongLine[]
}

/**
 * Raghupati Raghav Raja Ram — one famous bhajan on the chromatic keyboard.
 * Method: set Sa, then play each sargam syllable on the matching key
 * (Harmonium Guru: “How To Find And Play Any Song On Harmonium”).
 */
export const RAGHUPATI_RAGHAV_SONG: HarmoniumSampleSong = {
  id: "raghupati-raghav",
  title: "Raghupati Raghav Raja Ram",
  titleHi: "रघुपति राघव राजा राम",
  sourceUrl: "https://www.youtube.com/watch?v=M9wUODymVcY",
  sourceLabel: "How to find and play any song on harmonium",
  lines: [
    {
      lyric: "Raghupati Raghav Raja Ram",
      lyricHi: "रघुपति राघव राजा राम",
      sargam: ".P S S S S R .N .D .N R R m G m",
    },
    {
      lyric: "Patit Pawan Sita Ram",
      lyricHi: "पतित पावन सीता राम",
      sargam: "R g R S .N .D .N g R S",
    },
    {
      lyric: "Eshwar Allah Tero Naam",
      lyricHi: "ईश्वर अल्लाह तेरो नाम",
      sargam: "G G G R S R G m G m",
    },
    {
      lyric: "Sabko Sammati De Bhagwan",
      lyricHi: "सबको सम्मति दे भगवान",
      sargam: "R m P d P m g R S",
    },
  ],
}

export const HARMONIUM_SAMPLE_SONGS = [RAGHUPATI_RAGHAV_SONG] as const

export function sampleSongSargam(song: HarmoniumSampleSong): string {
  return song.lines.map((line) => line.sargam).join("  ")
}

export function sampleSongPlayEvents(
  tonic: string,
  song: HarmoniumSampleSong = RAGHUPATI_RAGHAV_SONG,
  noteSec = 0.38,
  gapSec = 0.06,
): SheetPlayEvent[] {
  return sargamPlayEvents(tonic, sampleSongSargam(song), noteSec, gapSec)
}

export function sampleSongLineEvents(
  tonic: string,
  song: HarmoniumSampleSong = RAGHUPATI_RAGHAV_SONG,
  noteSec = 0.38,
  gapSec = 0.06,
): Array<{ line: HarmoniumSampleSongLine; events: SheetPlayEvent[]; startSec: number; endSec: number }> {
  let cursor = 0
  return song.lines.map((line) => {
    const events = sargamPlayEvents(tonic, line.sargam, noteSec, gapSec).map((event) => ({
      ...event,
      startSec: event.startSec + cursor,
    }))
    const startSec = cursor
    const last = events[events.length - 1]
    const endSec = last ? last.startSec + last.durationSec : cursor
    cursor = endSec + 0.28
    return { line, events, startSec, endSec }
  })
}
