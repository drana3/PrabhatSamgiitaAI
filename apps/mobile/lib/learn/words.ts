/** A vocabulary word taken from a song, the unit of the Learn word cards. */
export type LearnWord = {
  id: string
  roman: string
  devanagari: string
  meaning: string
  /** one example line from the song, shown after the card is flipped */
  example: string
  songNumber: number
}

/** Stable id from the song number and the Roman spelling. */
export function wordId(songNumber: number, roman: string): string {
  const slug = roman
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
  return `ps${songNumber}-${slug}`
}

/** Words that belong to one song. */
export function wordsForSong(words: readonly LearnWord[], songNumber: number): LearnWord[] {
  return words.filter((word) => word.songNumber === songNumber)
}

/** Words of the given songs, each word once, in the order of the song list. */
export function wordsForSongs(words: readonly LearnWord[], songNumbers: readonly number[]): LearnWord[] {
  const seen = new Set<string>()
  const result: LearnWord[] = []
  for (const number of songNumbers) {
    for (const word of words) {
      if (word.songNumber !== number || seen.has(word.id)) continue
      seen.add(word.id)
      result.push(word)
    }
  }
  return result
}

function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
}

/** One word per calendar day, the same all day. */
export function wordOfTheDay(words: readonly LearnWord[], date: Date): LearnWord | null {
  if (words.length === 0) return null
  return words[dayNumber(date) % words.length] ?? null
}

/** The words to practise: those of the given songs, or the whole starter deck when there are none. */
export function pickDeck(all: readonly LearnWord[], songNumbers: readonly number[]): LearnWord[] {
  const own = wordsForSongs(all, songNumbers)
  return own.length ? own : [...all]
}

/** Song numbers from ids like "ps-12". */
export function songNumbersFromIds(ids: readonly string[]): number[] {
  const numbers: number[] = []
  for (const id of ids) {
    const match = /^ps-(\d+)$/i.exec(id)
    if (match) numbers.push(Number(match[1]))
  }
  return numbers
}
