/**
 * Karaoke lyrics (spec SCR-12 item 3).
 * The catalog has no line or word timestamps yet (API-11), so timing is
 * interpolated from line length. Everything here is replaceable by real
 * timestamps: feed them to `activeLineIndex` through `LineTiming`.
 */
export type LineTiming = { start: number; end: number }

/**
 * True once the catalog supplies real line timestamps. Until then the timing below is a guess from
 * line length, and a highlight that runs ahead of or behind the singer, or a tap on a line that seeks
 * to the wrong second, would be invented. So the panel shows the lyrics as plain text: no sung-word
 * highlight, no auto-scroll, no seek by line. The web preview with prototype data keeps its demo.
 */
export const LYRICS_HAVE_TIMESTAMPS = false

export function lyricsAreSynced(prototypeData: boolean, haveTimestamps: boolean = LYRICS_HAVE_TIMESTAMPS): boolean {
  return prototypeData || haveTimestamps
}
export type LyricWord = { text: string; gloss?: string }
export type LyricLine = { text: string; words: LyricWord[]; translation?: string }

export function splitLines(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * Some catalog lyrics are stored in capitals. The design shows them as sentence case
 * ("Bandhu he niye calo"), so a line that is entirely capitals is lowered, keeping the
 * first letter. Lines with any lower-case letter, and scripts without case, are untouched.
 */
export function sentenceCaseLine(line: string): string {
  const letters = line.match(/\p{L}/gu)
  if (!letters || letters.length < 3) return line
  if (line !== line.toUpperCase() || line === line.toLowerCase()) return line
  const lower = line.toLowerCase()
  const first = lower.search(/\p{L}/u)
  return first < 0 ? lower : lower.slice(0, first) + lower.charAt(first).toUpperCase() + lower.slice(first + 1)
}

export function splitWords(line: string): string[] {
  return line.split(/\s+/).filter(Boolean)
}

/** One translation line per lyric line, or null when they do not line up. */
export function alignTranslation(lines: string[], translation: string | null | undefined): string[] | null {
  const translated = splitLines(translation)
  return translated.length === lines.length && lines.length > 0 ? translated : null
}

export function buildLyricLines(
  script: string[],
  translations: string[] | null,
  glosses?: Array<Array<string | undefined>> | null,
): LyricLine[] {
  return script.map((text, i) => ({
    text,
    words: splitWords(text).map((word, w) => ({ text: word, gloss: glosses?.[i]?.[w] })),
    translation: translations?.[i],
  }))
}

/** Share of the song before the first line and after the last (instrumental lead-in and tail). */
const LEAD_SHARE = 0.04
const TAIL_SHARE = 0.03

export function lineTimings(lines: string[], duration: number): LineTiming[] {
  if (!lines.length || !(duration > 1)) return []
  const weights = lines.map((l) => Math.max(8, l.length))
  const total = weights.reduce((a, b) => a + b, 0)
  const lead = duration * LEAD_SHARE
  const span = duration * (1 - LEAD_SHARE - TAIL_SHARE)
  let cursor = lead
  return weights.map((w) => {
    const start = cursor
    cursor += (w / total) * span
    return { start, end: cursor }
  })
}

/** Index of the line being sung; -1 before the first line starts. */
export function activeLineIndex(timings: LineTiming[], position: number): number {
  if (!timings.length || position < (timings[0] as LineTiming).start) return -1
  for (let i = timings.length - 1; i >= 0; i -= 1) {
    if (position >= (timings[i] as LineTiming).start) return i
  }
  return -1
}

/** Word being sung, interpolated across the line by word length. -1 if the line is not active. */
export function activeWordIndex(words: string[], timing: LineTiming, position: number): number {
  if (!words.length || position < timing.start) return -1
  const span = Math.max(0.001, timing.end - timing.start)
  const progress = Math.min(0.999, (position - timing.start) / span)
  const weights = words.map((w) => Math.max(2, w.length))
  const total = weights.reduce((a, b) => a + b, 0)
  let acc = 0
  for (let i = 0; i < words.length; i += 1) {
    acc += (weights[i] as number) / total
    if (progress < acc) return i
  }
  return words.length - 1
}

export type LineState = "current" | "done" | "coming"

export function lineState(index: number, active: number, synced = true): LineState {
  if (!synced) return "current"
  if (index === active) return "current"
  return index < active ? "done" : "coming"
}

export type WordState = "sung" | "current" | "coming"

export function wordState(wordIndex: number, activeWord: number, lineIsCurrent: boolean): WordState {
  if (!lineIsCurrent) return "coming"
  if (wordIndex === activeWord) return "current"
  return wordIndex < activeWord ? "sung" : "coming"
}

/** Position to seek to when the reader taps a line. */
export function seekTargetForLine(timings: LineTiming[], index: number): number | null {
  const timing = timings[index]
  return timing ? Math.max(0, timing.start) : null
}

/**
 * Auto-scroll follows the sung line. Touching the panel pauses it until the
 * line changes (spec: "until the next line change").
 */
export type AutoScroll = { paused: boolean; lineAtPause: number }
export type AutoScrollEvent = { type: "touch"; line: number } | { type: "line"; line: number }

export function autoScrollReduce(state: AutoScroll, event: AutoScrollEvent): AutoScroll {
  if (event.type === "touch") return { paused: true, lineAtPause: event.line }
  if (state.paused && event.line !== state.lineAtPause) return { paused: false, lineAtPause: event.line }
  return state
}

/** Scroll offset that puts the current line near the top of the panel. */
export function scrollOffsetForLine(lineTop: number, panelHeight: number, topShare = 0.18): number {
  return Math.max(0, lineTop - panelHeight * topShare)
}
