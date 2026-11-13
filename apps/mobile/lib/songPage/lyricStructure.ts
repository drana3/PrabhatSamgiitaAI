import { splitLyricLines } from "@/lib/sargamDisplay"

/**
 * The shape of a song's lyrics, read from the text the catalogue stores, and nothing else.
 *
 * What the catalogue stores (data/generated/songs.json, the API's `lyrics_original` and `lyrics_devanagari`, and
 * what the website prints): one text per script, one lyric line per `\n`. There are no blank lines between
 * stanzas, no refrain markers and no indentation in any of the 5,017 songs that have lyrics. So the structure that
 * exists is the order of the lines and the lines that come back word for word. This parser keeps everything the
 * text does carry, if a song ever has it (blank line = stanza break, leading spaces = indent, "(2x)" = a repeat
 * marker, a line that is only "Refrain" or "Chorus" = a label) and, only when the text has no stanza break of its
 * own, draws a break where the song returns to its first line (derived, and flagged so). A "Refrain" label is
 * written only when the text says so or when a whole stanza is a word-for-word repeat of lines sung before.
 * Nothing is invented, merged or dropped.
 */

/** Letters only, no accents, lower case: "E gán ámár, álor" and "E gan amar alor" are the same line. */
export function foldLine(line: string): string {
  return line
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
}

/** For each line, the index of the first earlier line it repeats, or null. */
export function repeatsOf(lines: readonly string[]): Array<number | null> {
  const seen = new Map<string, number>()
  return lines.map((line, index) => {
    const key = foldLine(line)
    if (!key) return null
    const first = seen.get(key)
    if (first === undefined) {
      seen.set(key, index)
      return null
    }
    return first
  })
}

/** Inclusive line range of a stanza. */
export type Stanza = { from: number; to: number }

/**
 * Where a stanza starts when the text does not say: where the song returns to its first line, unless that only
 * repeats the line just sung. A last "stanza" of one line (the first line sung once more at the end) stays with
 * the stanza before. A song that never returns to its first line is one stanza.
 */
export function splitStanzas(lines: readonly string[]): Stanza[] {
  if (!lines.length) return []
  const head = foldLine(lines[0] as string)
  const starts = [0]
  if (head) {
    for (let i = 1; i < lines.length; i += 1) {
      const last = starts[starts.length - 1] as number
      if (foldLine(lines[i] as string) === head && i - last >= 2) starts.push(i)
    }
  }
  const stanzas: Stanza[] = starts.map((from, k) => ({ from, to: (starts[k + 1] ?? lines.length) - 1 }))
  if (stanzas.length > 1) {
    const tail = stanzas[stanzas.length - 1] as Stanza
    if (tail.from === tail.to) {
      stanzas.pop()
      ;(stanzas[stanzas.length - 1] as Stanza).to = tail.to
    }
  }
  return stanzas
}

export type LyricLine = {
  /** index into `LyricStructure.lines` (the same index the translation pairs and the word meanings use) */
  index: number
  text: string
  /** 0 to 3 steps in from the left, from the leading spaces or tabs of the stored line */
  indent: number
  /** the first earlier line this one repeats word for word, or null */
  repeatOf: number | null
  /** "(2x)", "[x3]": how many times the text itself says the line is sung, or null */
  times: number | null
}

export type LyricBlock = {
  lines: LyricLine[]
  /** the text itself separates this block from the one before (a blank line); false when the break is derived */
  explicit: boolean
  /** "refrain": the text labels it so, or every line of it is a repeat of lines sung before */
  label: "refrain" | null
  /** the label as the text wrote it ("Chorus"), when the text wrote one */
  labelText: string | null
}

export type LyricStructure = {
  /** every lyric line in order, trimmed, blank lines and label lines left out */
  lines: string[]
  blocks: LyricBlock[]
  /** blank lines found in the stored text (0 in the real catalogue) */
  explicitBreaks: number
  /** the blocks come from the "returns to the first line" rule, not from the text */
  derived: boolean
  /** at least one line repeats an earlier line word for word */
  hasRepeats: boolean
  /** at least one line carries a "(2x)" marker */
  hasMarkers: boolean
  /** at least one line is indented in the stored text */
  hasIndent: boolean
}

const MARKER = /\s*[([]\s*(?:[x×]\s*(\d{1,2})|(\d{1,2})\s*[x×])\s*[)\]]\s*$/i
const LABEL = /^[[(]?\s*(refrain|chorus|pallavi|mukhda|sthayi)\s*[\])]?\s*:?\s*$/i

/** Width of the leading blanks (a tab is four), as 0 to 3 steps of two spaces. */
export function indentOf(raw: string): number {
  const lead = /^[ \t]*/.exec(raw)?.[0] ?? ""
  let width = 0
  for (const ch of lead) width += ch === "\t" ? 4 : 1
  return Math.min(3, Math.round(width / 2))
}

export function markerTimes(line: string): number | null {
  const m = MARKER.exec(line)
  if (!m) return null
  const n = Number(m[1] ?? m[2])
  return Number.isFinite(n) && n >= 2 ? n : null
}

type Raw = { text: string; indent: number; breakBefore: boolean; label: string | null }

function readRaw(text: string, transform: (line: string) => string): { raw: Raw[]; breaks: number } {
  const rows = text.split(/\r?\n/)
  const nonBlank = rows.filter((row) => row.trim()).length
  if (nonBlank <= 1) {
    // one run of text: the catalogue's own fallback splits it at | । ॥ /
    return {
      raw: splitLyricLines(text).map((line) => ({ text: transform(line), indent: 0, breakBefore: false, label: null })),
      breaks: 0,
    }
  }
  const raw: Raw[] = []
  let breakNext = false
  let blankSeen = false
  let labelNext: string | null = null
  let breaks = 0
  for (const row of rows) {
    const trimmed = row.trim()
    if (!trimmed) {
      // a blank line is a break only when a lyric line follows it (trailing blanks are nothing)
      if (raw.length) {
        breakNext = true
        blankSeen = true
      }
      continue
    }
    const label = LABEL.exec(trimmed)
    if (label) {
      labelNext = trimmed.replace(/^[[(]\s*/, "").replace(/\s*[\])]?\s*:?\s*$/, "")
      if (raw.length && !breakNext) breakNext = true
      continue
    }
    if (blankSeen) breaks += 1
    raw.push({ text: transform(trimmed), indent: indentOf(row), breakBefore: breakNext, label: labelNext })
    breakNext = false
    blankSeen = false
    labelNext = null
  }
  return { raw, breaks }
}

const EMPTY: LyricStructure = { lines: [], blocks: [], explicitBreaks: 0, derived: false, hasRepeats: false, hasMarkers: false, hasIndent: false }

/**
 * Read one stored lyric text (one script) into lines and blocks. `transform` is applied to every line
 * (the page passes sentence case for the Roman text); the result's `lines` are exactly the lines
 * `buildLyricSources` gives for the same text, so line numbers agree with the translation and word meanings.
 */
export function parseLyricStructure(text: string | null | undefined, transform: (line: string) => string = (line) => line): LyricStructure {
  if (!text?.trim()) return EMPTY
  const { raw, breaks } = readRaw(text, transform)
  const lines = raw.map((row) => row.text)
  const repeats = repeatsOf(lines)
  const parsed: LyricLine[] = raw.map((row, index) => ({
    index,
    text: row.text,
    indent: row.indent,
    repeatOf: repeats[index] ?? null,
    times: markerTimes(row.text),
  }))
  const labelled = raw.some((row) => row.label)
  const explicit = breaks > 0 || labelled

  // block boundaries: the text's own, else derived from the lines
  let groups: Array<{ from: number; to: number; label: string | null }>
  if (explicit) {
    const starts = raw.flatMap((row, i) => (i === 0 || row.breakBefore ? [i] : []))
    groups = starts.map((from, k) => ({ from, to: (starts[k + 1] ?? raw.length) - 1, label: raw[from]?.label ?? null }))
  } else {
    groups = splitStanzas(lines).map((s) => ({ ...s, label: null }))
  }
  const blocks: LyricBlock[] = groups.map((group, k) => {
    const members = parsed.slice(group.from, group.to + 1)
    const allRepeat = k > 0 && members.length > 0 && members.every((line) => line.repeatOf !== null)
    return {
      lines: members,
      explicit: explicit && (k === 0 || Boolean(raw[group.from]?.breakBefore)),
      label: group.label || allRepeat ? "refrain" : null,
      labelText: group.label,
    }
  })
  return {
    lines,
    blocks,
    explicitBreaks: breaks,
    derived: !explicit && blocks.length > 1,
    hasRepeats: repeats.some((r) => r !== null),
    hasMarkers: parsed.some((line) => line.times !== null),
    hasIndent: parsed.some((line) => line.indent > 0),
  }
}
