import { memo, useRef } from "react"
import { StyleSheet, Text, View } from "react-native"
import ReanimatedSwipeable, { SwipeDirection, type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable"
import { ListPlus } from "lucide-react-native"

import { SaveButton } from "@/components/save/SaveButton"
import { SaveMark } from "@/components/save/SaveMark"

import { overStyle } from "@/components/songs-v2/primitives"
import { Press } from "@/components/songs-v2/Press"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { rowEyebrow, type CatalogEntry } from "@/lib/songsV2/entry"

type Props = {
  theme: SongsTheme
  entry: CatalogEntry
  saved: boolean
  offline?: boolean
  onOpen: (entry: CatalogEntry) => void
  onToggleSave: (entry: CatalogEntry) => void
  onQueue: (entry: CatalogEntry) => void
  onMenu: (entry: CatalogEntry) => void
}

const ACTION_WIDTH = 96

/**
 * Prototype `.card.song`: white 20px card, min height 76, `PS 1 · 3:58 · OFFLINE` over a one-line
 * 19px title, a 44px circle-plus on the right (a filled check once saved) that opens the "Save to" sheet.
 * Kept from the first build: swipe right saves, swipe left queues, long press opens the menu.
 * The swipe uses the gesture-handler swipeable with its own friction (see the branch notes).
 */
export const SongCardRow = memo(function SongCardRow({
  theme,
  entry,
  saved,
  offline = false,
  onOpen,
  onToggleSave,
  onQueue,
  onMenu,
}: Props) {
  const swipe = useRef<SwipeableMethods | null>(null)
  const eyebrow = rowEyebrow(entry, offline)

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      leftThreshold={ACTION_WIDTH * 0.6}
      rightThreshold={ACTION_WIDTH * 0.6}
      overshootLeft={false}
      overshootRight={false}
      containerStyle={styles.swipe}
      onSwipeableOpen={(direction) => {
        // direction is the way the finger moved: right = save, left = queue
        if (direction === SwipeDirection.RIGHT) onToggleSave(entry)
        else onQueue(entry)
        swipe.current?.close()
      }}
      renderLeftActions={() => (
        <View style={[styles.action, { backgroundColor: theme.brand }]} accessibilityElementsHidden>
          <SaveMark on={false} size={22} color={amColors.white} />
          <Text style={[overStyle, { color: amColors.white }]}>{saved ? "Saved" : "Save to"}</Text>
        </View>
      )}
      renderRightActions={() => (
        <View style={[styles.action, { backgroundColor: theme.forest }]} accessibilityElementsHidden>
          <ListPlus size={20} color={amColors.white} />
          <Text style={[overStyle, { color: amColors.white }]}>Queue</Text>
        </View>
      )}
    >
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
        <Press
          accessibilityRole="button"
          accessibilityLabel={`${eyebrow}, ${entry.title}`}
          accessibilityActions={[
            { name: "save", label: saved ? "Saved. Change" : "Add to…" },
            { name: "queue", label: "Add to queue" },
            { name: "menu", label: "More actions" },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "save") onToggleSave(entry)
            else if (event.nativeEvent.actionName === "queue") onQueue(entry)
            else onMenu(entry)
          }}
          onPress={() => onOpen(entry)}
          onLongPress={() => onMenu(entry)}
          delayLongPress={350}
          pressedScale={0.98}
          outerStyle={styles.mainOuter}
          style={styles.main}
        >
          <Text style={[overStyle, { color: theme.accent }]} numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={1}>
            {entry.title}
          </Text>
        </Press>
        <SaveButton item={{ kind: "song", number: entry.number }} size={24} color={theme.textBody} title={`PS ${entry.number}, ${entry.title}`} />
      </View>
    </ReanimatedSwipeable>
  )
})

const styles = StyleSheet.create({
  swipe: { borderRadius: 20 },
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
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
})
