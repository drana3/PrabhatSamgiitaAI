import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { ChevronRight, Play } from "lucide-react-native"

import { Chip, PillButton } from "@/components/songs-v2/Pill"
import { Press } from "@/components/songs-v2/Press"
import { Reveal } from "@/components/today/motion"
import { TwoToneHeading } from "@/components/today/TodayBlocks"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius, amSpace } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { allCollections } from "@/data/collections"
import type { StorySummary } from "@/data/stories"
import { songNumbersForCategory } from "@/lib/categorySongs"
import {
  festivalChips,
  pickFestival,
  SPECIAL_TILES,
  storyEyebrow,
  tilesWithCounts,
  type TileTone,
} from "@/lib/songsV2/collections"
import { storyLoader } from "@/lib/songsV2/storyApi"

type Props = {
  theme: AmTheme
  stories: StorySummary[]
  storiesLoading: boolean
  onPlayAll: (numbers: number[]) => void
  onOpenFestival: (label: string) => void
  onOpenStory: (story: StorySummary) => void
  onOpenTile: (browseId: string, label: string) => void
}

const TILE_COLORS: Record<TileTone, { bg: string; fg: string; sub: string; border: string }> = {
  forest: { bg: amColors.sage900, fg: amColors.white, sub: amColors.gold300, border: amColors.sage900 },
  olive: { bg: amColors.sage200, fg: amColors.sage900, sub: amColors.olive700, border: amColors.sage200 },
  white: { bg: amColors.white, fg: amColors.ink800, sub: amColors.orange700, border: amColors.sand300 },
  peach: { bg: amColors.orange100, fg: amColors.ink800, sub: amColors.orange700, border: amColors.orange100 },
}

/**
 * Collections segment (spec SCR-17): festival songs, stories behind the
 * songs, special collections. A festival chip changes the card in place.
 */
export function CollectionsSegment({
  theme,
  stories,
  storiesLoading,
  onPlayAll,
  onOpenFestival,
  onOpenStory,
  onOpenTile,
}: Props) {
  const chips = useMemo(() => festivalChips(allCollections), [])
  const [festivalId, setFestivalId] = useState<string | null>(null)
  const festival = pickFestival(chips, festivalId)
  const tiles = useMemo(() => tilesWithCounts(SPECIAL_TILES, (id) => songNumbersForCategory(id).length), [])
  const [, bump] = useState(0)

  // Read times arrive as stories load; show them as they come.
  useEffect(() => {
    if (!stories.length) return
    let active = true
    void storyLoader.prefetch(stories.map((s) => s.slug)).then(() => {
      if (active) bump((n) => n + 1)
    })
    return () => {
      active = false
    }
  }, [stories])

  let block = 0
  return (
    <View style={styles.root}>
      {festival ? (
        <Reveal index={block++} style={styles.section}>
          <TwoToneHeading theme={theme} first="Festival" second="songs" />
          <View style={styles.chipRow}>
            {chips.map((chip) => (
              <Chip key={chip.id} theme={theme} label={chip.label} active={chip.id === festival.id} onPress={() => setFestivalId(chip.id)} />
            ))}
          </View>
          <View style={[styles.festivalCard, { backgroundColor: theme.forest }]}>
            <Text style={[amType.label, { color: amColors.gold300 }]}>{festival.eyebrow}</Text>
            <Text style={[styles.festivalName, { color: amColors.white }]}>{festival.label}</Text>
            <View style={styles.festivalActions}>
              <PillButton
                theme={theme}
                label="Play all"
                icon={<Play size={16} color={theme.onBrand} fill={theme.onBrand} />}
                onPress={() => onPlayAll(festival.songNumbers)}
              />
              <PillButton theme={theme} tone="sand" label="See songs" onPress={() => onOpenFestival(festival.label)} />
            </View>
          </View>
        </Reveal>
      ) : null}

      <Reveal index={block++} style={styles.section}>
        <TwoToneHeading theme={theme} first="Stories behind" second="the songs" />
        <View style={styles.stack}>
          {stories.map((story) => (
            <Press
              key={story.slug}
              accessibilityRole="button"
              accessibilityLabel={`${storyEyebrow(storyLoader.peekMinutes(story.slug))}, ${story.title}`}
              onPress={() => onOpenStory(story)}
              pressedScale={0.985}
              style={[styles.storyRow, { backgroundColor: theme.card, borderColor: theme.line }]}
            >
              <View style={styles.flex}>
                <Text style={[amType.label, { color: theme.eyebrow }]}>{storyEyebrow(storyLoader.peekMinutes(story.slug))}</Text>
                <Text style={[styles.rowTitle, { color: theme.textHeading }]} numberOfLines={3}>
                  {story.title}
                </Text>
              </View>
              <ChevronRight size={20} color={theme.textMuted} />
            </Press>
          ))}
          {!stories.length ? (
            <Text style={[amType.body, { color: theme.textMuted }]}>
              {storiesLoading ? "Loading stories…" : "No stories to show right now."}
            </Text>
          ) : null}
        </View>
      </Reveal>

      <Reveal index={block++} style={styles.section}>
        <TwoToneHeading theme={theme} first="Special" second="collections" />
        <View style={styles.grid}>
          {tiles.map((tile) => {
            const c = TILE_COLORS[tile.tone]
            return (
              <Press
                key={tile.id}
                accessibilityRole="button"
                accessibilityLabel={`${tile.label}, ${tile.countLabel}`}
                onPress={() => onOpenTile(tile.browseId, tile.label)}
                outerStyle={styles.tileOuter}
                pressedScale={0.97}
                style={[styles.tile, { backgroundColor: c.bg, borderColor: c.border }]}
              >
                <Text style={[styles.tileName, { color: c.fg }]}>{tile.label}</Text>
                <Text style={[amType.label, { color: c.sub }]}>{tile.countLabel}</Text>
              </Press>
            )
          })}
        </View>
      </Reveal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: amGap.section, paddingHorizontal: amGap.gutter },
  section: { gap: amGap.block },
  flex: { flex: 1, gap: amSpace.s2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: amSpace.s2 },
  festivalCard: { borderRadius: amRadius.panel, padding: amGap.padPanel, gap: amSpace.s3 },
  festivalName: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 32, textTransform: "uppercase" },
  festivalActions: { flexDirection: "row", gap: amGap.grid, flexWrap: "wrap", paddingTop: amSpace.s2 },
  stack: { gap: amGap.grid },
  storyRow: {
    minHeight: 72,
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingHorizontal: amGap.padCard,
    paddingVertical: amSpace.s3,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s3,
  },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: amGap.grid },
  tileOuter: { width: "48.5%", flexGrow: 1 },
  tile: {
    minHeight: 112,
    borderRadius: amRadius.card,
    borderWidth: 1,
    padding: amGap.padCard,
    justifyContent: "space-between",
  },
  tileName: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, textTransform: "uppercase" },
})
