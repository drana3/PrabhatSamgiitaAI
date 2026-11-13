import type { ColleagueChart } from "./chords"

/**
 * A colleague's chord page is a monospace text: a line of chord symbols sits above the line of words it belongs to, and
 * the symbol stands over the column where the chord changes. The song page draws its own chart as chord letters over
 * words that wrap, so this turns the monospace page into the same thing: one token per word with the chord over it.
 *
 * Nothing is corrected: every word and every chord symbol is kept character for character and in order. The only
 * decision is which word a symbol stands over: the word whose columns hold the symbol's column; when the document
 * aligned it by eye and the symbol falls between words, the nearest word (the later one when both are as near). Two
 * symbols over one word are written together over it ("G D"). Pure.
 */

/** `breakBefore`: the document leaves a wide gap (three spaces or more) before this word, where its lyric line ends and the next begins. */
export type PairToken = { chord: string; word: string; breakBefore?: boolean }
/** One row of the page: tokens that wrap; `gapBefore` is true when the document leaves an empty line above it (a new stanza). */
export type PairRow = { tokens: PairToken[]; gapBefore: boolean }

type Piece = { text: string; start: number; end: number }

function pieces(line: string): Piece[] {
  const out: Piece[] = []
  const re = /\S+/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) out.push({ text: m[0], start: m.index, end: m.index + m[0].length })
  return out
}

/** The index of the word a column belongs to: inside a word's columns, else the nearest word (the later one on a tie). */
function wordAt(words: readonly Piece[], column: number): number {
  let best = -1
  let bestDistance = Infinity
  for (let i = 0; i < words.length; i++) {
    const w = words[i] as Piece
    const distance = column < w.start ? w.start - column : column >= w.end ? column - (w.end - 1) : 0
    if (distance < bestDistance || (distance === bestDistance && distance > 0)) {
      best = i
      bestDistance = distance
    }
    if (distance === 0) break
  }
  return best
}

/** One chord line laid over one words line. */
export function pairLine(chordLine: string, wordLine: string): PairToken[] {
  const words = pieces(wordLine)
  const chords = pieces(chordLine)
  const over: string[][] = words.map(() => [])
  for (const c of chords) {
    const at = wordAt(words, c.start)
    if (at >= 0) (over[at] as string[]).push(c.text)
  }
  return words.map((w, i) => {
    const token: PairToken = { chord: (over[i] as string[]).join(" "), word: w.text }
    if (i > 0 && w.start - (words[i - 1] as Piece).end >= 3) token.breakBefore = true
    return token
  })
}

/**
 * The words of a line the way the song's own chart writes them: a line the document sets entirely in capitals ("BANDHU HE
 * NIYE CALO  x2") becomes sentence case, diacritics kept, the "x2" marks left alone. A line that already has lower case is
 * left as it is. The same rule as the catalogue's own Roman text (scripts.toSentenceCase); the columns do not move.
 */
export function softCaseLine(line: string): string {
  const isMark = (w: string) => /^[x×]\d+$/i.test(w)
  const letters = line
    .split(/\s+/)
    .filter((w) => w && !isMark(w))
    .join("")
    .replace(/[^\p{L}]/gu, "")
  if (!letters || letters !== letters.toUpperCase() || letters === letters.toLowerCase()) return line
  let first = true
  return line.replace(/\S+/gu, (w) => {
    if (isMark(w)) return w
    const lower = w.toLowerCase()
    if (!first) return lower
    first = false
    const i = lower.search(/\p{L}/u)
    return i < 0 ? lower : lower.slice(0, i) + lower.charAt(i).toUpperCase() + lower.slice(i + 1)
  })
}

/** The whole page as rows of tokens. A chord line with no words line under it (or in a PDF page) is a row of chords alone. */
export function pairsOfChart(chart: Pick<ColleagueChart, "lines" | "chordLines">, words: (line: string) => string = (line) => line): PairRow[] {
  const isChord = new Set(chart.chordLines)
  const rows: PairRow[] = []
  let gap = false
  const lines = chart.lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    if (!line.trim()) {
      gap = rows.length > 0
      continue
    }
    if (isChord.has(i)) {
      const next = lines[i + 1]
      if (next !== undefined && next.trim() && !isChord.has(i + 1)) {
        rows.push({ tokens: pairLine(line, words(next)), gapBefore: gap })
        i += 1
      } else {
        rows.push({ tokens: pieces(line).map((p) => ({ chord: p.text, word: "" })), gapBefore: gap })
      }
    } else {
      rows.push({ tokens: pairLine("", words(line)), gapBefore: gap })
    }
    gap = false
  }
  return rows
}
