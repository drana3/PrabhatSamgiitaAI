/**
 * Which song page the app shows. Three proposals (docs/song-page-redesign.md) and the existing page:
 *   a = "Pairs" (one reading column, translation under each line)
 *   b = "Pages" (pill tabs, each tab a short page)       <- the recommended one and the default
 *   c = "Stanzas + sheets" (stanza cards, the rest in sheets)
 *   current = the page as it was before the redesign
 * Pure: no React, no storage. The switcher is a preview tool; outside MOCKUP_DATA the answer is always B.
 */
export const SONG_PAGE_VARIANTS = ["a", "b", "c", "current"] as const
export type SongPageVariant = (typeof SONG_PAGE_VARIANTS)[number]

export const DEFAULT_VARIANT: SongPageVariant = "b"

/** The query `?variant=a|b|c|current` (case and spaces ignored; the first of a repeated query), or null. */
export function parseVariant(raw: unknown): SongPageVariant | null {
  const first = Array.isArray(raw) ? raw[0] : raw
  if (typeof first !== "string") return null
  const value = first.trim().toLowerCase()
  return (SONG_PAGE_VARIANTS as readonly string[]).includes(value) ? (value as SongPageVariant) : null
}

/**
 * The variant to draw. In the preview (MOCKUP_DATA): the query wins, then the saved choice, then B.
 * In a real build: B, whatever is saved or typed in a link, because nobody can see the switcher there.
 */
export function resolveVariant(input: { mockup: boolean; query?: unknown; stored?: unknown }): SongPageVariant {
  if (!input.mockup) return DEFAULT_VARIANT
  return parseVariant(input.query) ?? parseVariant(input.stored) ?? DEFAULT_VARIANT
}

/** The switcher's segments, in order, with the text on each. */
export const VARIANT_LABEL: Record<SongPageVariant, string> = { a: "A", b: "B", c: "C", current: "Current" }
