import { StyleSheet, Text, View } from "react-native"

import { DotsIcon } from "@/components/songs-v2/ListIcons"
import { Press } from "@/components/songs-v2/Press"
import { overStyle } from "@/components/songs-v2/primitives"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { MAX_FONT_SCALE } from "@/constants/fontScale"
import { useT } from "@/lib/i18n"
import { ROW_GEOMETRY } from "@/lib/songsV2/rowStyles"
import { useListViewStore } from "@/stores/listViewStore"

/**
 * One song of a playlist, in the listener's "Rows" look (stores/listViewStore.ts): Compact (default, a 44px
 * tile with the number and the title), Tracklist (56px, number column, quiet meta line) or Cards (the prototype
 * song card `.card.song`: 76px, radius 20, eyebrow over a 19px title). A 44px three-dots button (the song menu,
 * where "Remove from this playlist" lives) sits where the catalog row has its heart.
 */
export function PlaylistSongRow({
  theme,
  number,
  offline = false,
  eyebrow,
  title,
  accessibilityLabel,
  menuLabel,
  onOpen,
  onMenu,
}: {
  theme: SongsTheme
  number: number
  offline?: boolean
  eyebrow: string
  title: string
  accessibilityLabel: string
  menuLabel: string
  onOpen: () => void
  onMenu: () => void
}) {
  const t = useT()
  const look = useListViewStore((s) => s.rowStyle)
  if (look !== "cards") {
    const compact = look === "compact"
    return (
      <View
        style={[
          compact ? styles.tile : styles.track,
          { height: ROW_GEOMETRY[look].row, backgroundColor: compact ? theme.card : theme.page },
          compact && { borderColor: theme.line },
        ]}
      >
        <Press
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onOpen}
          onLongPress={onMenu}
          delayLongPress={350}
          pressedScale={compact ? 0.985 : 1}
          outerStyle={styles.slimOuter}
          style={styles.slimMain}
        >
          <View style={compact ? styles.numCompact : styles.numTrack}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[compact ? styles.numTextCompact : styles.numText, { color: theme.accent }]} numberOfLines={1}>
              {number}
            </Text>
          </View>
          <View style={styles.slimText}>
            <Text
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={[compact ? styles.titleCompact : styles.titleTrack, { color: theme.textHeading, fontFamily: compact ? amFonts.medium : amFonts.regular }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {!compact && offline ? (
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
                {t("songs.offline")}
              </Text>
            ) : null}
          </View>
        </Press>
        <Press accessibilityRole="button" accessibilityLabel={menuLabel} onPress={onMenu} pressedScale={0.88} style={styles.remove}>
          <DotsIcon size={22} color={theme.textBody} />
        </Press>
        {!compact ? <View pointerEvents="none" style={[styles.hairline, { backgroundColor: `${theme.textHeading}1A` }]} /> : null}
      </View>
    )
  }
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onOpen}
        pressedScale={0.98}
        outerStyle={styles.mainOuter}
        style={styles.main}
      >
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[overStyle, { color: theme.accent }]} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.title, { color: theme.textHeading }]} numberOfLines={1}>
          {title}
        </Text>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel={menuLabel} onPress={onMenu} pressedScale={0.88} style={styles.remove}>
        <DotsIcon size={22} color={theme.textBody} />
      </Press>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 20,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mainOuter: { flex: 1, minWidth: 0 },
  main: { gap: 4 },
  title: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 22, letterSpacing: -0.19 },
  remove: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },

  /* slim rows: the same measurements as the catalog rows (components/songs-v2/SongCardRow.tsx) */
  track: { flexDirection: "row", alignItems: "center", paddingLeft: 10, paddingRight: 4 },
  tile: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingRight: 4 },
  slimOuter: { flex: 1, minWidth: 0, alignSelf: "stretch" },
  slimMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  slimText: { flex: 1, minWidth: 0, gap: 1 },
  numTrack: { width: 48 },
  numCompact: { width: 48, paddingLeft: 12 },
  numText: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20, fontVariant: ["tabular-nums"] },
  numTextCompact: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 18, fontVariant: ["tabular-nums"] },
  titleTrack: { fontSize: 16, lineHeight: 21 },
  titleCompact: { fontSize: 15, lineHeight: 20 },
  meta: { fontFamily: amFonts.regular, fontSize: 13, lineHeight: 16 },
  hairline: { position: "absolute", left: 58, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
})
