/**
 * TODO(api): sample content for the Player, copied from the Claude design prototype
 * (public/mockup/Main.dc.html, `_content`). The catalog has no word glosses and no
 * Russian line translations yet; until it does, the Player shows these for the words
 * and songs that match, and nothing for the rest. Replace with API data, then delete.
 */

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

/** Russian translation lines for a song, only when they line up with the lyric lines. */
export function sampleRussianLines(songNumber: number, lineCount: number): string[] | null {
  // The web preview plays every sample song with one of the two sample texts, so match by line count.
  const lines = RU_LINES[songNumber] ?? (MOCKUP_DATA ? (lineCount === 3 ? RU_LINES[3] : RU_LINES[1]) : undefined)
  return lines && lines.length === lineCount ? lines : null
}
