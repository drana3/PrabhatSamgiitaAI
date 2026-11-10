import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"

import { HOME_INSET } from "@/components/home/HomeBlocks"
import { Reveal } from "@/components/today/motion"
import { TodayPress } from "@/components/today/TodayPress"
import { amPhotoChip, amScrimPhoto } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { BrowseTile } from "@/lib/searchCards/browse"
import { searchPhoto } from "@/lib/searchCards/photo"
import { shelfCountLabel } from "@/lib/searchMenu/live"
import { songCountLabel } from "@/lib/songsV2/collections"

const GAP = 10
const TILE_HEIGHT = 128
const TILE_RADIUS = 18
const em = (size: number, value: number) => Math.round(size * value * 100) / 100

/** What a tile counts, in words: "6 songs" or "3 recordings". */
export function tileCountLabel(tile: Pick<BrowseTile, "count" | "unit">): string {
  return tile.unit === "songs" ? songCountLabel(tile.count) : shelfCountLabel(tile.count)
}

/**
 * A grid of photo tiles, two to a row: the photo, the name over a scrim, how many songs or recordings behind it. A tile opens
 * its list. The tiles come in one after another (one staggered reveal) and answer on pointer down.
 */
export function PhotoTileGrid({ tiles, onOpen, firstIndex = 0 }: { tiles: readonly BrowseTile[]; onOpen: (tile: BrowseTile) => void; firstIndex?: number }) {
  const t = useT()
  const { width } = useWindowDimensions()
  const tileWidth = Math.floor((Math.min(width, 560) - HOME_INSET * 2 - GAP) / 2)
  return (
    <View style={s.grid}>
      {tiles.map((tile, index) => (
        <Reveal key={tile.key} index={Math.min(firstIndex + index, 8)}>
          <TodayPress
            accessibilityRole="button"
            accessibilityLabel={`${tile.label}, ${tileCountLabel(tile)}`}
            accessibilityHint={t("searchCards.card.open", { title: tile.label })}
            onPress={() => onOpen(tile)}
            pressedScale={0.97}
            style={[s.tile, { width: tileWidth }]}
            testID={`browse-tile-${tile.key}`}
          >
            <Image source={searchPhoto(tile.photo, tile.key).thumb} contentFit="cover" accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} />
            <LinearGradient pointerEvents="none" colors={[amScrimPhoto[0], amScrimPhoto[1]]} locations={[0.1, 1]} style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={s.text}>
              <Text style={s.label} numberOfLines={2}>
                {tile.label}
              </Text>
              <Text style={s.count} numberOfLines={1}>
                {tileCountLabel(tile)}
              </Text>
            </View>
          </TodayPress>
        </Reveal>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, paddingHorizontal: HOME_INSET },
  tile: { height: TILE_HEIGHT, borderRadius: TILE_RADIUS, overflow: "hidden", justifyContent: "flex-end", backgroundColor: amPhotoChip.glass.bg },
  text: { padding: 12, gap: 2 },
  label: { fontFamily: amFonts.display, fontSize: 19, lineHeight: 21, letterSpacing: em(19, -0.01), textTransform: "uppercase", color: amPhotoChip.glass.fg },
  count: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, color: amPhotoChip.glass.fg },
})
