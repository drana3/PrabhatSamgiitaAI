import { memo, useRef } from "react"
import { StyleSheet, Text, View } from "react-native"
import ReanimatedSwipeable, { SwipeDirection, type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable"
import { Heart, ListPlus } from "lucide-react-native"

import { Press } from "@/components/songs-v2/Press"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amColors } from "@/constants/tokens/amColors"
import { amGap, amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { rowEyebrow, type CatalogEntry } from "@/lib/songsV2/entry"

type Props = {
  theme: AmTheme
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
 * White card, eyebrow `PS 3 / 4:31`, title Roboto 600 19px wrapping to two
 * lines, heart on the right, no thumbnail (spec SCR-11 item 5).
 * Tap opens the song page. Swipe right saves, swipe left adds to the queue,
 * long press opens the menu. Swipe actions use the gesture-handler swipeable
 * with its own friction, not the amSpring tokens (see the branch notes).
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

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      leftThreshold={ACTION_WIDTH * 0.6}
      rightThreshold={ACTION_WIDTH * 0.6}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableOpen={(direction) => {
        // direction is the way the finger moved: right = save, left = queue
        if (direction === SwipeDirection.RIGHT) onToggleSave(entry)
        else onQueue(entry)
        swipe.current?.close()
      }}
      renderLeftActions={() => (
        <View style={[styles.action, { backgroundColor: theme.brand }]} accessibilityElementsHidden>
          <Heart size={20} color={theme.onBrand} fill={saved ? theme.onBrand : "none"} />
          <Text style={[amType.label, { color: theme.onBrand }]}>{saved ? "Unsave" : "Save"}</Text>
        </View>
      )}
      renderRightActions={() => (
        <View style={[styles.action, { backgroundColor: theme.forest }]} accessibilityElementsHidden>
          <ListPlus size={20} color={amColors.white} />
          <Text style={[amType.label, { color: amColors.white }]}>Queue</Text>
        </View>
      )}
    >
      <Press
        accessibilityRole="button"
        accessibilityLabel={`${rowEyebrow(entry, offline)}, ${entry.title}`}
        accessibilityActions={[
          { name: "save", label: saved ? "Remove from saved" : "Save" },
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
        pressedScale={0.985}
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <View style={styles.copy}>
          <Text style={[amType.label, { color: theme.eyebrow }]}>{rowEyebrow(entry, offline)}</Text>
          <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={2}>
            {entry.title}
          </Text>
        </View>
        <Press
          accessibilityRole="button"
          accessibilityLabel={saved ? `Remove PS ${entry.number} from saved` : `Save PS ${entry.number}`}
          accessibilityState={{ selected: saved }}
          onPress={() => onToggleSave(entry)}
          pressedScale={0.88}
          hitSlop={amSpace.s1}
          style={styles.heart}
        >
          <Heart size={22} color={saved ? theme.brand : theme.textMuted} fill={saved ? theme.brand : "none"} />
        </Press>
      </Press>
    </ReanimatedSwipeable>
  )
})

const styles = StyleSheet.create({
  card: {
    minHeight: 72,
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingLeft: amGap.padCard,
    paddingRight: amSpace.s2,
    paddingVertical: amSpace.s3,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s3,
  },
  copy: { flex: 1, gap: amSpace.s1 },
  title: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 24 },
  heart: { width: amTouchTarget, height: amTouchTarget, alignItems: "center", justifyContent: "center" },
  action: {
    width: ACTION_WIDTH,
    borderRadius: amRadius.card,
    alignItems: "center",
    justifyContent: "center",
    gap: amSpace.s1,
  },
})
