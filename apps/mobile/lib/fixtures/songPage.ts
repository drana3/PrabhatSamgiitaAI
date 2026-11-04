/**
 * TODO(api): sample content of the design prototype for the Song page. The catalog API has no word-by-word
 * glosses, chord charts, plain-words explanations or video list yet (spec API-07, API-14). Until it has,
 * the page shows these samples on top of the real lyrics so every section is complete and clickable.
 * Nothing here is reviewed content. Replace `fixtureExtras` with the API provider in
 * `lib/songPage/songContent.ts` (`extrasForSong`) when the song detail carries it.
 */
import type { ChordChart } from "@/lib/songPage/chordChart"
import { splitWords } from "@/lib/songPage/chordChart"
import { glossKey, type SongExplanation, type SongExtras, type WordGlosses } from "@/lib/songPage/songContent"

type ProtoWord = [roman: string, deva: string, gloss: string]

/** English gloss -> [Russian, French]. */
const GLOSS_TR: Record<string, [string, string]> = {
  friend: ["друг", "ami"],
  O: ["о", "ô"],
  take: ["возьми", "prends"],
  "lead on": ["веди", "conduis"],
  "of light": ["света", "de lumière"],
  spring: ["источник", "source"],
  "in the stream": ["в потоке", "dans le courant"],
  wash: ["омой", "lave"],
  give: ["дай", "donne"],
  your: ["твой", "ton"],
  lap: ["объятия", "giron"],
  me: ["меня", "moi"],
  lifting: ["поднимая", "en levant"],
  "cut away": ["отсекается", "se dissipe"],
  goes: ["уходит", "s'en va"],
  darkness: ["тьма", "ténèbres"],
  "at the end": ["в конце", "à la fin"],
  "in the land": ["в стране", "au pays"],
  You: ["Ты", "Toi"],
  come: ["приди", "viens"],
  "by the hand": ["за руку", "par la main"],
  holding: ["держа", "tenant"],
  my: ["мой", "mon"],
  "on the path": ["на пути", "sur le chemin"],
  light: ["свет", "lumière"],
  kindle: ["зажги", "allume"],
}

/** The words of the prototype's two sample songs (PS 1 and PS 3), used as a glossary for any song. */
const PROTO_WORDS: ProtoWord[] = [
  ["Bandhu", "बन्धु", "friend"],
  ["he", "हे", "O"],
  ["niye", "निये", "take"],
  ["calo", "चलो", "lead on"],
  ["Álor", "आलोर", "of light"],
  ["jharańá", "झरना", "spring"],
  ["dháráy", "धाराय", "in the stream"],
  ["dhuiye", "धुइये", "wash"],
  ["dáo", "दाओ", "give"],
  ["Tomár", "तोमार", "your"],
  ["kole", "कोले", "lap"],
  ["ámáy", "आमाय", "me"],
  ["tule", "तुले", "lifting"],
  ["náo", "नाओ", "take"],
  ["Andhakár", "अन्धकार", "darkness"],
  ["kete", "केटे", "cut away"],
  ["yáy", "याय", "goes"],
  ["Ándhára", "अन्धार", "darkness"],
  ["sheśe", "शेषे", "at the end"],
  ["álora", "आलोर", "of light"],
  ["deshe", "देशे", "in the land"],
  ["Tumi", "तुमि", "You"],
  ["eso", "एसो", "come"],
  ["háte", "हाते", "by the hand"],
  ["dhare", "धरे", "holding"],
  ["Ámár", "आमार", "my"],
  ["pathe", "पथे", "on the path"],
  ["álo", "आलो", "light"],
  ["jválo", "ज्वालो", "kindle"],
]

function wordKey(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}]/gu, "")
    .toLowerCase()
}

const GLOSSARY: Record<string, string> = Object.fromEntries(PROTO_WORDS.map(([r, , g]) => [wordKey(r), g]))

/** The glossary gloss of a Roman word in a language, or null. English and the two sample languages only. */
export function glossaryGloss(roman: string, language: string): string | null {
  const en = GLOSSARY[wordKey(roman)]
  if (!en) return null
  if (language === "ru") return GLOSS_TR[en]?.[0] ?? en
  if (language === "fr") return GLOSS_TR[en]?.[1] ?? en
  return en
}

/** Languages the sample word meanings cover; the prototype calls them "full". */
export const FIXTURE_GLOSS_LANGUAGES = ["en", "ru", "fr"] as const

const CHORD_CYCLE = ["C", "Am", "F", "G"]
const ALT_CYCLE = ["Am", "F", "C", "G"]

/** Chord letters over the lyric the way the prototype places them: word 0 and the middle word of each line. */
export function fixtureChart(lyricLines: string[], songNumber: number): ChordChart {
  const cycle = songNumber === 3 ? ALT_CYCLE : CHORD_CYCLE
  return {
    reviewed: true,
    baseKey: "C",
    strum: "D  D U  U D U",
    lines: lyricLines.map((line, li) => {
      const n = splitWords(line).length
      const placements = [{ word: 0, chord: cycle[li % cycle.length] }]
      const second = Math.ceil(n / 2)
      if (second > 0 && second < n) placements.push({ word: second, chord: cycle[(li + 1) % cycle.length] })
      return { placements }
    }),
  }
}

export function fixtureGlosses(romanLines: string[]): WordGlosses | null {
  const byLanguage: WordGlosses["byLanguage"] = { en: {}, ru: {}, fr: {} }
  romanLines.forEach((line, li) =>
    splitWords(line).forEach((word, wi) => {
      for (const code of FIXTURE_GLOSS_LANGUAGES) {
        const gloss = glossaryGloss(word, code)
        if (gloss) byLanguage[code][glossKey(li, wi)] = gloss
      }
    }),
  )
  return Object.values(byLanguage.en).length ? { byLanguage } : null
}

const EXPLANATIONS: Record<number, SongExplanation> = {
  1: {
    reviewed: true,
    summary:
      "The singer calls the Supreme a friend and asks to be led out of darkness into light. The song moves from asking, to being washed, to being lifted.",
    keyPoints: [
      "Friend, not ruler. The Supreme is addressed as a close companion.",
      "Light and darkness stand for knowledge and ignorance.",
      "The singer does not claim strength. The singer asks to be carried.",
    ],
    keyTerms: [
      { term: "Bandhu", meaning: "friend" },
      { term: "Paramapurus'a", meaning: "the Supreme Consciousness" },
      { term: "Álo", meaning: "light" },
    ],
  },
  3: {
    reviewed: true,
    summary:
      "The singer sees past the dark to a land of light, and asks the Beloved to come and walk there hand in hand.",
    keyPoints: [
      "The dark is not the end. It is the road to the light.",
      "The Beloved is asked to come, not just to be waited for.",
      "The light is kindled on the singer's own path.",
    ],
    keyTerms: [
      { term: "Ándhára", meaning: "darkness" },
      { term: "Álo", meaning: "light" },
      { term: "Desh", meaning: "land, realm" },
    ],
  },
}

/** Central idea shown when the song has none of its own (prototype wording for PS 1). */
export const FIXTURE_CENTRAL_IDEA: Record<number, string> = {
  1: "Paramapurus'a, the Supreme Consciousness, is presented as the true friend who guides the seeker out of darkness.",
}

/** TODO(api): the sample extras of the page. Explanation only exists for the two prototype songs. */
export function fixtureExtras(romanLines: string[], songNumber: number): SongExtras {
  return {
    chart: romanLines.length ? fixtureChart(romanLines, songNumber) : null,
    glosses: fixtureGlosses(romanLines),
    explanation: EXPLANATIONS[songNumber] ?? null,
  }
}

/** TODO(api): "More videos" rows of the Watch section (placeholder titles of the prototype). */
export const FIXTURE_MORE_VIDEOS = [
  { name: "Kiirtan with the group", meta: "Placeholder", len: "4:12" },
  { name: "Lyrics on screen", meta: "Placeholder", len: "3:58" },
]

/** TODO(api): playlists of the signed-in user until the playlist store feeds the sheet (it does when signed in). */
export const FIXTURE_PLAYLISTS = [
  { id: "fx-morning", name: "Morning meditation", songs: [1, 3, 5] },
  { id: "fx-evening", name: "Evening kiirtan", songs: [2, 4, 6, 7] },
]
