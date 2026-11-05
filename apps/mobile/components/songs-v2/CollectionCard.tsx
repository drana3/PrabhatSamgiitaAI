import { LinearGradient } from "expo-linear-gradient"
import { StyleSheet, Text, View, type DimensionValue } from "react-native"
import Svg, { Path } from "react-native-svg"

import { Press } from "@/components/songs-v2/Press"
import { amFonts } from "@/constants/tokens/amTypography"
import type { CollectionKind } from "@/lib/songsV2/collectionsIndex"
import { collectionTone } from "@/lib/songsV2/collectionTone"

export const COLLECTION_CARD = { w: 152, h: 112 }

/** A stack of three cards: "a collection of songs". White, stroke only, like the wave on the Kiirtan type cards. */
function StackGlyph({ size = 28, color = "rgba(255,255,255,0.9)" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 8.5h14M7.5 4.5h9M4 12.5h16v7H4z" />
    </Svg>
  )
}

/**
 * One collection card: the same format as the type cards of the Kiirtan tab (diagonal two-colour
 * gradient from the palette, radius 24, glyph on top, white uppercase title and the song count at the
 * bottom). Used by the Songs shelf and by the "All collections" grid. Answers on touch-down.
 */
export function CollectionCard({
  kind,
  toneIndex,
  title,
  caption,
  label,
  width = COLLECTION_CARD.w,
  onPress,
}: {
  kind: CollectionKind
  toneIndex: number
  title: string
  /** `124 songs` */
  caption: string
  /** spoken name of the card */
  label: string
  width?: DimensionValue
  onPress: () => void
}) {
  const [from, to] = collectionTone(kind, toneIndex)
  // long names ("Dipavali (Colour Festival) Day") drop a size instead of being cut
  const long = title.length > 16
  // very long names ("Songs based on the fairy tale ...") take three lines and a smaller glyph
  const huge = title.length > 26
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} onPress={onPress} pressedScale={0.96} outerStyle={{ width }} style={styles.card}>
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.glyph}>
        <StackGlyph size={huge ? 20 : 28} />
      </View>
      <View>
        <Text style={[styles.title, long && styles.titleLong, huge && styles.titleHuge]} numberOfLines={huge ? 3 : 2}>
          {title}
        </Text>
        <Text style={styles.count} numberOfLines={1}>
          {caption}
        </Text>
      </View>
    </Press>
  )
}

const styles = StyleSheet.create({
  card: { height: COLLECTION_CARD.h, borderRadius: 24, overflow: "hidden", padding: 14, justifyContent: "space-between" },
  glyph: { alignItems: "flex-start" },
  title: { fontFamily: amFonts.display, fontSize: 16, lineHeight: 17, textTransform: "uppercase", letterSpacing: -0.2, color: "#FFFFFF" },
  titleLong: { fontSize: 14, lineHeight: 15 },
  titleHuge: { fontSize: 13, lineHeight: 14, letterSpacing: -0.1 },
  count: { fontFamily: amFonts.medium, fontSize: 12.5, lineHeight: 16, color: "rgba(255,255,255,0.94)", marginTop: 2 },
})
