import { useEffect, useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from "react-native-draggable-flatlist"
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import { Trash2 } from "lucide-react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { queueColors } from "@/components/player-v2/playerTokens"
import { Sheet } from "@/components/player-v2/Sheet"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { queueOrigin } from "@/lib/playerV2/queueOps"

export type QueueRow = { key: string; number: number; title: string }

type Props = {
  visible: boolean
  theme: AmTheme
  sourceTitle: string
  /** Whole list, in play order. The sheet shows the song that plays now, then what comes after it. */
  rows: QueueRow[]
  currentNumber: number | null
  currentTitle: string
  playing: boolean
  savedNumbers: ReadonlySet<number>
  isPlayable: (number: number) => boolean
  onPlay: (number: number) => void
  onRemove: (number: number) => void
  onOrder: (numbers: number[]) => void
  onClearUpcoming: () => void
  onClose: () => void
}

/** The prototype shows a short list; a long catalog list is cut here so the sheet stays quick. */
export const QUEUE_ROW_LIMIT = 100

/** Splits the list at the current song: what stays put and what the sheet lists as "Up next". */
export function splitQueue<T extends { number: number }>(rows: readonly T[], current: number | null, limit = QUEUE_ROW_LIMIT) {
  const at = rows.findIndex((r) => r.number === current)
  const head = at >= 0 ? rows.slice(0, at + 1) : []
  const rest = at >= 0 ? rows.slice(at + 1) : rows.slice()
  return { head, upcoming: rest.slice(0, limit), tail: rest.slice(limit) }
}

/** Three gold bars (prototype .eq): they move while the song plays and rest low when it is paused. */
function Equalizer({ playing }: { playing: boolean }) {
  return (
    <View style={styles.eq} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <EqBar delay={0} playing={playing} />
      <EqBar delay={300} playing={playing} />
      <EqBar delay={600} playing={playing} />
    </View>
  )
}

function EqBar({ delay, playing }: { delay: number; playing: boolean }) {
  const reduce = useReducedMotion()
  const scale = useSharedValue(0.35)
  useEffect(() => {
    cancelAnimation(scale)
    if (reduce) {
      scale.value = 0.6
      return
    }
    if (!playing) {
      scale.value = withTiming(0.35, { duration: 200 })
      return
    }
    const ease = Easing.inOut(Easing.ease)
    scale.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 450, easing: ease }), withTiming(0.25, { duration: 450, easing: ease })), -1),
    )
  }, [playing, reduce, delay, scale])
  // transform-origin is the centre in RN, so shift by half the lost height to pin the bar to the bottom.
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - scale.value) * 8 }, { scaleY: scale.value }] }))
  return <Animated.View style={[styles.eqBar, style]} />
}

/**
 * Queue sheet (prototype QUEUE): dark ground, "Playing from {source}", the song
 * that plays now with a live equalizer, then "Up next" with its count. Drag the
 * handle to reorder, swipe a row to remove it, tap a row to play it. Songs with no
 * audio are marked and skipped by next/previous.
 */
export function QueueSheet(props: Props) {
  const { theme, rows, currentNumber } = props
  const { head, upcoming, tail } = useMemo(() => splitQueue(rows, currentNumber), [rows, currentNumber])
  const total = upcoming.length + tail.length

  const renderItem = ({ item, drag, isActive }: RenderItemParams<QueueRow>) => {
    const playable = props.isPlayable(item.number)
    return (
      <ScaleDecorator>
        <ReanimatedSwipeable
          overshootRight={false}
          rightThreshold={72}
          onSwipeableOpen={() => props.onRemove(item.number)}
          renderRightActions={() => (
            <View style={styles.removeAction}>
              <Trash2 size={20} color={amColors.white} />
            </View>
          )}
        >
          <View style={[styles.row, isActive && styles.rowActive, !playable && styles.dim]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, PS ${item.number}, from ${queueOrigin(item.number, props.savedNumbers)}${playable ? "" : ", no audio yet"}`}
              onPress={() => props.onPlay(item.number)}
              style={styles.main}
            >
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                PS {item.number} · from {queueOrigin(item.number, props.savedNumbers)}
                {playable ? "" : " · no audio yet"}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Reorder ${item.title}`} onPressIn={drag} style={styles.handle}>
              <PlayerIcon name="handle" size={20} color={queueColors.handle} />
            </Pressable>
          </View>
        </ReanimatedSwipeable>
      </ScaleDecorator>
    )
  }

  return (
    <Sheet visible={props.visible} onClose={props.onClose} title={`Playing from ${props.sourceTitle}`} theme={theme} dark fill>
      {props.currentNumber != null ? (
        <View style={[styles.row, styles.now]}>
          <Equalizer playing={props.playing} />
          <View style={styles.main}>
            <Text style={styles.title} numberOfLines={1}>
              {props.currentTitle}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              PS {props.currentNumber} · Now playing
            </Text>
          </View>
        </View>
      ) : null}
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.heading} accessibilityRole="header">
            Up next
          </Text>
          <Text style={[styles.heading, styles.accent]}>
            {total} {total === 1 ? "song" : "songs"} in this list
          </Text>
        </View>
        {total > 0 ? (
          <Pressable accessibilityRole="button" onPress={props.onClearUpcoming} style={styles.clear}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {upcoming.length ? (
        <DraggableFlatList
          data={upcoming}
          keyExtractor={(r) => r.key}
          renderItem={renderItem}
          onDragEnd={({ data }) => props.onOrder([...head.map((r) => r.number), ...data.map((r) => r.number), ...tail.map((r) => r.number)])}
          activationDistance={8}
          containerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <Text style={styles.empty}>Nothing is queued after this song.</Text>
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 8,
    paddingLeft: 20,
    paddingRight: 8,
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: queueColors.row,
  },
  rowActive: { backgroundColor: queueColors.rowNow },
  now: { backgroundColor: queueColors.rowNow },
  main: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 20, color: amColors.white },
  sub: { fontFamily: amFonts.medium, fontSize: 13, color: queueColors.sub, fontVariant: ["tabular-nums"] },
  handle: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dim: { opacity: 0.5 },
  eq: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 16, width: 16 },
  eqBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: amColors.gold300 },
  headingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: 16, paddingLeft: 20, paddingRight: 10, paddingBottom: 12 },
  heading: {
    fontFamily: amFonts.display,
    fontSize: 22,
    lineHeight: 22,
    letterSpacing: -0.44,
    textTransform: "uppercase",
    color: amColors.white,
  },
  accent: { color: queueColors.heading },
  clear: { height: 44, paddingHorizontal: 14, justifyContent: "center" },
  clearText: { fontFamily: amFonts.semi, fontSize: 15, color: amColors.gold300 },
  empty: { fontFamily: amFonts.medium, fontSize: 15, color: queueColors.sub, paddingHorizontal: 20, paddingVertical: 12 },
  removeAction: {
    width: 80,
    marginBottom: 8,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: amColors.danger,
  },
})
