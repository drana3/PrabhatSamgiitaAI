import { memo, useRef, type ReactNode } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"
import ReanimatedSwipeable, { SwipeDirection, type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable"
import { Image } from "expo-image"
import { ListPlus } from "lucide-react-native"

import { SaveButton } from "@/components/save/SaveButton"
import { SaveMark } from "@/components/save/SaveMark"
import { DownloadMark } from "@/components/offline/DownloadMark"

import { overStyle } from "@/components/songs-v2/primitives"
import { Press } from "@/components/songs-v2/Press"
import { RowPlayingMark } from "@/components/songs-v2/RowPlayingMark"
import { amColors } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { rowEyebrow, type CatalogEntry } from "@/lib/songsV2/entry"
import { ROW_GEOMETRY, rowMeta, type RowStyle } from "@/lib/songsV2/rowStyles"
import { useListViewStore } from "@/stores/listViewStore"
import { usePlayerStore } from "@/stores/playerStore"
import { useT } from "@/lib/i18n"
import { MAX_FONT_SCALE } from "@/constants/fontScale"

type Props = {
  theme: SongsTheme
  entry: CatalogEntry
  saved: boolean
  offline?: boolean
  /** which look; omitted = the listener's "Rows" setting */
  variant?: RowStyle
  /** a small photograph in front of the row (Tracklist and Compact; a collection page): the number stays, smaller, beside it */
  photo?: number
  onOpen: (entry: CatalogEntry) => void
  onToggleSave: (entry: CatalogEntry) => void
  onQueue: (entry: CatalogEntry) => void
  onMenu: (entry: CatalogEntry) => void
}

type A11yActions = {
  accessibilityActions: { name: string; label: string }[]
  onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => void
}

const ACTION_WIDTH = 96
/** left column of a Tracklist row: the PS number. The title and the hairline start after it. */
const NUMBER_COLUMN = 48
const HAIRLINE_INSET = 10 + NUMBER_COLUMN

/**
 * One song row in the three looks of the "Rows" setting (stores/listViewStore.ts):
 *  - tracklist: no card, 56px, the PS number in orange800 on the left, title over a quiet meta line,
 *    a small circle-plus on the right, a hairline between rows inset from the number column
 *  - compact (default): a 44px tile (radius 10), number and title only
 *  - cards: prototype `.card.song`: white 20px card, min height 76, `PS 1 · 3:58 · OFFLINE` over a one-line 19px title
 * The save circle (44px touch area) opens the "Save to" sheet in all of them. Swipe right saves, swipe left queues,
 * long press opens the menu. In Tracklist and Compact the song in the player shows the small equaliser in place
 * of its number and a bold title. The swipe uses the gesture-handler swipeable with its own friction.
 */
export const SongCardRow = memo(function SongCardRow({
  theme,
  entry,
  saved,
  offline = false,
  variant,
  photo,
  onOpen,
  onToggleSave,
  onQueue,
  onMenu,
}: Props) {
  const t = useT()
  const stored = useListViewStore((s) => s.rowStyle)
  const look = variant ?? stored
  const slim = look !== "cards"
  // a boolean selector: a row only re-renders when it becomes (or stops being) the playing one
  const current = usePlayerStore((s) => slim && s.currentSong?.number === entry.number)
  const swipe = useRef<SwipeableMethods | null>(null)
  const eyebrow = rowEyebrow(entry, offline)
  const radius = look === "cards" ? 20 : look === "compact" ? 10 : 0
  const meta = look === "tracklist" ? rowMeta(entry, { offline, saved }) : ""

  const a11y: A11yActions = {
    accessibilityActions: [
      { name: "save", label: saved ? t("songs.menu.savedChange") : t("songs.row.addTo") },
      { name: "queue", label: t("songs.menu.addQueue") },
      { name: "menu", label: t("songs.menu.moreActions") },
    ],
    onAccessibilityAction: (event) => {
      if (event.nativeEvent.actionName === "save") onToggleSave(entry)
      else if (event.nativeEvent.actionName === "queue") onQueue(entry)
      else onMenu(entry)
    },
  }

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      leftThreshold={ACTION_WIDTH * 0.6}
      rightThreshold={ACTION_WIDTH * 0.6}
      overshootLeft={false}
      overshootRight={false}
      containerStyle={{ borderRadius: radius }}
      onSwipeableOpen={(direction) => {
        // direction is the way the finger moved: right = save, left = queue
        if (direction === SwipeDirection.RIGHT) onToggleSave(entry)
        else onQueue(entry)
        swipe.current?.close()
      }}
      renderLeftActions={() => (
        <View style={[styles.action, look === "compact" && styles.actionCompact, { backgroundColor: theme.brand, borderRadius: radius }]} accessibilityElementsHidden>
          <SaveMark on={false} size={look === "compact" ? 20 : 22} color={amColors.white} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[overStyle, { color: amColors.white }]}>{saved ? t("songs.menu.saved") : t("songs.row.saveOverlay")}</Text>
        </View>
      )}
      renderRightActions={() => (
        <View style={[styles.action, look === "compact" && styles.actionCompact, { backgroundColor: theme.forest, borderRadius: radius }]} accessibilityElementsHidden>
          <ListPlus size={20} color={amColors.white} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[overStyle, { color: amColors.white }]}>{t("songs.row.queue")}</Text>
        </View>
      )}
    >
      {look === "cards" ? (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <Press
            accessibilityRole="button"
            accessibilityLabel={`${eyebrow}, ${entry.title}`}
            {...a11y}
            onPress={() => onOpen(entry)}
            onLongPress={() => onMenu(entry)}
            delayLongPress={350}
            pressedScale={0.98}
            outerStyle={styles.mainOuter}
            style={styles.main}
          >
            <View style={styles.eyebrowLine}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[overStyle, styles.eyebrowText, { color: theme.accent }]} numberOfLines={1}>
                {eyebrow}
              </Text>
              {offline ? <DownloadedMark label={t("dl.badge")} /> : null}
            </View>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.title, { color: theme.textHeading }]} numberOfLines={1}>
              {entry.title}
            </Text>
          </Press>
          <SaveButton item={{ kind: "song", number: entry.number }} size={24} color={theme.textBody} title={`PS ${entry.number}, ${entry.title}`} />
        </View>
      ) : (
        <View
          style={[
            look === "compact" ? styles.tile : styles.track,
            { height: ROW_GEOMETRY[look].row, backgroundColor: look === "compact" ? theme.card : theme.page },
            look === "compact" && { borderColor: theme.line },
          ]}
        >
          <RowPress
            theme={theme}
            tile={look === "compact"}
            accessibilityLabel={`${eyebrow}, ${entry.title}${meta ? `, ${meta}` : ""}${current ? `, ${t("songs.a11y.playing")}` : ""}`}
            a11y={a11y}
            onPress={() => onOpen(entry)}
            onLongPress={() => onMenu(entry)}
          >
            {photo !== undefined ? (
              <View style={styles.photoCol}>
                <Image
                  source={photo}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                  style={[styles.photo, look === "compact" ? styles.photoCompact : styles.photoTrack, { backgroundColor: theme.inner }]}
                />
                <View style={styles.numSmall}>
                  {current ? (
                    <RowPlayingMark color={theme.accent} />
                  ) : (
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.numTextSmall, { color: theme.accent }]} numberOfLines={1}>
                      {entry.number}
                    </Text>
                  )}
                </View>
              </View>
            ) : (
            <View style={look === "compact" ? styles.numCompact : styles.numTrack}>
              {current ? (
                <RowPlayingMark color={theme.accent} />
              ) : (
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[look === "compact" ? styles.numTextCompact : styles.numText, { color: theme.accent }]} numberOfLines={1}>
                  {entry.number}
                </Text>
              )}
            </View>
            )}
            <View style={styles.text}>
              <View style={styles.eyebrowLine}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE}
                  style={[
                    look === "compact" ? styles.titleCompact : styles.titleTrack,
                    styles.eyebrowText,
                    { color: theme.textHeading, fontFamily: current ? amFonts.bold : look === "compact" ? amFonts.medium : amFonts.regular },
                  ]}
                  numberOfLines={1}
                >
                  {entry.title}
                </Text>
                {offline ? <DownloadedMark label={t("dl.badge")} /> : null}
              </View>
              {meta ? (
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
                  {meta}
                </Text>
              ) : null}
            </View>
          </RowPress>
          <SaveButton
            item={{ kind: "song", number: entry.number }}
            size={22}
            color={theme.textBody}
            title={`PS ${entry.number}, ${entry.title}`}
          />
          {look === "tracklist" ? <View pointerEvents="none" style={[styles.hairline, photo !== undefined && styles.hairlinePhoto, { backgroundColor: `${theme.textHeading}1A` }]} /> : null}
        </View>
      )}
    </ReanimatedSwipeable>
  )
})

/** The small green "Downloaded" square of a row whose song is on the phone (a downloaded song is a saved song with this mark). */
function DownloadedMark({ label }: { label: string }) {
  return (
    <View accessible accessibilityLabel={label} style={styles.dlMark}>
      <DownloadMark status="done" size={14} />
    </View>
  )
}

/**
 * Touch area of a slim row. Feedback starts on touch-down: a tint fades in (opacity) and a tile
 * also dips a little (scale), both sprung from the value on screen, never a CSS transition.
 */
function RowPress({
  theme,
  tile,
  accessibilityLabel,
  a11y,
  onPress,
  onLongPress,
  children,
}: {
  theme: SongsTheme
  tile: boolean
  accessibilityLabel: string
  a11y: A11yActions
  onPress: () => void
  onLongPress: () => void
  children: ReactNode
}) {
  const down = useSharedValue(0)
  const tint = useAnimatedStyle(() => ({ opacity: down.value }))
  const dip = useAnimatedStyle(() => ({ transform: [{ scale: 1 - down.value * (tile ? 0.015 : 0) }] }))
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...a11y}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      onPressIn={() => {
        down.value = withSpring(1, amSpring.default)
      }}
      onPressOut={() => {
        down.value = withSpring(0, amSpring.default)
      }}
      style={styles.pressOuter}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.line, borderRadius: tile ? 10 : 0 }, tint]}
      />
      <Animated.View style={[styles.pressInner, dip]}>{children}</Animated.View>
    </Pressable>
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
  action: {
    width: ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionCompact: { flexDirection: "row", gap: 8 },

  /* slim rows: the slot gives 10px on the left, so a number starts at x = 20 */
  track: { flexDirection: "row", alignItems: "center", paddingLeft: 10 },
  tile: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1 },
  pressOuter: { flex: 1, minWidth: 0, alignSelf: "stretch" },
  pressInner: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  numTrack: { width: NUMBER_COLUMN },
  numCompact: { width: 48, paddingLeft: 12 },
  numText: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20, fontVariant: ["tabular-nums"] },
  numTextCompact: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 18, fontVariant: ["tabular-nums"] },
  text: { flex: 1, minWidth: 0, gap: 1 },
  titleTrack: { fontSize: 16, lineHeight: 21 },
  titleCompact: { fontSize: 15, lineHeight: 20 },
  meta: { fontFamily: amFonts.regular, fontSize: 13, lineHeight: 16 },
  eyebrowLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrowText: { flexShrink: 1 },
  dlMark: { alignItems: "center", justifyContent: "center" },
  photoCol: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 8, paddingRight: 8 },
  photo: { borderRadius: 8 },
  photoCompact: { width: 32, height: 32 },
  photoTrack: { width: 40, height: 40 },
  numSmall: { width: 28 },
  numTextSmall: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16, fontVariant: ["tabular-nums"] },
  hairlinePhoto: { left: 10 + 8 + 40 },
  hairline: { position: "absolute", left: HAIRLINE_INSET, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
})
