/**
 * The "reading strip" of the Lyrics tab (variant G of the board): the lyrics stand clean, stanza by stanza, and a
 * small strip at the bottom shows the translation of the stanza that is in the middle of the screen. Pure rules,
 * no React: when a translation may honestly be split by stanza, which stanza is "current" while scrolling, how a
 * tap pins the strip to a stanza and how it lets go, when the strip is on screen, and where a drag of the strip
 * settles. Nothing here writes text: it only decides which piece of the stored translation is shown.
 */

/** What the split needs to know of one lyric block (a stanza, from lyricStructure.ts). */
export type SplitBlock = {
  lines: ReadonlyArray<{ index: number; repeatOf: number | null }>
  /** "refrain": the text labels it so, or every line of it is a repeat of lines sung before */
  label: "refrain" | null
}

export type StanzaTranslation = {
  /** the translation of this stanza, exactly as stored (soft line breaks joined with a space) */
  text: string
  /** the stanza is a refrain (marked "chorus"); its translation is shown once, the one of the first time */
  chorus: boolean
  /** the translation shown is the one of an earlier stanza (the refrain has none of its own) */
  ofFirstTime: boolean
}

export type TranslationSplit =
  /** no translation text */
  | { kind: "none" }
  /** the translation cannot be tied to stanzas honestly: it is shown whole, as one piece */
  | { kind: "whole"; paragraphs: string[] }
  /** one entry per lyric block, in order */
  | { kind: "stanzas"; items: StanzaTranslation[] }

/** The number of each stanza as the reader sees it: refrains are not numbered (null), the others count 1, 2, 3. */
export function stanzaNumbers(blocks: ReadonlyArray<Pick<SplitBlock, "label">>): Array<number | null> {
  let n = 0
  return blocks.map((block) => (block.label === "refrain" ? null : (n += 1)))
}

/** A soft line break inside a paragraph is a space; blank lines separate paragraphs. */
export function translationParagraphs(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/\r?\n[ \t]*\r?\n/)
    .map((p) => p.replace(/\s*\r?\n\s*/g, " ").trim())
    .filter(Boolean)
}

/**
 * Split a translation by stanza, only when that is honest:
 *  1. the catalogue pairs it line by line with the lyrics (`pairs`, from alignLines): each stanza is its own lines;
 *  2. the translation has blank-line paragraphs and as many as the lyrics have stanzas: one for one;
 *  3. it has as many paragraphs as there are stanzas that are not refrains, and there are refrains: the translator
 *     gave a repeated chorus once, so a refrain shows the translation of the stanza where it was first sung.
 * Anything else (the real catalogue today: short wrapped lines, no blank lines) is shown whole. A song with one
 * stanza has nothing to follow, so it is whole too. Nothing is cut, merged or padded to make it fit.
 */
export function splitTranslation(input: {
  blocks: readonly SplitBlock[]
  raw: string | null | undefined
  pairs: ReadonlyArray<{ readonly meaning: string }> | null
}): TranslationSplit {
  const { blocks, raw, pairs } = input
  const paragraphs = translationParagraphs(raw)
  if (!paragraphs.length) return { kind: "none" }
  const whole: TranslationSplit = { kind: "whole", paragraphs }
  if (blocks.length < 2) return whole

  if (pairs) {
    const items = blocks.map((block): StanzaTranslation | null => {
      const parts = block.lines.map((line) => pairs[line.index]?.meaning?.trim() ?? "")
      if (parts.some((p) => !p)) return null
      return { text: parts.join(" "), chorus: block.label === "refrain", ofFirstTime: false }
    })
    if (items.every((item): item is StanzaTranslation => item !== null)) return { kind: "stanzas", items }
    return whole
  }

  if (paragraphs.length === blocks.length) {
    return {
      kind: "stanzas",
      items: blocks.map((block, i) => ({ text: paragraphs[i] as string, chorus: block.label === "refrain", ofFirstTime: false })),
    }
  }

  const refrains = blocks.filter((b) => b.label === "refrain").length
  if (refrains > 0 && paragraphs.length === blocks.length - refrains) {
    const blockOfLine = new Map<number, number>()
    blocks.forEach((block, b) => block.lines.forEach((line) => blockOfLine.set(line.index, b)))
    const own: Array<number | null> = []
    let next = 0
    blocks.forEach((block) => own.push(block.label === "refrain" ? null : next++))
    const items: StanzaTranslation[] = []
    for (let b = 0; b < blocks.length; b += 1) {
      const block = blocks[b] as SplitBlock
      const mine = own[b]
      if (mine !== null && mine !== undefined) {
        items.push({ text: paragraphs[mine] as string, chorus: false, ofFirstTime: false })
        continue
      }
      // a refrain: the stanza where its first line was first sung
      const first = block.lines[0]
      const source = first && first.repeatOf !== null ? blockOfLine.get(first.repeatOf) : undefined
      const sourceOwn = source !== undefined ? own[source] : null
      if (sourceOwn === null || sourceOwn === undefined) return whole
      items.push({ text: paragraphs[sourceOwn] as string, chorus: true, ofFirstTime: true })
    }
    return { kind: "stanzas", items }
  }
  return whole
}

/** Where on the visible part of the page the reader's eye is: a bit above the middle (board: 42%). */
export const READING_LINE = 0.42

/** The y (window coordinates) of the reading line between the pinned bars on top and the strip at the bottom. */
export function readingLine(visibleTop: number, visibleBottom: number): number {
  return visibleTop + Math.max(0, visibleBottom - visibleTop) * READING_LINE
}

export type Span = { top: number; height: number }

/**
 * The stanza that holds `line`; between stanzas (the gap) or outside the lyrics, the nearest one. -1 when there are
 * no stanzas. Spans must be in the same coordinates as `line`.
 */
export function stanzaAtLine(spans: readonly Span[], line: number): number {
  let best = -1
  let bestDistance = Infinity
  spans.forEach((span, i) => {
    const bottom = span.top + span.height
    const distance = line >= span.top && line <= bottom ? 0 : Math.min(Math.abs(line - span.top), Math.abs(line - bottom))
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  })
  return best
}

/**
 * Whether the lyrics are on screen enough to show the strip: some of them lie inside the visible part of the page,
 * not just a sliver at an edge. All values in the same coordinates (window y).
 */
export function lyricsInView(input: { top: number; bottom: number; visibleTop: number; visibleBottom: number; margin?: number }): boolean {
  const margin = input.margin ?? 96
  if (input.bottom <= input.top) return false
  return input.top < input.visibleBottom - margin && input.bottom > input.visibleTop + margin
}

/** Whether the strip is drawn at all. */
export function stripVisible(input: {
  tab: "lyrics" | "commentary" | "words"
  split: TranslationSplit["kind"]
  translationOn: boolean
  inView: boolean
  sheetOpen: boolean
}): boolean {
  return input.tab === "lyrics" && input.split !== "none" && input.translationOn && input.inView && !input.sheetOpen
}

// ---- Scroll mode and Tap override ----

/** A pin lets go after the page has moved this far from where it was pinned. */
export const PIN_RELEASE_PX = 160
/** ...and not before this long after the tap (the tap itself, or a tap-and-nudge, must not undo it). */
export const PIN_GRACE_MS = 600

export type ReadingMode =
  /** the strip follows the stanza in the middle of the screen */
  | { mode: "scroll" }
  /** the strip is pinned to a stanza the reader tapped */
  | { mode: "tap"; pinned: number; pinY: number; at: number }

export const SCROLL_MODE: ReadingMode = { mode: "scroll" }

export type ReadingEvent =
  | { type: "tap"; index: number; y: number; now: number }
  | { type: "scroll"; y: number; now: number }

/**
 * Tap a stanza: the strip pins to it. Tap the pinned stanza again: back to Scroll mode. Scroll while pinned:
 * once the page has moved PIN_RELEASE_PX after a short pause (PIN_GRACE_MS) the strip goes back to following.
 */
export function reduceReading(state: ReadingMode, event: ReadingEvent): ReadingMode {
  if (event.type === "tap") {
    if (state.mode === "tap" && state.pinned === event.index) return SCROLL_MODE
    return { mode: "tap", pinned: event.index, pinY: event.y, at: event.now }
  }
  if (state.mode === "tap" && event.now - state.at >= PIN_GRACE_MS && Math.abs(event.y - state.pinY) >= PIN_RELEASE_PX) return SCROLL_MODE
  return state
}

/** The stanza whose translation the strip shows: the pinned one, else the one in the middle of the screen. */
export function shownStanza(state: ReadingMode, current: number, count: number): number {
  if (count <= 0) return -1
  const wanted = state.mode === "tap" ? state.pinned : current
  return Math.min(Math.max(wanted, 0), count - 1)
}

// ---- the strip's own drag (compact <-> expanded), heights in dp ----

/** Where the strip settles after a drag: the projection of its height along the finger's velocity, not the distance to an edge. */
export function stripSettle(height: number, velocityY: number, compact: number, expanded: number): { expanded: boolean; fling: boolean } {
  "worklet"
  // dragging up (negative velocityY) makes it taller; 0.998 is the deceleration rate of a scroll view
  const projected = height - (velocityY / 1000) * (0.998 / (1 - 0.998))
  return { expanded: projected > (compact + expanded) / 2, fling: Math.abs(velocityY) > 600 }
}
