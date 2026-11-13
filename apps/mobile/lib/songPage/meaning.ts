import type { MockSong } from "@/data/mock"
import { resolveSongMeaning, type SongMeaningResolution } from "@/lib/songMeanings"
import { storedExplanationForLanguage, storedMeaningForLanguage, usableLocalizedExplanation } from "@/lib/songMap"
import { alignTranslationLines, coverageOf, type Coverage } from "@/lib/songPage/translations"

export type FetchedMeaning = {
  meaning: string | null
  explanation: string | null
}

export type MeaningView = {
  meaning: SongMeaningResolution
  /** Central idea in the chosen language, or null */
  centralIdea: string | null
}

type MeaningSong = Pick<
  MockSong,
  "meaning" | "hindiMeaning" | "localizedMeanings" | "localizedExplanations" | "centralIdea"
>

/**
 * What the Meaning section shows for a language: stored text first, then what
 * the translation service returned. English is never shown under another
 * language label (resolveSongMeaning guarantees it).
 */
export function deriveMeaningView(
  song: MeaningSong,
  language: string,
  fetched: FetchedMeaning | null,
  loading: boolean,
): MeaningView {
  const code = language.toLowerCase()
  const meaning = resolveSongMeaning(song, code, fetched?.meaning ?? null, loading)
  if (code === "en") {
    return { meaning, centralIdea: song.centralIdea?.trim() || storedExplanationForLanguage(song, code) }
  }
  const stored = storedExplanationForLanguage(song, code)
  const fromService = usableLocalizedExplanation(fetched?.explanation, {
    officialCentralIdea: song.centralIdea,
    meaningCandidates: [meaning.status === "ready" ? meaning.text : null, song.meaning, song.hindiMeaning],
  })
  return { meaning, centralIdea: stored ?? fromService }
}

/** True when the service must be asked: not English, and nothing stored for the language. */
export function needsMeaningFetch(song: MeaningSong, language: string): boolean {
  const code = language.toLowerCase()
  if (code === "en") return false
  return resolveSongMeaning(song, code, null, false).status !== "ready"
}

/**
 * Coverage of every language for the sheet, from the texts the song carries.
 * Line-by-line translations do not exist in the catalog yet, so a stored
 * meaning counts as `lines` only when it splits into as many lines as the lyric.
 */
export function coverageForSong(song: MeaningSong, lyricLines: string[], codes: string[]): Record<string, Coverage> {
  const wordCount = lyricLines.reduce((total, line) => total + line.split(/\s+/).filter(Boolean).length, 0)
  const out: Record<string, Coverage> = {}
  for (const code of codes) {
    const stored = storedMeaningForLanguage(song, code)
    if (!stored) continue
    const lines = alignTranslationLines(lyricLines, stored)
    out[code] = coverageOf({ lines: lines ?? undefined, meaning: stored }, wordCount)
  }
  return out
}
