/**
 * TODO(api): sample content for the Player, copied from the Claude design prototype
 * (public/mockup/Main.dc.html, `_content`). The catalog has no word glosses and no
 * Russian line translations yet; until it does, the Player shows these for the words
 * and songs that match, and nothing for the rest. Replace with API data, then delete.
 */

import { mockupTranslationByLineCount } from "@/lib/fixtures/songMockup"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/** Roman lyric word, lower case and without diacritics, to its short English gloss. */
const GLOSS_ENTRIES: Array<[string, string]> = [
  // PS 1 sample
  ["Bandhu", "friend"], ["he", "O"], ["niye", "take"], ["calo", "lead on"],
  ["Álor", "of light"], ["jharańá", "spring"], ["dháráy", "in the stream"], ["dhuiye", "wash"], ["dáo", "give"],
  ["Tomár", "your"], ["kole", "lap"], ["ámáy", "me"], ["tule", "lifting"], ["náo", "take"],
  ["Andhakár", "darkness"], ["kete", "cut away"], ["yáy", "goes"],
  // PS 3 sample
  ["Ándhára", "darkness"], ["sheśe", "at the end"], ["álora", "of light"], ["deshe", "in the land"],
  ["Tumi", "You"], ["eso", "come"], ["háte", "by the hand"], ["dhare", "holding"],
  ["Ámár", "my"], ["pathe", "on the path"], ["álo", "light"], ["jválo", "kindle"],
]

export function plainWord(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase()
}

const GLOSS = new Map(GLOSS_ENTRIES.map(([word, gloss]) => [plainWord(word), gloss]))

/** TODO(api): short gloss of one Roman lyric word, or undefined when the sample has none. */
export function sampleGloss(word: string): string | undefined {
  return GLOSS.get(plainWord(word))
}

/** TODO(api): Russian line translations of the two sample songs, keyed by PS number. */
const RU_LINES: Record<number, string[]> = {
  1: [
    "Друг, возьми меня с собой.",
    "Омой меня в потоке света.",
    "Подними меня в свои объятия.",
    "Пусть тьма отступит.",
  ],
  3: [
    "В конце тьмы, в стране света.",
    "Ты приходишь, держа меня за руку.",
    "Зажги свет на моём пути.",
  ],
}

/** The songs the sample translations and word meanings were written for (PS 1 and PS 3). */
export const SAMPLE_SONG_NUMBERS: readonly number[] = Object.keys(RU_LINES).map(Number)

/**
 * Russian sample lines of PS 1 / PS 3, only when they line up with the lyric lines. No demo check
 * here: callers decide (see `lib/songPage/honest.ts`). Any other song gets null, never a guess.
 */
export function fixtureRussianLines(songNumber: number, lineCount: number): string[] | null {
  const lines = RU_LINES[songNumber]
  return lines && lines.length === lineCount ? lines : null
}

/** Russian translation lines for a song: only in the demo preview and only for the two sample songs. */
export function sampleRussianLines(songNumber: number, lineCount: number): string[] | null {
  return MOCKUP_DATA ? fixtureRussianLines(songNumber, lineCount) : null
}

/**
 * TODO(api): sample line translations of the two sample songs in the languages the prototype has
 * (Russian, Spanish, Hindi). Demo preview and PS 1 / PS 3 only; every other song, and a language the
 * sample does not have (Chinese), returns null: the Player says so and shows English instead of inventing a text.
 */
export function sampleTranslationLines(songNumber: number, code: string, lineCount: number): string[] | null {
  if (!MOCKUP_DATA || !SAMPLE_SONG_NUMBERS.includes(songNumber)) return null
  if (code === "ru") return fixtureRussianLines(songNumber, lineCount)
  return mockupTranslationByLineCount(code, lineCount)
}

/** TODO(api): which languages the sample word meanings cover (English and Russian). */
export const SAMPLE_GLOSS_LANGUAGES: readonly string[] = ["en", "ru"]
