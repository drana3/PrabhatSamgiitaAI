/**
 * "Chords first" (Dada, 10 Nov 2026): Prabhat Samgiita songs that have chords come before the rest.
 * Pure rules, no React, no network: the screens give in WHICH songs have chords (the numbers the API sends,
 * `GET /song-chords/with-chords`, read by hooks/useSongsWithChords.ts).
 *
 * Two uses: the "With chords first" sort of the Songs list (lib/songsV2/sort.ts), and Search, which ranks songs
 * with chords first when the person writes a guitar-ish word ("bandhu guitar", "chords for 1", "гитара").
 */

/**
 * The beginnings of the words that ask for chords (matched at the start of a word, so "guitars", "chords",
 * "аккорды" and "гитарой" all count). English, Russian and Spanish, the app's three languages.
 */
export const CHORD_WORD_STEMS: readonly string[] = [
  "guitar", // guitar, guitars, guitarist, guitarra
  "chord", // chord, chords
  "capo", // capo, capotasto
  "ukulele",
  "ukelele",
  "acorde", // Spanish: acorde, acordes
  "гитар", // гитара, гитары, гитарой
  "аккорд", // аккорд, аккорды
  "укулеле",
]

const WORD = /[\p{L}\p{N}]+/gu

function words(query: string): string[] {
  return query.toLocaleLowerCase().match(WORD) ?? []
}

function isChordWord(word: string): boolean {
  return CHORD_WORD_STEMS.some((stem) => word.startsWith(stem))
}

/** Does the query contain a guitar-ish word? */
export function wantsChords(query: string): boolean {
  return words(query).some(isChordWord)
}

/**
 * The query without its guitar-ish words ("bandhu guitar" -> "bandhu"), so the lyric search still finds the song.
 * When nothing would be left (the person typed only "guitar chords") the query is returned as it was.
 */
export function withoutChordWords(query: string): string {
  const trimmed = query.trim()
  const kept = trimmed
    .split(/\s+/)
    .filter((part) => !words(part).some(isChordWord))
    .join(" ")
  return kept ? kept : trimmed
}

/** Songs that have chords first; the rest after them; the order inside both halves is kept (a stable split). */
export function chordsFirst<T>(items: readonly T[], hasChords: (item: T) => boolean | null | undefined): T[] {
  const withChords: T[] = []
  const rest: T[] = []
  for (const item of items) (hasChords(item) ? withChords : rest).push(item)
  return withChords.length && rest.length ? [...withChords, ...rest] : [...items]
}

/** Search rank: chords first when the query asks for chords, else the list exactly as it came. */
export function rankForQuery<T>(items: readonly T[], query: string, hasChords: (item: T) => boolean | null | undefined): T[] {
  return wantsChords(query) ? chordsFirst(items, hasChords) : [...items]
}
