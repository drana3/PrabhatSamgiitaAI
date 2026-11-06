import { splitWords } from "@/lib/songPage/chordChart"
import { MAX_CAPO } from "@/lib/songPage/chords"

import { cleanChordName, isChordName } from "./chordName"
import type { Placement } from "./draft"

/**
 * The plain-text way to enter chords: ChordPro-style, a chord in square brackets in front of the word it changes on.
 *
 *     {capo: 2}
 *     {key: G}
 *     [G]Bhaja mana [Em]nirantara
 *
 * The pasted lines are matched to the song's lyric lines in order (blank lines are ignored), and the words of a pasted
 * line to the words of the lyric line by position. Nothing is guessed: a line with another number of words than the
 * lyric is an error that says which line and how many words were expected. The result is the same `Placement` lists
 * the tap editor works on, so both ways end in one structure.
 */

export type IssueCode =
  | "unclosed" // a "[" without its "]"
  | "emptyChord" // "[]"
  | "badChord" // not a chord name
  | "wordCount" // a line has another number of words than the lyric line
  | "extraLines" // more lines than the song has
  | "trailingChord" // a chord at the end of a line with no word after it
  | "secondChord" // two chords on one word: the first is kept (warning)
  | "wordMismatch" // the words differ from the lyric (warning)
  | "fewerLines" // fewer lines than the song has (warning)
  | "badCapo" // {capo: x} is not 0 to 7

export type ParseIssue = {
  level: "error" | "warning"
  code: IssueCode
  /** 1-based line of the pasted text */
  line: number
  /** 1-based column, when the problem is at a place in the line */
  column?: number
  params?: Record<string, string | number>
}

export type ParseMeta = { capo?: number; key?: string; strum?: string }

export type ParseResult = {
  /** one list per lyric line */
  lines: Placement[][]
  meta: ParseMeta
  issues: ParseIssue[]
  /** no errors (warnings are allowed) */
  ok: boolean
}

export function normaliseWord(word: string): string {
  return word.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
}

type ParsedLine = { words: string[]; chords: Map<number, string>; issues: ParseIssue[] }

function parseLine(text: string, lineNo: number): ParsedLine {
  const words: string[] = []
  const chords = new Map<number, string>()
  const issues: ParseIssue[] = []
  let current = ""
  let pending: { chord: string; column: number } | null = null

  const give = (index: number, chord: string, column: number) => {
    if (chords.has(index)) issues.push({ level: "warning", code: "secondChord", line: lineNo, column, params: { chord, kept: chords.get(index) ?? "" } })
    else chords.set(index, chord)
  }
  const endWord = () => {
    if (current) {
      words.push(current)
      current = ""
    }
  }

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === "[") {
      const close = text.indexOf("]", i + 1)
      if (close < 0) {
        issues.push({ level: "error", code: "unclosed", line: lineNo, column: i + 1 })
        return { words, chords, issues }
      }
      const raw = text.slice(i + 1, close)
      const name = cleanChordName(raw)
      if (!name) issues.push({ level: "error", code: "emptyChord", line: lineNo, column: i + 1 })
      else if (!isChordName(name)) issues.push({ level: "error", code: "badChord", line: lineNo, column: i + 1, params: { chord: raw.trim() } })
      else if (current) give(words.length, name, i + 1) // inside a word: it belongs to that word
      else if (pending) issues.push({ level: "warning", code: "secondChord", line: lineNo, column: i + 1, params: { chord: name, kept: pending.chord } }) // two in a row: the first is kept
      else pending = { chord: name, column: i + 1 }
      i = close
      continue
    }
    if (/\s/.test(ch)) {
      endWord()
      continue
    }
    if (!current) {
      // a new word starts here: a chord waiting in front of it lands on it
      if (pending) {
        give(words.length, pending.chord, pending.column)
        pending = null
      }
    }
    current += ch
  }
  endWord()
  if (pending) issues.push({ level: "error", code: "trailingChord", line: lineNo, column: pending.column, params: { chord: pending.chord } })
  return { words, chords, issues }
}

/** Read the directives `{capo: 2}`, `{key: G}`, `{strum: D D U}`; other `{...}` lines are ignored. */
function directive(text: string, lineNo: number, meta: ParseMeta, issues: ParseIssue[]): boolean {
  const match = /^\{\s*([a-zA-Z_]+)\s*:?\s*(.*?)\s*\}?\s*$/.exec(text)
  if (!match) return true
  const [, name, value] = match
  const lower = name.toLowerCase()
  if (lower === "capo") {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 0 || n > MAX_CAPO) issues.push({ level: "error", code: "badCapo", line: lineNo, params: { value } })
    else meta.capo = n
  } else if (lower === "key") {
    const key = cleanChordName(value)
    if (/^[A-G][#b]?$/.test(key)) meta.key = key
    else issues.push({ level: "error", code: "badChord", line: lineNo, params: { chord: value } })
  } else if (lower === "strum") {
    meta.strum = value
  }
  return true
}

export function parseChordPro(text: string, lyricLines: readonly string[]): ParseResult {
  const meta: ParseMeta = {}
  const issues: ParseIssue[] = []
  const lines: Placement[][] = lyricLines.map(() => [])
  const source = text.replace(/\r\n?/g, "\n").split("\n")
  let used = 0
  let extraReported = false

  source.forEach((raw, index) => {
    const lineNo = index + 1
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith("#")) return
    if (trimmed.startsWith("{")) {
      directive(trimmed, lineNo, meta, issues)
      return
    }
    const k = used
    used += 1
    if (k >= lyricLines.length) {
      if (!extraReported) {
        issues.push({ level: "error", code: "extraLines", line: lineNo, params: { allowed: lyricLines.length } })
        extraReported = true
      }
      return
    }
    const parsed = parseLine(raw, lineNo)
    issues.push(...parsed.issues)
    if (parsed.issues.some((i) => i.level === "error")) return
    const lyricWords = splitWords(lyricLines[k])
    if (parsed.words.length !== lyricWords.length) {
      issues.push({ level: "error", code: "wordCount", line: lineNo, params: { lyricLine: k + 1, expected: lyricWords.length, found: parsed.words.length } })
      return
    }
    const differs = parsed.words.findIndex((w, i) => normaliseWord(w) !== normaliseWord(lyricWords[i]))
    if (differs >= 0) {
      issues.push({ level: "warning", code: "wordMismatch", line: lineNo, params: { lyricLine: k + 1, typed: parsed.words[differs], expected: lyricWords[differs] } })
    }
    lines[k] = Array.from(parsed.chords.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([word, chord]) => ({ word, chord }))
  })

  if (used > 0 && used < lyricLines.length) issues.push({ level: "warning", code: "fewerLines", line: source.length, params: { found: used, expected: lyricLines.length } })
  return { lines, meta, issues, ok: !issues.some((i) => i.level === "error") }
}

/** The chords as text, one line per lyric line, ready to edit or to copy out. */
export function toChordPro(lines: ReadonlyArray<ReadonlyArray<Placement>>, lyricLines: readonly string[]): string {
  return lyricLines
    .map((lyric, i) => {
      const at = new Map((lines[i] ?? []).map((p) => [p.word, p.chord]))
      return splitWords(lyric)
        .map((word, w) => (at.has(w) ? `[${at.get(w)}]${word}` : word))
        .join(" ")
    })
    .join("\n")
}
