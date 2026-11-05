import { StyleSheet, Text } from "react-native"

import { shelfTone } from "@/components/songs-v2/CollectionsShelf"
import { Press } from "@/components/songs-v2/Press"
import { amFonts } from "@/constants/tokens/amTypography"
import { kindLabel, type CollectionEntry } from "@/lib/songsV2/collectionsIndex"

export const TILE_HEIGHT = 112

/**
 * One tile of the "All collections" grid: the same tone tile as the Songs shelf (name over kind and
 * song count), a stable colour per collection. Answers on touch-down with a spring.
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
  const tone = shelfTone(entry.toneIndex)
  // long names ("Dipavali (Colour Festival) Day") drop to 17px on three lines instead of being cut at two
  const long = entry.label.length > 18
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={`${entry.label}, ${kindLabel(entry.kind)}, ${entry.countLabel}`}
      onPress={() => onOpen(entry)}
      pressedScale={0.96}
      outerStyle={{ width }}
      style={[styles.tile, { backgroundColor: tone.bg }]}
    >
      <Text style={[styles.title, long && styles.titleLong, { color: tone.fg }]} numberOfLines={3}>
        {entry.label}
      </Text>
      <Text style={[styles.sub, { color: tone.sub }]} numberOfLines={1}>
        {kindLabel(entry.kind)} · {entry.countLabel}
      </Text>
    </Press>
  )
}

const styles = StyleSheet.create({
  tile: { height: TILE_HEIGHT, borderRadius: 24, padding: 14, justifyContent: "space-between" },
  title: { fontFamily: amFonts.display, fontSize: 20, lineHeight: 21, letterSpacing: -0.3, textTransform: "uppercase" },
  titleLong: { fontSize: 17, lineHeight: 18, letterSpacing: -0.2 },
  sub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
})
