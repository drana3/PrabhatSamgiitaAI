export type SectionId = "lyrics" | "words" | "meaning" | "explain" | "chords" | "watch"

export const SECTION_LABEL: Record<SectionId, string> = {
  lyrics: "Lyrics",
  words: "Words",
  meaning: "Meaning",
  explain: "Explain",
  chords: "Chords",
  watch: "Watch",
}

/** Distance between the pinned strip and the section a tab scrolls to. */
export const SECTION_GAP = 40

export function visibleSections(has: {
  lyrics: boolean
  words: boolean
  meaning: boolean
  explain: boolean
  chords: boolean
  watch: boolean
}): SectionId[] {
  const order: SectionId[] = ["lyrics", "words", "meaning", "explain", "chords", "watch"]
  return order.filter((id) => has[id])
}

/** Scroll offset that puts a section 40px below the pinned strip. */
export function scrollTargetFor(sectionTop: number, stripHeight: number): number {
  return Math.max(0, sectionTop - stripHeight - SECTION_GAP)
}

export function isAtBottom(scrollY: number, viewportHeight: number, contentHeight: number, slack = 4): boolean {
  return contentHeight > viewportHeight && scrollY + viewportHeight >= contentHeight - slack
}

/**
 * The tab that follows the reader. A section is active once its top has passed
 * the line 40px under the strip; at the very bottom the last section is active.
 */
export function activeSection(input: {
  order: SectionId[]
  tops: Partial<Record<SectionId, number>>
  scrollY: number
  stripHeight: number
  atBottom: boolean
}): SectionId | null {
  const { order, tops, scrollY, stripHeight, atBottom } = input
  if (!order.length) return null
  if (atBottom) return order[order.length - 1]
  const probe = scrollY + stripHeight + SECTION_GAP + 1
  let active = order[0]
  for (const id of order) {
    const top = tops[id]
    if (top != null && top <= probe) active = id
  }
  return active
}

/** Underline drawn as a 1px-wide bar scaled in x: returns translateX and scaleX that cover [x, x + width]. */
export function underlineTransform(x: number, width: number): { translateX: number; scaleX: number } {
  return { translateX: x + width / 2 - 0.5, scaleX: Math.max(width, 0.0001) }
}

/** Scroll position of a tab so the active one stays in view in the sideways strip. */
export function tabScrollTarget(tabX: number, tabWidth: number, viewportWidth: number, current: number): number {
  const margin = 16
  if (tabX - margin < current) return Math.max(0, tabX - margin)
  if (tabX + tabWidth + margin > current + viewportWidth) return tabX + tabWidth + margin - viewportWidth
  return current
}
