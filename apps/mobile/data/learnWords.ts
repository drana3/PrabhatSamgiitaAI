import { wordId, type LearnWord } from "@/lib/learn/words"

/**
 * SAMPLE CONTENT. TODO(api): the catalog has no word-by-word glosses yet (spec API-07
 * and API-12). These words and meanings are the placeholders of the design prototype
 * for PS 1 and PS 3 (Main.dc.html `_content`), to be replaced by the reviewed word
 * list from the API. The order is the order of the words in the song, so the first
 * ten words of the starter deck are the first ten words of PS 1, as in the prototype.
 */
type Raw = [roman: string, devanagari: string, meaning: string]

function build(songNumber: number, example: string, rows: Raw[]): LearnWord[] {
  return rows.map(([roman, devanagari, meaning]) => ({
    id: wordId(songNumber, roman),
    roman,
    devanagari,
    meaning,
    example,
    songNumber,
  }))
}

export const SAMPLE_LEARN_WORDS: LearnWord[] = [
  ...build(1, "Friend, take me along.", [
    ["Bandhu", "बन्धु", "friend"],
    ["he", "हे", "O"],
    ["niye", "निये", "take"],
    ["calo", "चलो", "lead on"],
  ]),
  ...build(1, "Wash me in the flowing stream of light.", [
    ["Álor", "आलोर", "of light"],
    ["jharańá", "झरना", "spring"],
    ["dháráy", "धाराय", "in the stream"],
    ["dhuiye", "धुइये", "wash"],
    ["dáo", "दाओ", "give"],
  ]),
  ...build(1, "Lift me into your lap.", [
    ["Tomár", "तोमार", "your"],
    ["kole", "कोले", "lap"],
    ["ámáy", "आमाय", "me"],
    ["tule", "तुले", "lifting"],
    ["náo", "नाओ", "take"],
  ]),
  ...build(1, "Let the darkness be cut away.", [
    ["Andhakár", "अन्धकार", "darkness"],
    ["kete", "केटे", "cut away"],
    ["yáy", "याय", "goes"],
  ]),
  ...build(3, "At the end of the dark, in the land of light.", [
    ["Ándhára", "अन्धार", "darkness"],
    ["sheśe", "शेषे", "at the end"],
    ["álora", "आलोर", "of light"],
    ["deshe", "देशे", "in the land"],
  ]),
  ...build(3, "You come, holding my hand.", [
    ["Tumi", "तुमि", "You"],
    ["eso", "एसो", "come"],
    ["háte", "हाते", "by the hand"],
    ["dhare", "धरे", "holding"],
  ]),
  ...build(3, "Kindle a light on my path.", [
    ["Ámár", "आमार", "my"],
    ["pathe", "पथे", "on the path"],
    ["álo", "आलो", "light"],
    ["jválo", "ज्वालो", "kindle"],
  ]),
]
