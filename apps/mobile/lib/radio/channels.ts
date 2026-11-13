import { RADIO_CATEGORIES, effectiveSelection, isAllSelected, selectAll, type RadioCategory, type RadioCounts } from "@/lib/radio/categories"

/**
 * The Radio as stations (design variant D): "All" and one channel per category that has something to play. Tapping a channel plays
 * only that category from the next track; "All" plays everything; the link "Mix several categories" opens the multi-select.
 * Pure: the choice itself still lives in stores/radioSelectionStore.ts.
 */
export type ChannelId = "all" | RadioCategory

/** "All" first, then the categories in the app's order. A category with nothing to play has no channel (it would be a dead tap). */
export function channelsFor(counts: RadioCounts): ChannelId[] {
  const live = RADIO_CATEGORIES.filter((c) => (counts[c] ?? 0) > 0)
  return live.length > 1 ? ["all", ...live] : live
}

/** The channel that is on: "All", the one category, or null when a mix of several (not all) is chosen. */
export function activeChannel(selected: readonly RadioCategory[], counts: RadioCounts): ChannelId | null {
  const current = effectiveSelection(selected, counts)
  if (isAllSelected(selected, counts)) return "all"
  return current.length === 1 ? (current[0] as RadioCategory) : null
}

/** What a tap on a channel chooses. */
export function selectionForChannel(channel: ChannelId, counts: RadioCounts): RadioCategory[] {
  return channel === "all" ? selectAll(counts) : [channel]
}
