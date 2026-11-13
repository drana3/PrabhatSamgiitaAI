import { amColors } from "@/constants/tokens/amColors"
import type { CollectionKind } from "@/lib/songsV2/collectionsIndex"

/**
 * Gradients of the collection cards (the Songs shelf and the "All collections" grid), drawn like the
 * type cards of the Kiirtan tab: two palette colours on a diagonal, a white glyph, a white title.
 * White text sits on the whole gradient, so both ends must give 4.5:1 against white
 * (orange700 5.1, olive700 5.9, sage700 8.3, sage800 12.1, orange800 7.5, ink500 5.9, sage900 15.2).
 * Each kind has a few pairs so a grid of one kind is not one flat colour; the card picks by its tone index.
 */
export type CollectionGradient = readonly [string, string]

export const COLLECTION_TONES: Record<CollectionKind, readonly CollectionGradient[]> = {
  festival: [
    [amColors.orange700, amColors.orange800],
    [amColors.orange800, amColors.sage900],
  ],
  theme: [
    [amColors.sage700, amColors.sage900],
    [amColors.sage800, amColors.ink900],
  ],
  mood: [
    [amColors.olive700, amColors.sage800],
    [amColors.sage700, amColors.sage900],
    [amColors.orange700, amColors.orange800],
  ],
  occasion: [
    [amColors.orange800, amColors.sage800],
    [amColors.orange700, amColors.sage900],
  ],
  season: [
    [amColors.olive700, amColors.orange800],
    [amColors.olive700, amColors.sage900],
  ],
  language: [
    [amColors.ink500, amColors.ink900],
    [amColors.ink500, amColors.sage900],
  ],
}

/** Pure: the gradient of a collection of this kind; `index` picks among the kind's pairs. */
export function collectionTone(kind: CollectionKind, index = 0): CollectionGradient {
  const tones = COLLECTION_TONES[kind] ?? COLLECTION_TONES.theme
  const i = Math.max(0, Math.floor(index))
  return tones[i % tones.length]
}
