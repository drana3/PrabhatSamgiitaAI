/**
 * The five wide photo cards of the empty Search page (Dada, 10 Nov 2026, variant B of the board): Mood, Collections,
 * Kiirtan type, Authors, Festivals. Each card is a photo, a name and up to three small pills with real examples
 * ("Dhyána", "Morning", "+4"). Pure: no React, no stores; the screen passes in what the app really holds.
 * Photos are landscapes and instruments from the system's photo shortlist (lib/photos), never a person and never Baba.
 */

export type SearchCardId = "mood" | "collections" | "type" | "authors" | "festivals"

export const SEARCH_CARD_ORDER: readonly SearchCardId[] = ["mood", "collections", "type", "authors", "festivals"]

/** Shortlist numbers (lib/photos/photoData.ts): 16 dawn clouds, 21 foggy redwoods, 29 tabla, 28 harmonium keys, 10 candle flame. */
export const SEARCH_CARD_PHOTO: Readonly<Record<SearchCardId, number>> = { mood: 16, collections: 21, type: 29, authors: 28, festivals: 10 }

/** Where a card opens. Collections and Authors are the pages the app already has; the others are the Search sections. */
export const SEARCH_CARD_TARGET: Readonly<Record<SearchCardId, string>> = {
  mood: "/search-browse?section=mood",
  collections: "/collections-v2",
  type: "/search-browse?section=type",
  authors: "/authors",
  festivals: "/search-browse?section=festivals",
}

/** The most pills a card shows (names and the "+N"). */
export const CARD_PILLS = 3

export type Pill = { label: string; more: boolean }

/**
 * Up to `max` pills: every name when they fit, otherwise the first `max - 1` names and "+N" for the rest.
 * Empty and repeated names are dropped, so the count in "+N" is always the number of names really left out.
 */
export function pillsOf(names: readonly string[], max: number = CARD_PILLS): Pill[] {
  const seen = new Set<string>()
  const clean: string[] = []
  for (const raw of names) {
    const name = raw.trim()
    const key = name.toLocaleLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    clean.push(name)
  }
  if (clean.length <= max) return clean.map((label) => ({ label, more: false }))
  const shown = clean.slice(0, max - 1)
  return [...shown.map((label) => ({ label, more: false })), { label: `+${clean.length - shown.length}`, more: true }]
}

/** What the screen knows, one list of real names per card (empty when the app has none). */
export type SearchCardsData = Readonly<Record<SearchCardId, readonly string[]>>

export type SearchCard = {
  id: SearchCardId
  title: string
  photo: number
  pills: Pill[]
  /** the examples as one line, for the screen reader */
  spoken: string
  target: string
  /** nothing to list yet: the card still opens, and its page says so */
  empty: boolean
}

export function buildSearchCards(data: SearchCardsData, titleOf: (id: SearchCardId) => string): SearchCard[] {
  return SEARCH_CARD_ORDER.map((id) => {
    const pills = pillsOf(data[id])
    return {
      id,
      title: titleOf(id),
      photo: SEARCH_CARD_PHOTO[id],
      pills,
      spoken: pills.map((pill) => pill.label).join(", "),
      target: SEARCH_CARD_TARGET[id],
      empty: pills.length === 0,
    }
  })
}
