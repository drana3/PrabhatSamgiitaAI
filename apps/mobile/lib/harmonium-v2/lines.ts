import {
  chordReadout,
  parseChord,
  pitchClassOf,
  semitonesFromSa,
  swaraAtSemitone,
  type ChordReadout,
} from "@/lib/harmonium-v2/chords"
import { distributeNotesToWords, type DisplayNote } from "@/lib/sargamDisplay"

/**
 * One lyric line for the harmonium view: the word, the chord letter above it when
 * the chord changes, and the swara to play under it (spec SCR-16 Harmonium and
 * SCR-23 "In the song").
 */
export type HarmoniumLineWord = {
  word: string
  /** chord that starts on this word, as written ("Am"); absent when the chord does not change */
  chord?: string
  /** swara of the melody on this word, as a one-letter token or a name ("Sa", "Re", "-" for a hold) */
  swara?: string
}

export type DisplayWord = {
  word: string
  chord: string | null
  /** "Sa", "re", "Ga", "Ma♯" or "–" for a held note; null when the word has no swara */
  swara: string | null
}

const LATIN_TO_SEMITONES: Record<string, number> = {
  sa: 0,
  re: 2,
  ga: 4,
  ma: 5,
  pa: 7,
  dha: 9,
  ni: 11,
}

const TOKEN_TO_SEMITONES: Record<string, number> = {
  S: 0,
  r: 1,
  R: 2,
  g: 3,
  G: 4,
  m: 5,
  M: 6,
  P: 7,
  d: 8,
  D: 9,
  n: 10,
  N: 11,
}

/** Display name of a swara written as a token ("g") or a name ("Ga"). Null if not a swara. */
export function swaraDisplay(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  if (text === "-" || text === "–") return "–"
  if (text.length === 1 && text in TOKEN_TO_SEMITONES) return swaraAtSemitone(TOKEN_TO_SEMITONES[text]!).latin
  const lower = text.toLowerCase()
  if (lower in LATIN_TO_SEMITONES) {
    // an uppercase first letter stays shuddha; an all-lowercase komal-capable name is kept as written
    const komal = text === text.toLowerCase() && (lower === "re" || lower === "ga" || lower === "dha" || lower === "ni")
    return komal ? text : text[0]!.toUpperCase() + text.slice(1).toLowerCase()
  }
  return null
}

/** Chord letters above words and swaras below them, ready to draw. */
export function buildHarmoniumLine(words: readonly HarmoniumLineWord[]): DisplayWord[] {
  return words.map((entry) => ({
    word: entry.word,
    chord: entry.chord ? (parseChord(entry.chord)?.name ?? entry.chord) : null,
    swara: entry.swara ? swaraDisplay(entry.swara) : null,
  }))
}

/** Distinct chords of a line in the order they appear. */
export function chordsInLine(words: readonly HarmoniumLineWord[]): string[] {
  const seen: string[] = []
  for (const entry of words) {
    const chord = entry.chord ? parseChord(entry.chord)?.name : null
    if (chord && !seen.includes(chord)) seen.push(chord)
  }
  return seen
}

/** Readouts for the chord chips of a song, in a key. Unknown chord names are dropped. */
export function chordChips(names: readonly string[], saName: string): ChordReadout[] {
  const sa = pitchClassOf(saName)
  if (sa === null) return []
  const result: ChordReadout[] = []
  for (const name of names) {
    const chord = parseChord(name)
    if (chord) result.push(chordReadout(chord, sa))
  }
  return result
}

/** Which swara a chord root is, in a key: "Pa" for G in D. Handy for captions. */
export function rootSwara(chordName: string, saName: string): string | null {
  const chord = parseChord(chordName)
  const sa = pitchClassOf(saName)
  if (!chord || sa === null) return null
  return swaraAtSemitone(semitonesFromSa(chord.rootPitchClass, sa)).latin
}

/**
 * The existing notation pipeline (sargamDisplay) gives notes per lyric line; this
 * spreads them over the words and keeps the chord letters of `chordsByWord`
 * (word index to chord name). A word with several notes shows them side by side.
 */
export function wordsFromNotation(
  words: readonly string[],
  notes: readonly DisplayNote[],
  chordsByWord: Readonly<Record<number, string>> = {},
): DisplayWord[] {
  const groups = distributeNotesToWords([...words], [...notes])
  const byWord = new Map(groups.map((group, index) => [index, group] as const))
  return words.map((word, index) => {
    const group = byWord.get(index)
    const chord = chordsByWord[index]
    return {
      word,
      chord: chord ? (parseChord(chord)?.name ?? chord) : null,
      swara: group?.notes.length ? group.notes.map((note) => note.latin).join(" ") : null,
    }
  })
}
