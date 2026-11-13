import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { HOME_INSET } from "@/components/home/HomeBlocks"
import { WaveGlyph } from "@/components/kirtan/KiirtanCover"
import { KPress } from "@/components/kirtan/KPress"
import { PhotoSurface } from "@/components/photos/PhotoSurface"
import { amColors, amDarkSurface } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { HUB_KINDS, kindCardA11y, kindCardLine, type KindCard } from "@/lib/kirtan/hub"
import { kindLabel } from "@/lib/kirtan/kind"
import { kiirtanTone } from "@/lib/kirtan/tone"
import type { RecordingKind } from "@/lib/kirtan/types"
import { useLanguage } from "@/lib/i18n"
import { STOCK_PHOTOS } from "@/lib/photos/catalog"
import { pickKindPhotos } from "@/lib/photos/defaultPhoto"

const GAP = 12

/** The gradient of a category tile: the same colours as the recordings of that kind (lib/kirtan/tone.ts). */
function cardTone(kind: RecordingKind): readonly [string, string] {
  return kind === "kiirtan" ? kiirtanTone("bnk", kind) : kind === "bhajan" ? kiirtanTone("devotional", kind) : kiirtanTone("other", kind)
}

/** Two columns, a tile per kind, heights alternate so the columns do not read as a table. Left: kinds 0, 2, 4; right: 1, 3, 5 (both columns 440 pt tall). */
const TILE_H = [176, 128, 120, 176, 144, 136] as const

/**
 * "Browse all": one tile per kind of recording, a mosaic of two columns of tiles of different heights (Dada, 12 Nov 2026). Every tile is
 * the SAME kind of surface (Dada, 13 Nov 2026: the last four were pale and melted into the page): a photo of the app's own library that the system
 * picks for the kind (a different one for each kind, the same every time, lib/photos/defaultPhoto.ts), the colour of the kind washed over it
 * and a dark scrim under the text, so the white name and count read at 4.5:1 or better on any picture. A kind with no recording looks the
 * same and says "No recordings yet" in the count line: it still opens the list, which says the same and offers Add. In Dark the tile also
 * has a light outline (3.3:1 on the page), because its dark lower edge would meet the dark page. A tap opens the FULL list of the category
 * (app/kiirtan-list.tsx).
 */
export function KindCards({ p, cards, onOpen }: { p: AmProto; cards: readonly KindCard[]; onOpen: (kind: RecordingKind) => void }) {
  useLanguage() // the names and counts come from lib/kirtan: draw again when the language changes
  const photos = useMemo(() => pickKindPhotos(STOCK_PHOTOS, HUB_KINDS), [])
  const tile = (card: KindCard, w: number | undefined, h: number) => {
    const [from, to] = cardTone(card.kind)
    const name = kindLabel(card.kind)
    const photo = photos.get(card.kind)
    return (
      <KPress
        key={card.kind}
        accessibilityRole="button"
        accessibilityLabel={kindCardA11y(card, name)}
        onPress={() => onOpen(card.kind)}
        pressedScale={0.96}
        outerStyle={w ? { width: w } : styles.fill}
        style={[styles.tile, { height: h, backgroundColor: amColors.ink900, borderColor: p.dark ? amDarkSurface.lineStrong : "transparent" }]}
      >
        {photo ? <PhotoSurface photo={photo} wash={[from, to]} washOpacity={0.45} mid={0.82} scrim={0.94} /> : null}
        <View style={styles.disc}>
          <WaveGlyph size={22} color={amColors.white} />
        </View>
        <View>
          <Text style={styles.label} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.count} numberOfLines={1}>
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
  disc: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(10,14,8,0.42)" },
  label: { fontFamily: amFonts.display, fontSize: 17, lineHeight: 18, textTransform: "uppercase", letterSpacing: -0.2, color: amColors.white },
  count: { fontFamily: amFonts.medium, fontSize: 12.5, lineHeight: 16, marginTop: 3, color: "rgba(255,255,255,0.92)" },
})
