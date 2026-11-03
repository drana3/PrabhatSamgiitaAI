import { wordId, type LearnWord } from "@/lib/learn/words"

/**
 * SAMPLE CONTENT. The catalog has no word-by-word glosses yet (spec API-07 and
 * API-12). These words and meanings are placeholders from the design mockup for
 * PS 1 and PS 3, to be replaced by the reviewed word list from the API.
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
    ["Niye", "निये", "take"],
    ["Calo", "चलो", "lead on"],
  ]),
  ...build(1, "Wash me in the flowing stream of light.", [
    ["Álor", "आलोर", "of light"],
    ["Jharańá", "झरना", "spring"],
    ["Dháráy", "धाराय", "in the stream"],
    ["Dhuiye", "धुइये", "wash"],
  ]),
  ...build(1, "Lift me into your lap.", [
    ["Tomár", "तोमार", "your"],
    ["Kole", "कोले", "lap"],
    ["Tule", "तुले", "lifting"],
  ]),
  ...build(1, "Let the darkness be cut away.", [
    ["Andhakár", "अन्धकार", "darkness"],
    ["Kete", "केटे", "cut away"],
  ]),
  ...build(3, "At the end of the dark, in the land of light.", [
    ["Ándhára", "अन्धार", "dark"],
    ["Sheśe", "शेषे", "at the end"],
    ["Deshe", "देशे", "in the land"],
  ]),
  ...build(3, "You come, holding my hand.", [
    ["Tumi", "तुमि", "you"],
    ["Eso", "एसो", "come"],
    ["Háte", "हाते", "by the hand"],
  ]),
  ...build(3, "Kindle a light on my path.", [
    ["Pathe", "पथे", "on the path"],
    ["Jválo", "ज्वालो", "kindle"],
  ]),
]
