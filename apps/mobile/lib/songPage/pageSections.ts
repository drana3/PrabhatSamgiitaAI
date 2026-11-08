import type { AlignResult } from "./alignLines"

/**
 * What the one song page shows, decided from facts about the song (no React). The screen only draws this, so
 * "which sections exist for which song", "what the tab strip and the menu list" and "where a jump lands" are
 * tested here and nowhere else.
 *
 * One scrolling page, in this order: the text block (Lyrics, Translation, Word by word as three pages of one block),
 * Recordings, Chords, Video, Story, then About this song. The tab strip lists the first five that exist; the menu
 * lists them and About ("Song information"). The block's own pages are not sections: they are paged sideways inside it.
 */

export type TabSection = "lyrics" | "recordings" | "chords" | "video" | "story"
export type PageSection = TabSection | "about"

export const SECTION_ORDER: readonly PageSection[] = ["lyrics", "recordings", "chords", "video", "story", "about"]

export type SongFacts = {
  hasLyrics: boolean
  /** a real meaning exists in the language on screen (the official English text, or a stored or fetched translation) */
  hasMeaning: boolean
  /** real word meanings (never the sample ones outside the preview's demo songs) */
  hasWords: boolean
  /** a real chord chart (never the sample one outside the preview's demo songs) */
  hasChords: boolean
  /** at least one recording (audio) of the song */
  hasRecordings: boolean
  /** verified videos of this song */
  hasVideo: boolean
  /** a story about this song exists */
  hasStory: boolean
  hasNotationPdf: boolean
  /** how the translation lines up with the lyrics */
  align: AlignResult
}

/**
 * The sections of the tab strip. Lyrics and Chords always have a place (each says honestly when it has nothing yet);
 * Recordings, Video and Story are there only when the song has them. There is no Commentary tab: the commentary
 * belongs to the translation, on the Translation page of the text block.
 */
export function visibleTabs(facts: SongFacts): TabSection[] {
  const tabs: TabSection[] = ["lyrics"]
  if (facts.hasRecordings) tabs.push("recordings")
  tabs.push("chords")
  if (facts.hasVideo) tabs.push("video")
  if (facts.hasStory) tabs.push("story")
  return tabs
}

/** The sections the page has, in page order, About last. This is what the top Menu lists. */
export function menuSections(facts: SongFacts): PageSection[] {
  return [...visibleTabs(facts), "about"]
}

/** Height reserved for the pinned tab strip. */
export const STRIP_HEIGHT = 49

/** The top of each section in the scroll content, from the heights above it (heights not measured yet count as 0). */
export function sectionTops(order: readonly PageSection[], heights: Readonly<Record<string, number | undefined>>, start: number): Record<string, number> {
  const tops: Record<string, number> = {}
  let y = start
  for (const id of order) {
    tops[id] = y
    y += heights[id] ?? 0
  }
  return tops
}

/** Where to scroll so the section's top sits just under the bar and the pinned strip. */
export function jumpOffset(top: number, barHeight: number, stripHeight = STRIP_HEIGHT): number {
  return Math.max(0, Math.round(top - barHeight - stripHeight + 1))
}

/**
 * The section the reader is in at scroll offset `y`: the last one whose top is within `lead` of the line under
 * the strip. Stops at the first section that has not been measured yet. Null when there are no sections.
 */
export function activeSectionAt(
  order: readonly TabSection[],
  heights: Readonly<Record<string, number | undefined>>,
  start: number,
  y: number,
  barHeight: number,
  lead = 48,
  stripHeight = STRIP_HEIGHT,
): TabSection | null {
  if (!order.length) return null
  const tops = sectionTops(order, heights, start)
  let current: TabSection = order[0] as TabSection
  for (const id of order) {
    if (heights[id] === undefined) break
    if ((tops[id] as number) - barHeight - stripHeight - lead <= y) current = id
  }
  return current
}
