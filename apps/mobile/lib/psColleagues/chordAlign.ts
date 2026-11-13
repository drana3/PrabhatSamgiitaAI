import { splitWords, type WordColumn } from "@/lib/songPage/chordChart"

import { pairsOfChart, softCaseLine, type PairRow } from "./chordPairs"
import type { ColleagueChart } from "./chords"

/**
 * Lays a colleague's chord page over the song's own lines, so the chord letters stand over the same words of the same
 * lines the song page shows (and in the script it shows), not in a block of their own.
 *
 * The page gives the chord symbols over the words of the document (see chordPairs). Here the words of the document
 * and the words of the song are laid side by side in order (a global alignment; spelling differs a little between the
 * two texts, so words are compared by their letters with accents and doubled letters left off, a similarity of at
 * least 0.55), and every chord goes over the song's word that matches the document's word it stood over. Nothing is
 * guessed: when the document cannot be laid over the song without losing a chord (a chord-bearing stretch of the
 * document that matches nothing and is not a repeat of one that did, a page with no words at all, too little of the song
 * matched), the result is `list` and the page shows the document's own rows as a separate list. Chord symbols are never changed.
 * Pure, no React.
 */

export type AlignResult =
  | {
      kind: "aligned"
      /** one entry per line of the song, one column per word of the line; `chord` is the document's symbols over that word */
      columns: WordColumn[][]
      /** chord rows the document keeps apart from the words (an intro, an interlude), in order */
      apart: string[][]
      /** words of the song the document has a word for, and all words */
      matched: number
      total: number
    }
  | { kind: "list"; reason: "no-words" | "no-text" | "lost-chords" | "few-words" }

/** Letters only, accents, case and doubled letters off ("Jharańá" and "JHARŃÁ" are one word, "ámá-a-a-r" is "amar"). */
export function wordKey(word: string): string {
  return word
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}]/gu, "")
    .replace(/(\p{L})\1+/gu, "$1")
}

function distance(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] as number
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j] as number
      prev[j] = Math.min(up + 1, (prev[j - 1] as number) + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = up
    }
  }
  return prev[b.length] as number
}

const SAME_WORD = 0.55
/** Share of the song's words the document must have a word for. */
const MIN_WORDS = 0.7
const GAP = -0.3
const MISS = -0.6

export function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  return 1 - distance(a, b) / Math.max(a.length, b.length)
}

type DocWord = { word: string; chord: string; key: string; phrase: number }

const isMark = (w: string) => /^[x×]\d+$/i.test(w)

/**
 * The words of the document in order, each with the chords over it, and the rows of chords alone. A chord over an "x2"
 * mark belongs to the word before it (the next one when the mark opens the phrase); a phrase of marks alone joins the
 * phrase before it. `phrase` counts the stretches the document sets apart (a wide gap, a new row).
 */
function docWordsOf(rows: readonly PairRow[]): { words: DocWord[]; apart: string[][]; phrases: number } {
  const words: DocWord[] = []
  const apart: string[][] = []
  let phrase = -1
  let carry = ""
  for (const row of rows) {
    if (row.tokens.every((t) => t.word === "")) {
      apart.push(row.tokens.map((t) => t.chord))
      continue
    }
    let opened = false
    row.tokens.forEach((t, i) => {
      if (!opened || (t.breakBefore && i > 0)) {
        // a stretch of marks alone does not start a phrase: it is added to the one before when the next token is read
        opened = true
        phrase += 1
      }
      if (isMark(t.word)) {
        if (t.chord) {
          const last = words[words.length - 1]
          if (last && last.phrase >= phrase - 1) last.chord = [last.chord, t.chord].filter(Boolean).join(" ")
          else carry = [carry, t.chord].filter(Boolean).join(" ")
        }
        return
      }
      words.push({ word: t.word, chord: [carry, t.chord].filter(Boolean).join(" "), key: wordKey(t.word), phrase })
      carry = ""
    })
  }
  return { words, apart, phrases: phrase + 1 }
}

type Pair = [doc: number, main: number]

/** The best order-keeping pairing of the document's words with the song's words (words that sound alike, nothing else). */
function alignWords(doc: readonly DocWord[], main: readonly string[]): Pair[] {
  const n = doc.length
  const m = main.length
  const cache = new Map<string, number>()
  const sim = (a: string, b: string) => {
    const k = `${a}|${b}`
    let v = cache.get(k)
    if (v === undefined) {
      v = similarity(a, b)
      cache.set(k, v)
    }
    return v
  }
  const W = m + 1
  const best = new Float32Array((n + 1) * W)
  // either text may begin or end with words the other lacks: no cost at the ends
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = sim((doc[i - 1] as DocWord).key, main[j - 1] as string)
      const diag = (best[(i - 1) * W + j - 1] as number) + (s >= SAME_WORD ? s : MISS)
      const up = (best[(i - 1) * W + j] as number) + (j === m ? 0 : GAP)
      const left = (best[i * W + j - 1] as number) + (i === n ? 0 : GAP)
      best[i * W + j] = Math.max(diag, up, left)
    }
  }
  const pairs: Pair[] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    const here = best[i * W + j] as number
    const s = sim((doc[i - 1] as DocWord).key, main[j - 1] as string)
    if (s >= SAME_WORD && Math.abs(here - ((best[(i - 1) * W + j - 1] as number) + s)) < 1e-4) {
      pairs.push([i - 1, j - 1])
      i--
      j--
    } else if (Math.abs(here - ((best[(i - 1) * W + j] as number) + (j === m ? 0 : GAP))) < 1e-4) i--
    else if (Math.abs(here - ((best[i * W + j - 1] as number) + (i === n ? 0 : GAP))) < 1e-4) j--
    else {
      i--
      j--
    }
  }
  return pairs.reverse()
}

/** Lays the chart over the lines of the song (`lines`: the Roman lines the page shows), or says why it cannot be done honestly. */
export function alignChart(chart: ColleagueChart, lines: readonly string[]): AlignResult {
  if (!chart.hasWords) return { kind: "list", reason: "no-words" }
  const mainLines = lines.map((line) => splitWords(line))
  const flat: Array<{ line: number; at: number; key: string }> = []
  mainLines.forEach((words, line) => words.forEach((w, at) => flat.push({ line, at, key: wordKey(w) })))
  if (!flat.length) return { kind: "list", reason: "no-text" }
  const { words: doc, apart, phrases } = docWordsOf(pairsOfChart(chart, softCaseLine))
  if (!doc.length) return { kind: "list", reason: "no-words" }

  const pairs = alignWords(doc, flat.map((f) => f.key))
  const toMain = new Map<number, number>(pairs)
  const columns: WordColumn[][] = mainLines.map((words) => words.map((word) => ({ word, chord: null })))
  const place = (d: number, mainIndex: number) => {
    const f = flat[mainIndex] as { line: number; at: number }
    const col = (columns[f.line] as WordColumn[])[f.at] as WordColumn
    const chord = (doc[d] as DocWord).chord
    col.chord = [col.chord, chord].filter(Boolean).join(" ")
  }
  // per phrase of the document: how many of its words found a place
  const matchedIn = new Array<number>(phrases).fill(0)
  const sizeIn = new Array<number>(phrases).fill(0)
  doc.forEach((w, d) => {
    sizeIn[w.phrase] = (sizeIn[w.phrase] as number) + 1
    if (toMain.has(d)) matchedIn[w.phrase] = (matchedIn[w.phrase] as number) + 1
  })
  const covered = (p: number) => (matchedIn[p] as number) / Math.max(1, sizeIn[p] as number) >= 0.5
  const wordsOf = (p: number) => doc.filter((w) => w.phrase === p)
  const coveredPhrases = Array.from({ length: phrases }, (_, p) => p).filter(covered).map(wordsOf)
  /** The phrase says the same words with the same chords as a stretch of a phrase that found its place: a repeat, nothing is lost by leaving it out. */
  const isRepeat = (p: number) => {
    const mine = wordsOf(p)
    return coveredPhrases.some((other) => {
      for (let at = 0; at + mine.length <= other.length; at++) {
        if (mine.every((w, k) => w.chord === (other[at + k] as DocWord).chord && similarity(w.key, (other[at + k] as DocWord).key) >= SAME_WORD)) return true
      }
      return false
    })
  }

  let lost = false
  doc.forEach((w, d) => {
    if (!w.chord) return
    let target = toMain.get(d)
    if (target === undefined && covered(w.phrase)) {
      // a word of a covered phrase the song spells too differently: its chord goes over the nearest matched word of that phrase
      let near = -1
      for (let k = 1; k < 4 && near < 0; k++) {
        for (const e of [d + k, d - k]) {
          const other = doc[e]
          if (other && other.phrase === w.phrase && toMain.has(e)) {
            near = e
            break
          }
        }
      }
      if (near >= 0) target = toMain.get(near)
    }
    if (target !== undefined) place(d, target)
    else if (!isRepeat(w.phrase)) lost = true
  })
  if (lost) return { kind: "list", reason: "lost-chords" }
  if (pairs.length / flat.length < MIN_WORDS) return { kind: "list", reason: "few-words" }
  return { kind: "aligned", columns, apart, matched: pairs.length, total: flat.length }
}
