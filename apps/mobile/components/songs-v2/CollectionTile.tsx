import { CollectionCard } from "@/components/songs-v2/CollectionCard"
import { kindLabel, type CollectionEntry } from "@/lib/songsV2/collectionsIndex"

export const TILE_HEIGHT = 112

/**
 * One tile of the "All collections" grid: the same card as the Songs shelf and the Kiirtan type cards
 * (gradient of its kind, glyph, white title, song count). The gradient is stable while the list is filtered.
 */
export function CollectionTile({
  entry,
  width,
  onOpen,
}: {
  entry: CollectionEntry
  width: number
  onOpen: (entry: CollectionEntry) => void
}) {
  return (
    <CollectionCard
      kind={entry.kind}
      toneIndex={entry.toneIndex}
      title={entry.label}
      caption={entry.countLabel}
      label={`${entry.label}, ${kindLabel(entry.kind)}, ${entry.countLabel}`}
      width={width}
      onPress={() => onOpen(entry)}
    />
  )
}
