import { ScrollView, StyleSheet, Text, View } from "react-native"

import { Press } from "@/components/songs-v2/Press"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { SONGS_LAYOUT as L } from "@/lib/songsV2/layout"

/** One card of the shelf. `countLabel` is `124 songs`. */
export type ShelfCollection = { id: string; label: string; countLabel: string }

/** Card colours in turn: each has a legible text colour (dark on orange and gold, white on greens). */
const CARD_TONES: readonly { bg: string; fg: string; sub: string }[] = [
  { bg: amColors.orange500, fg: "#1E1E1E", sub: "rgba(30,30,30,0.74)" },
  { bg: amColors.sage700, fg: "#FFFFFF", sub: "rgba(255,255,255,0.8)" },
  { bg: amColors.gold300, fg: "#1E1E1E", sub: "rgba(30,30,30,0.74)" },
  { bg: amColors.sage900, fg: "#FFFFFF", sub: "rgba(255,255,255,0.8)" },
  { bg: amColors.orange700, fg: "#FFFFFF", sub: "rgba(255,255,255,0.84)" },
  { bg: amColors.olive100, fg: amColors.sage900, sub: "rgba(32,40,26,0.74)" },
]

/** Pure: the colours of card number `index`. */
export function shelfTone(index: number) {
  return CARD_TONES[((index % CARD_TONES.length) + CARD_TONES.length) % CARD_TONES.length]
}

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
        {collections.map((c, i) => {
          const tone = shelfTone(i)
          return (
            <Press
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`${c.label}, ${c.countLabel}`}
              onPress={() => onOpen(c.id, c.label)}
              pressedScale={0.96}
              style={[styles.card, { backgroundColor: tone.bg }]}
            >
              <Text style={[styles.cardTitle, { color: tone.fg }]} numberOfLines={2}>
                {c.label}
              </Text>
              <Text style={[styles.cardSub, { color: tone.sub }]} numberOfLines={1}>
                {c.countLabel}
              </Text>
            </Press>
          )
        })}
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
  cards: { paddingLeft: 10, paddingRight: 16, gap: 10 },
  card: { width: 150, height: 112, borderRadius: 24, padding: 14, justifyContent: "space-between" },
  cardTitle: { fontFamily: amFonts.display, fontSize: 20, lineHeight: 21, letterSpacing: -0.3, textTransform: "uppercase" },
  cardSub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
})
