import type { SongVideo } from "@/data/mock"
import { fixtureRussianLines } from "@/lib/fixtures/player"
import { FIXTURE_CENTRAL_IDEA, fixtureExtras, glossaryGloss } from "@/lib/fixtures/songPage"
import type { LyricGap } from "@/lib/songPage/lyricLanguages"

import { NO_EXTRAS, type SongExtras } from "./songContent"

/**
 * Truthfulness rules of the song page, as plain functions (no React). The page shows invented sample
 * content (chords, word meanings, a placeholder video, sample lengths, performers) only in the demo
 * preview (MOCKUP_DATA) and only for the two songs that content was written for.
 */

/** The songs the sample content (word meanings, chord chart, explanation) was written for. */
export const DEMO_FIXTURE_SONGS: readonly number[] = [1, 3]

/**
 * The extras the page shows. `real` is what the catalog delivers (nothing yet). `demoKey` is the
 * sample song's key (1 or 3) while the demo preview draws that song, otherwise null.
 */
export function pageExtras(input: { real: SongExtras; demoKey: number | null; romanLines: string[] }): SongExtras {
  const { real, demoKey, romanLines } = input
  if (demoKey === null || !DEMO_FIXTURE_SONGS.includes(demoKey)) return { ...NO_EXTRAS, ...real }
  const sample = fixtureExtras(romanLines, demoKey)
  return {
    chart: real.chart ?? sample.chart,
    glosses: real.glosses ?? sample.glosses,
    explanation: real.explanation ?? sample.explanation,
  }
}

/** The prototype's sample "central idea" of a demo song; nothing for a real one. */
export function demoCentralIdea(demoKey: number | null): string | null {
  return demoKey !== null && DEMO_FIXTURE_SONGS.includes(demoKey) ? (FIXTURE_CENTRAL_IDEA[demoKey] ?? null) : null
}

/**
 * The sample song whose invented word meanings and Russian lines the Player may show: only while the
 * demo preview (MOCKUP_DATA) is on and only for the songs that content was written for. Any real
 * song gets null, and null means "show nothing invented".
 */
export function playerSampleKey(input: { demo: boolean; songNumber: number | null | undefined }): number | null {
  const { demo, songNumber } = input
  return demo && songNumber != null && DEMO_FIXTURE_SONGS.includes(songNumber) ? songNumber : null
}

/** The sample gloss of one lyric word in a language, or undefined (always undefined without a sample key). */
export function playerGloss(input: {
  sampleKey: number | null
  word: string
  code: string
  englishGloss: (word: string) => string | undefined
}): string | undefined {
  if (input.sampleKey === null) return undefined
  return input.code === "en" ? input.englishGloss(input.word) : (glossaryGloss(input.word, input.code) ?? undefined)
}

/**
 * Word meanings per language for the Player's lyrics, row per line, cell per word. A language with no
 * meaning at all is null. Without a sample key (every real song) every language is null.
 */
export function playerGlossRows(input: {
  sampleKey: number | null
  languages: readonly string[]
  scriptLines: readonly string[]
  romanLines: readonly string[]
  useDevanagari: boolean
  splitWords: (line: string) => string[]
  englishGloss: (word: string) => string | undefined
}): Record<string, Array<Array<string | undefined>> | null> {
  const out: Record<string, Array<Array<string | undefined>> | null> = {}
  for (const code of input.languages) {
    if (input.sampleKey === null) {
      out[code] = null
      continue
    }
    const rows = input.scriptLines.map((line, i) => {
      const roman = input.splitWords(input.romanLines[i] ?? "")
      const words = input.splitWords(line)
      // Devanagari shows the gloss of the Roman word in the same position.
      const source = input.useDevanagari && roman.length === words.length ? roman : words
      return source.map((word) => playerGloss({ sampleKey: input.sampleKey, word, code, englishGloss: input.englishGloss }))
    })
    out[code] = rows.some((row) => row.some(Boolean)) ? rows : null
  }
  return out
}

/** Russian sample lines, only for a sample key and only when they line up with the lyric lines. */
export function playerRussianLines(input: { sampleKey: number | null; lineCount: number }): string[] | null {
  return input.sampleKey === null ? null : fixtureRussianLines(input.sampleKey, input.lineCount)
}

/**
 * The line a language gap shows. A word-meanings gap with nothing to fall back on (not even English)
 * says the song has no word meanings at all; every other gap keeps `Not available in X yet.`.
 */
export function gapText(gap: Pick<LyricGap, "kind" | "shown" | "text">): string {
  return gap.kind === "words" && gap.shown === null ? EMPTY_TEXT.words : gap.text
}

/** The real videos to embed: only rows with an embed address, each embed once. */
export function watchVideos(videos: readonly SongVideo[] | null | undefined): SongVideo[] {
  const seen = new Set<string>()
  const out: SongVideo[] = []
  for (const video of videos ?? []) {
    const key = (video.embedUrl ?? "").trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(video)
  }
  return out
}

/**
 * Length of the recording in seconds, only when it is known. The catalog sends no length; the stored
 * 300 s of a song is a placeholder and is used only by the demo preview.
 */
export function knownSeconds(input: { versionLength: number | null; songSeconds: number; demo: boolean }): number | null {
  if (input.versionLength != null && input.versionLength > 0) return input.versionLength
  return input.demo && input.songSeconds > 0 ? input.songSeconds : null
}

/**
 * The performer line under the title and in the share text. The catalog has no performer field: a
 * version's name is its audio file title, so it is not shown as a performer. Only the demo's
 * sample versions carry one.
 */
export function shownPerformer(input: { demo: boolean; versionPerformer: string | null | undefined; songPerformer: string | null | undefined }): string {
  if (!input.demo) return ""
  return (input.versionPerformer ?? input.songPerformer ?? "").trim()
}

/** What a content section says when the song has none of it. */
export const EMPTY_TEXT = {
  words: "No word meanings yet.",
  chords: "No chords for this song yet.",
  video: "No video yet.",
} as const

export type EmptyKind = keyof typeof EMPTY_TEXT

/** Key under which a request for this content is remembered ("words:12"), one per song and kind. */
export function requestKey(kind: "words" | "chords", songNumber: number): string {
  return `${kind}:${songNumber}`
}

/** The notation PDF of a song, only when the catalog really has one (an http address). */
export function notationPdfUrl(url: string | null | undefined): string | null {
  const trimmed = (url ?? "").trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : null
}
