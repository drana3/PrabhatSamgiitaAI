import { ScrollView, StyleSheet, Text, View } from "react-native"

import { CollectionCard } from "@/components/songs-v2/CollectionCard"
import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { SONGS_LAYOUT as L } from "@/lib/songsV2/layout"

/** One card of the shelf. `countLabel` is `124 songs`. */
export type ShelfCollection = { id: string; label: string; countLabel: string }

/**
 * Collections as a shelf of coloured cards (it was the Collections segment). The block is exactly
 * SONGS_LAYOUT.shelf high, because the list under it is positioned by that number.
 */
export function CollectionsShelf({
  theme,
  collections,
  onOpen,
  onOpenAll,
}: {
  theme: SongsTheme
  collections: readonly ShelfCollection[]
  onOpen: (id: string, label: string) => void
  onOpenAll: () => void
}) {
  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: theme.textHeading }]} accessibilityRole="header">
          Collections
        </Text>
        <Press accessibilityRole="link" accessibilityLabel="All collections" onPress={onOpenAll} pressedScale={0.95} style={styles.all}>
          <Text style={[styles.allText, { color: theme.accent }]}>All</Text>
        </Press>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        {collections.map((c, i) => (
          <CollectionCard
            key={c.id}
            kind="mood"
            toneIndex={i}
            title={c.label}
            caption={c.countLabel}
            label={`${c.label}, ${c.countLabel}`}
            onPress={() => onOpen(c.id, c.label)}
          />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  block: { height: L.shelf, paddingTop: 24, paddingBottom: 20, gap: 14 },
  head: { height: 30, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingLeft: 10, paddingRight: 16 },
  title: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 30, letterSpacing: -0.6, textTransform: "uppercase" },
  all: { height: 30, justifyContent: "center", paddingHorizontal: 6 },
  allText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  cards: { paddingLeft: 10, paddingRight: 16, gap: 12 },
})
