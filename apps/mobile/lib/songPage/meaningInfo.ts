import type { MockSong } from "@/data/mock"

/**
 * Where a meaning text comes from, and whether there is a real one. Pure.
 *  - official: the English translation of the official lyrics page (5015 songs).
 *  - reviewed: a text stored in the catalogue for another language (curated Hindi, admin-approved).
 *  - machine: fetched from the translation service on demand (Google or an LLM). Not checked by a person.
 * English is never shown under another language's name, and no other language is passed off as official.
 */
export type MeaningSource = "official" | "reviewed" | "machine"

type MeaningSong = Pick<MockSong, "meaning" | "hindiMeaning" | "localizedMeanings" | "themes" | "lyrics" | "title">

const PLACEHOLDER = /^a song from the prabhat samgiita collection\.?$/i

/**
 * `song.meaning` is not always a translation: when the catalogue has none it holds the theme or a stock
 * sentence. That is not a meaning, so the page must not show it as one. `rawEnglish` is the catalogue's
 * own english_meaning when the song detail is known (null or empty means the song has none); pass
 * `undefined` when only the page's song is known and the text itself has to be judged.
 */
export function officialEnglishMeaning(song: MeaningSong, rawEnglish?: string | null): string | null {
  if (rawEnglish !== undefined) return rawEnglish?.trim() ? rawEnglish.trim() : null
  const text = song.meaning?.trim()
  if (!text || PLACEHOLDER.test(text)) return null
  if (song.themes.some((theme) => theme.trim() === text)) return null
  if (text === song.lyrics?.trim() || text === song.title?.trim()) return null
  return text
}

/** The stored text for a language exactly as the catalogue has it (line breaks kept), or null. Not for English. */
export function storedMeaningRaw(song: Pick<MockSong, "hindiMeaning" | "localizedMeanings">, code: string): string | null {
  const lower = code.toLowerCase()
  if (lower === "hi") return song.hindiMeaning?.trim() || null
  return song.localizedMeanings?.[lower]?.trim() || song.localizedMeanings?.[code]?.trim() || null
}

export function meaningSourceFor(song: Pick<MockSong, "hindiMeaning" | "localizedMeanings">, code: string): MeaningSource {
  if (code.toLowerCase() === "en") return "official"
  return storedMeaningRaw(song, code) ? "reviewed" : "machine"
}
