import { useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { Play } from "lucide-react-native"

import { Chip, PillButton } from "@/components/songs-v2/Pill"
import { CardButton, EmptyNote, overStyle, SectionHeading } from "@/components/songs-v2/primitives"
import { Press } from "@/components/songs-v2/Press"
import { SongsReveal } from "@/components/songs-v2/SongsReveal"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { allCollections } from "@/data/collections"
import type { StorySummary } from "@/data/stories"
import { songNumbersForCategory } from "@/lib/categorySongs"
import { festivalChips, pickFestival, SPECIAL_TILES, storyEyebrow, tilesWithCounts, type TileTone } from "@/lib/songsV2/collections"
import { storyLoader } from "@/lib/songsV2/storyApi"

type Props = {
  theme: SongsTheme
  stories: StorySummary[]
  storiesLoading: boolean
  onPlayAll: (numbers: number[]) => void
  onOpenFestival: (label: string) => void
  onOpenStory: (story: StorySummary) => void
  onOpenTile: (browseId: string, label: string) => void
}

/** Prototype `.tile` (line 828 overrides `.lcard`): olive-100 or white, ink on top, 168 x 140. */
function tileColors(theme: SongsTheme, tone: TileTone) {
  if (tone === "white") return { bg: theme.card, fg: theme.textHeading, border: theme.line }
  if (tone === "peach") return { bg: theme.peach, fg: theme.textHeading, border: "transparent" }
  if (tone === "forest") return { bg: amColors.sage700, fg: amColors.white, border: "transparent" }
  return { bg: amColors.olive100, fg: amColors.sage900, border: "transparent" }
}

/**
 * Collections (prototype lines 1166-1214): Festival songs, Stories behind the songs, Special
 * collections. A festival chip swaps the green card in place. Blocks reveal with `--i` 3 to 9.
 */
export function CollectionsSegment({ theme, stories, storiesLoading, onPlayAll, onOpenFestival, onOpenStory, onOpenTile }: Props) {
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

  return (
    <View>
      {festival ? (
        <View style={[styles.sect, { paddingTop: 28 }]}>
          <SongsReveal index={3} style={styles.pad10}>
            <SectionHeading theme={theme} first="Festival" second="songs" />
          </SongsReveal>
          <SongsReveal index={4}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {chips.map((chip) => (
                <Chip key={chip.id} theme={theme} label={chip.label} active={chip.id === festival.id} onPress={() => setFestivalId(chip.id)} />
              ))}
            </ScrollView>
          </SongsReveal>
          <SongsReveal index={5} style={styles.list}>
            <View style={[styles.lcard, { backgroundColor: amColors.sage700, paddingTop: 20, paddingBottom: 22 }]}>
              <Text style={[overStyle, { color: amColors.gold300 }]}>{festival.eyebrow}</Text>
              <Text style={styles.festName}>{festival.label}</Text>
              <Text style={styles.festCount}>{festival.count === 1 ? "1 song" : `${festival.count} songs`}</Text>
              <View style={styles.festActions}>
                <PillButton
                  theme={theme}
                  label="Play all"
                  icon={<Play size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />}
                  onPress={() => onPlayAll(festival.songNumbers)}
                />
                <PillButton theme={theme} tone="sand" label="See songs" onPress={() => onOpenFestival(festival.label)} />
              </View>
            </View>
          </SongsReveal>
        </View>
      ) : null}

      <View style={styles.sect}>
        <SongsReveal index={6} style={styles.pad10}>
          <SectionHeading theme={theme} first="Stories" second="behind the songs" />
        </SongsReveal>
        <SongsReveal index={7} style={styles.list}>
          {stories.map((story) => (
            <CardButton
              key={story.slug}
              theme={theme}
              eyebrow={storyEyebrow(storyLoader.peekMinutes(story.slug))}
              title={story.title}
              onPress={() => onOpenStory(story)}
            />
          ))}
          {!stories.length ? (
            <EmptyNote theme={theme} style={{ paddingHorizontal: 10 }}>
              {storiesLoading ? "Loading stories…" : "No stories to show right now."}
            </EmptyNote>
          ) : null}
        </SongsReveal>
      </View>

      <View style={styles.sect}>
        <SongsReveal index={8} style={styles.pad10}>
          <SectionHeading theme={theme} first="Special" second="collections" />
        </SongsReveal>
        <SongsReveal index={9} style={styles.tiles}>
          {tiles.map((tile, i) => {
            const c = tileColors(theme, tile.tone)
            return (
              <View key={tile.id} style={[styles.cell, i % 2 === 0 ? styles.cellL : styles.cellR]}>
                <Press
                  accessibilityRole="button"
                  accessibilityLabel={`${tile.label}, ${tile.countLabel}`}
                  onPress={() => onOpenTile(tile.browseId, tile.label)}
                  pressedScale={0.98}
                  style={[styles.tile, { backgroundColor: c.bg, borderColor: c.border, borderWidth: c.border === "transparent" ? 0 : 1 }]}
                >
                  <Text style={[styles.tileName, { color: c.fg }]} numberOfLines={2}>
                    {tile.label}
                  </Text>
                  <Text style={[styles.tileCount, { color: c.fg }]}>{tile.countLabel}</Text>
                </Press>
              </View>
            )
          })}
        </SongsReveal>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sect: { paddingTop: 40, gap: 20 },
  pad10: { paddingHorizontal: 10 },
  chips: { paddingHorizontal: 10, gap: 8 },
  list: { paddingHorizontal: 10, gap: 10 },
  lcard: { borderRadius: 30, paddingHorizontal: 20, gap: 12, overflow: "hidden" },
  festName: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 28, letterSpacing: -0.56, textTransform: "uppercase", color: "#FFFFFF" },
  festCount: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19, color: "rgba(255,255,255,0.82)" },
  festActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  tiles: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, rowGap: 10 },
  cell: { width: "50%" },
  cellL: { paddingRight: 5 },
  cellR: { paddingLeft: 5 },
  tile: { width: 168, height: 140, borderRadius: 30, padding: 20, justifyContent: "space-between", alignItems: "flex-start" },
  tileName: { fontFamily: amFonts.display, fontSize: 20, lineHeight: 20, letterSpacing: -0.4, textTransform: "uppercase" },
  tileCount: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 17 },
})
