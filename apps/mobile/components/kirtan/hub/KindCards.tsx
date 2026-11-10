import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { LinearGradient } from "expo-linear-gradient"

import { HOME_INSET } from "@/components/home/HomeBlocks"
import { WaveGlyph } from "@/components/kirtan/KiirtanCover"
import { KPress } from "@/components/kirtan/KPress"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { kindCardA11y, kindCardLine, type KindCard } from "@/lib/kirtan/hub"
import { kindLabel } from "@/lib/kirtan/kind"
import { kiirtanTone } from "@/lib/kirtan/tone"
import type { RecordingKind } from "@/lib/kirtan/types"
import { useLanguage } from "@/lib/i18n"

const GAP = 12
const CARD_H = 112

/** The gradient of a category card: the same colours as the recordings of that kind (lib/kirtan/tone.ts). */
function cardTone(kind: RecordingKind): readonly [string, string] {
  return kind === "kiirtan" ? kiirtanTone("bnk", kind) : kind === "bhajan" ? kiirtanTone("devotional", kind) : kiirtanTone("other", kind)
}

/**
 * "Browse by category": one card per kind of recording with its real number. A card of a kind with no recording is pale (a
 * quiet card with a faint tint, ink text) and says "No recordings yet": it still opens the list, which says the same and offers Add.
 * A tap opens the FULL list of the category (app/kiirtan-list.tsx).
 */
export function KindCards({ p, cards, onOpen }: { p: AmProto; cards: readonly KindCard[]; onOpen: (kind: RecordingKind) => void }) {
  useLanguage() // the names and counts come from lib/kirtan: draw again when the language changes
  const { width } = useWindowDimensions()
  const cardW = Math.floor((width - 2 * HOME_INSET - GAP) / 2)
  return (
    <View style={styles.grid}>
      {cards.map((card) => {
        const [from, to] = cardTone(card.kind)
        const name = kindLabel(card.kind)
        return (
          <KPress
            key={card.kind}
            accessibilityRole="button"
            accessibilityLabel={kindCardA11y(card, name)}
            onPress={() => onOpen(card.kind)}
            pressedScale={0.96}
            style={[styles.card, { width: cardW, backgroundColor: card.empty ? p.white : to, borderColor: card.empty ? p.sand300 : "transparent" }]}
          >
            <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: card.empty ? 0.13 : 1 }]} />
            <View style={styles.glyph}>
              <WaveGlyph size={28} color={card.empty ? p.ink300 : amColors.white} />
            </View>
            <View>
              <Text style={[styles.label, { color: card.empty ? p.ink800 : amColors.white }]} numberOfLines={2}>
                {name}
              </Text>
              <Text style={[styles.count, { color: card.empty ? p.ink500 : "rgba(255,255,255,0.88)" }]} numberOfLines={1}>
                {kindCardLine(card)}
              </Text>
            </View>
          </KPress>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, paddingHorizontal: HOME_INSET },
  card: { height: CARD_H, borderRadius: 24, borderWidth: 1.5, overflow: "hidden", padding: 14, justifyContent: "space-between" },
  glyph: { alignItems: "flex-start" },
  label: { fontFamily: amFonts.display, fontSize: 16, lineHeight: 17, textTransform: "uppercase", letterSpacing: -0.2 },
  count: { fontFamily: amFonts.medium, fontSize: 12.5, lineHeight: 16, marginTop: 2 },
})
