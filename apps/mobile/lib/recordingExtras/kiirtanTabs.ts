/**
 * The tabs of a Kiirtan's page (docs/kiirtan-page.md). The order is Dada's decision of 9 November 2026: Chords first,
 * then Video, Notes (piano notes) and Story (the comments: stories and memories). The page opens on Chords.
 */
export type KiirtanTab = "chords" | "video" | "notes" | "story"

export const KIIRTAN_TABS: readonly KiirtanTab[] = ["chords", "video", "notes", "story"]

export const DEFAULT_KIIRTAN_TAB: KiirtanTab = "chords"

export function isKiirtanTab(value: unknown): value is KiirtanTab {
  return typeof value === "string" && (KIIRTAN_TABS as readonly string[]).includes(value)
}

/**
 * The tab a page opens on. A link may name one (`?tab=video`); somebody who comes from "someone replied to your comment"
 * (`focus`) lands on Story, where the comments are; anything else is Chords.
 */
export function openingTab(input: { tab?: unknown; focus?: boolean }): KiirtanTab {
  if (input.focus) return "story"
  return isKiirtanTab(input.tab) ? input.tab : DEFAULT_KIIRTAN_TAB
}
