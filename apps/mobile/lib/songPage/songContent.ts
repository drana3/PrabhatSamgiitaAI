import type { MockSong } from "@/data/mock"

import type { ChordChart } from "./chordChart"
import { splitWords } from "./chordChart"

/**
 * Content the song page can show once the API delivers it (spec API-07,
 * API-14). Today none of it exists in the catalog, so every provider returns
 * null and the matching section stays hidden instead of showing a guess.
 */
export type WordGlosses = {
  /** gloss by `lineIndex:wordIndex`, one record per language code */
  byLanguage: Record<string, Record<string, string>>
}

export type SongExplanation = {
  reviewed: boolean
  summary: string
  keyPoints: string[]
  keyTerms: Array<{ term: string; meaning: string }>
}

export type SongExtras = {
  chart: ChordChart | null
  glosses: WordGlosses | null
  explanation: SongExplanation | null
}

export const NO_EXTRAS: SongExtras = { chart: null, glosses: null, explanation: null }

export function glossKey(line: number, word: number): string {
  return `${line}:${word}`
}

export function explanationIsUsable(e: SongExplanation | null | undefined): e is SongExplanation {
  return Boolean(e && e.reviewed && e.summary.trim())
}

export function glossesAreUsable(g: WordGlosses | null | undefined): g is WordGlosses {
  return Boolean(g && Object.values(g.byLanguage).some((map) => Object.keys(map).length > 0))
}

/** Gloss in the chosen language, then English, then nothing. */
export function glossFor(
  glosses: WordGlosses,
  languages: string[],
  line: number,
  word: number,
): { text: string; language: string } | null {
  const key = glossKey(line, word)
  for (const code of [...languages, "en"]) {
    const text = glosses.byLanguage[code]?.[key]
    if (text?.trim()) return { text, language: code }
  }
  return null
}

/**
 * Words of a Devanagari line placed against the words of the Roman line. Only
 * when both lines have the same number of words; otherwise null, never a guess.
 */
export function alignWords(roman: string, other: string | undefined): string[] | null {
  if (!other) return null
  const a = splitWords(roman)
  const b = splitWords(other)
  return a.length === b.length ? b : null
}

/** The only provider today. Replace the body when the song detail carries reviewed content. */
export function extrasForSong(_song: Pick<MockSong, "number">): SongExtras {
  return NO_EXTRAS
}

/**
 * Sample content for design review in development builds only (open the route
 * with `?demo=1`). It is not reviewed and must never reach a release build.
 */
export function demoExtras(lyricLines: string[]): SongExtras {
  const cycle = ["C", "Am", "F", "G"]
  const chart: ChordChart = {
    reviewed: true,
    baseKey: "C",
    strum: "D  D U  U D U",
    lines: lyricLines.map((line, i) => {
      const words = splitWords(line)
      const placements = [{ word: 0, chord: cycle[i % cycle.length] }]
      if (words.length > 3) placements.push({ word: Math.ceil(words.length / 2), chord: cycle[(i + 1) % cycle.length] })
      return { placements }
    }),
  }
  const en: Record<string, string> = {}
  lyricLines.forEach((line, l) => splitWords(line).forEach((_, w) => (en[glossKey(l, w)] = "Sample meaning")))
  return {
    chart,
    glosses: { byLanguage: { en } },
    explanation: {
      reviewed: true,
      summary: "Sample summary for layout review. Real texts are written offline and reviewed before release.",
      keyPoints: ["Sample point one", "Sample point two", "Sample point three"],
      keyTerms: [{ term: "Sample term", meaning: "Sample meaning" }],
    },
  }
}
