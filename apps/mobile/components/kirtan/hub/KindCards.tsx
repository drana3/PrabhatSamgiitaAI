import { StyleSheet, Text, View } from "react-native"
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

/** The gradient of a category tile: the same colours as the recordings of that kind (lib/kirtan/tone.ts). */
function cardTone(kind: RecordingKind): readonly [string, string] {
  return kind === "kiirtan" ? kiirtanTone("bnk", kind) : kind === "bhajan" ? kiirtanTone("devotional", kind) : kiirtanTone("other", kind)
}

/** Two columns, a tile per kind, heights alternate so the columns do not read as a table. Left: kinds 0, 2, 4; right: 1, 3, 5 (both columns 440 pt tall). */
const TILE_H = [176, 128, 120, 176, 144, 136] as const

/**
 * "Browse all": one tile per kind of recording, each with its colour, a round mark and the real number in small type (Dada, 12 Nov 2026:
 * the vertical list of cards was dropped for a mosaic of two columns of tiles of different heights; the sideways shelf of tall tiles was
 * the other option and lost: it hides four of the six kinds behind a swipe). A tile of a kind with no
 * recording is pale and says "No recordings yet": it still opens the list, which says the same and offers Add. A tap opens the FULL
 * list of the category (app/kiirtan-list.tsx).
 */
export function KindCards({ p, cards, onOpen }: { p: AmProto; cards: readonly KindCard[]; onOpen: (kind: RecordingKind) => void }) {
  useLanguage() // the names and counts come from lib/kirtan: draw again when the language changes
  const tile = (card: KindCard, w: number | undefined, h: number) => {
    const [from, to] = cardTone(card.kind)
    const name = kindLabel(card.kind)
    return (
      <KPress
        key={card.kind}
        accessibilityRole="button"
        accessibilityLabel={kindCardA11y(card, name)}
        onPress={() => onOpen(card.kind)}
        pressedScale={0.96}
        outerStyle={w ? { width: w } : styles.fill}
        style={[styles.tile, { height: h, backgroundColor: card.empty ? p.white : to, borderColor: card.empty ? p.sand300 : "transparent" }]}
      >
        <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: card.empty ? 0.13 : 1 }]} />
        <View style={[styles.disc, { backgroundColor: card.empty ? p.sand200 : "rgba(255,255,255,0.22)" }]}>
          <WaveGlyph size={22} color={card.empty ? p.ink300 : amColors.white} />
        </View>
        <View>
          <Text style={[styles.label, { color: card.empty ? p.ink800 : amColors.white }]} numberOfLines={2}>
            {name}
          </Text>
          <Text style={[styles.count, { color: card.empty ? p.ink500 : "rgba(255,255,255,0.86)" }]} numberOfLines={1}>
            {kindCardLine(card)}
          </Text>
        </View>
      </KPress>
    )
  }

  const left = cards.filter((_, i) => i % 2 === 0)
  const right = cards.filter((_, i) => i % 2 === 1)
  const column = (list: KindCard[], start: number) => (
    <View style={styles.column}>{list.map((card, i) => tile(card, undefined, TILE_H[start + i * 2] ?? 128))}</View>
  )
  return (
    <View style={styles.mosaic}>
      {column(left, 0)}
      {column(right, 1)}
    </View>
  )
}

const styles = StyleSheet.create({
  mosaic: { flexDirection: "row", gap: GAP, paddingHorizontal: HOME_INSET },
  column: { flex: 1, gap: GAP },
  fill: { alignSelf: "stretch" },
  tile: { borderRadius: 24, borderWidth: 1.5, overflow: "hidden", padding: 14, justifyContent: "space-between" },
  disc: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: amFonts.display, fontSize: 17, lineHeight: 18, textTransform: "uppercase", letterSpacing: -0.2 },
  count: { fontFamily: amFonts.medium, fontSize: 12.5, lineHeight: 16, marginTop: 3 },
})
