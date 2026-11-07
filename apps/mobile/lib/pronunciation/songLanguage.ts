import { MIXED_SONGS, SANSKRIT_SONGS } from "@/data/pronunciation/songLanguages"
import type { PronLanguage } from "@/data/pronunciation/types"
import { normalizeRoman } from "./symbols"

/**
 * Which memo a song gets. The catalogue does not say what language a song is in, so this reads the Roman text:
 * "bengali", "sanskrit", or "both" when it cannot say (a song with a Sanskrit verse and Bengali verses).
 *
 * The page never hides the other language: the memo always offers a switch. So a wrong guess costs one tap and is
 * never silent. Against the 5018 songs of data/generated/songs.json this gives 6 Sanskrit songs and 4 mixed ones; the
 * rest are Bengali (about 5% have too little text to tell and are Bengali by default, which is what almost all of
 * the catalogue is). docs/pronunciation.md explains how this was checked.
 */
export type SongPronLanguage = PronLanguage | "both"

// Frequent Bengali function words that Sanskrit lines do not use (Roman, the catalogue's spelling).
const BENGALI_WORDS = new Set(
  "tumi ámi ámár ámáy ámake tomár tomáy tomá tomake tár táke tái ei oi ár je se ki kena keno ná nái áchi áche ácho áchhe chilo chile chilám chilum hobe hoy hoye haye kare kari karo kareche kothá kothái niye diye theke jabe jáy jái dekhi bale balo mor mora more tabu tabe tobe kata sab sabái kichu ebár ekhan ekhano tokhan jakhan kakhano kemon keu kono jodi shudhu gelo elo esechi esecho eso jáni jáno dekhe dekho bhálo habe tomra tomrá emon".split(
    " ",
  ),
)
// Frequent Sanskrit function words.
const SANSKRIT_WORDS = new Set(
  "namah namo namámi tvam aham ahaḿ asti bhavati bhavanti eva iti yah sah tasya tasmai tasmin yat tat sarvam atha kim yatra tatra atra kutah na ca hi".split(
    " ",
  ),
)
const SANSKRIT_ENDING = /(aḿ|ah|ih|uh|am|ám)$/u

function wordsOf(line: string): string[] {
  return line.match(/[\p{L}\p{M}]+/gu) ?? []
}

/** The text alone: "sanskrit" when most lines read as Sanskrit and almost none as Bengali, otherwise "bengali". */
export function languageFromText(roman: string): PronLanguage {
  const lines = normalizeRoman(roman)
    .split("\n")
    .map(wordsOf)
    .filter((words) => words.length > 0)
  if (lines.length === 0) return "bengali"
  let bengali = 0
  let sanskrit = 0
  for (const words of lines) {
    const b = words.filter((w) => BENGALI_WORDS.has(w)).length
    const s = words.filter((w) => SANSKRIT_WORDS.has(w) || (SANSKRIT_ENDING.test(w) && w.length > 4 && !BENGALI_WORDS.has(w))).length
    if (b && b >= s) bengali++
    else if (s > b) sanskrit++
  }
  return sanskrit / lines.length >= 0.5 && bengali / lines.length < 0.15 ? "sanskrit" : "bengali"
}

/** The memo language of a song: the hand-checked lists first, then the text. */
export function songPronLanguage(songNumber: number | null | undefined, roman: string): SongPronLanguage {
  if (songNumber != null) {
    if (MIXED_SONGS.includes(songNumber)) return "both"
    if (SANSKRIT_SONGS.includes(songNumber)) return "sanskrit"
  }
  return languageFromText(roman)
}
