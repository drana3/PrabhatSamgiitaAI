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
import { TouchButton } from "@/components/player-v2/TouchButton"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { buildQueueFooter, shufflingFromLine } from "@/lib/playerV2/playerActions"
import type { RepeatMode } from "@/lib/playerV2/controller"
import { queueOrigin } from "@/lib/playerV2/queueOps"
import { trackLabel, trackTag } from "@/lib/kirtan/track"
import { formatClock } from "@/lib/playerV2/transportState"

/** `seconds` (when known) replaces the "from Catalog" origin with the song length, as the prototype shows it. */
export type QueueRow = {
  key: string
  number: number
  title: string
  seconds?: number
  /** second line for a Kiirtan row (`12:40 · Priya Devi`); songs build theirs from the number */
  sub?: string
}

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
  /** Preview mode: the prototype's short static list (six rows, no Clear) that sizes itself to its content. */
  compact?: boolean
  /** Footer under the list: Shuffle, Repeat, Timer. Left out, the footer is not drawn. */
  footer?: {
    shuffleOn: boolean
    repeat: RepeatMode
    timerOn: boolean
    onShuffle: () => void
    onRepeat: () => void
    onTimer: () => void
    /** "Shuffle everything": all songs and all Kiirtans in one shuffled queue */
    onShuffleEverything?: () => void
  }
}

/** Rows the prototype's queue lists. */
const COMPACT_ROWS = 6

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
    <View style={styles.eq} aria-hidden>
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
  const shuffleLine = shufflingFromLine(props.footer?.shuffleOn ?? false, props.sourceTitle)

  const subLine = (item: QueueRow, playable: boolean) => {
    const tail = playable ? "" : " · no audio yet"
    if (trackTag(item.number) === "KIIRTAN") return `${item.sub ?? (item.seconds ? formatClock(item.seconds) : "Kiirtan")}${tail}`
    return `PS ${item.number} · ${item.seconds != null ? formatClock(item.seconds) : `from ${queueOrigin(item.number, props.savedNumbers)}`}${tail}`
  }

  const renderRow = (item: QueueRow, drag: (() => void) | null, isActive: boolean) => {
    const playable = props.isPlayable(item.number)
    return (
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
              accessibilityLabel={`${item.title}, ${trackTag(item.number) === "KIIRTAN" ? "Kiirtan" : `PS ${item.number}`}${playable ? "" : ", no audio yet"}`}
              onPress={() => props.onPlay(item.number)}
              style={styles.main}
            >
              <View style={styles.titleLine}>
                <Text style={[styles.title, styles.titleText]} numberOfLines={1}>
                  {item.title}
                </Text>
                <TrackTag number={item.number} />
              </View>
              <Text style={styles.sub} numberOfLines={1}>
                {subLine(item, playable)}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Reorder ${item.title}`} onPressIn={drag ?? undefined} style={styles.handle}>
              <PlayerIcon name="handle" size={20} color={queueColors.handle} />
            </Pressable>
          </View>
        </ReanimatedSwipeable>
    )
  }

  const renderItem = ({ item, drag, isActive }: RenderItemParams<QueueRow>) => (
    <ScaleDecorator>{renderRow(item, drag, isActive)}</ScaleDecorator>
  )

  return (
    <Sheet visible={props.visible} onClose={props.onClose} title={`Playing from ${props.sourceTitle}`} theme={theme} dark fill={!props.compact}>
      {props.currentNumber != null ? (
        <View style={[styles.row, styles.now]}>
          <Equalizer playing={props.playing} />
          <View style={styles.main}>
            <View style={styles.titleLine}>
              <Text style={[styles.title, styles.titleText]} numberOfLines={1}>
                {props.currentTitle}
              </Text>
              <TrackTag number={props.currentNumber} />
            </View>
            <Text style={styles.sub} numberOfLines={1}>
              {trackLabel(props.currentNumber)} · Now playing
            </Text>
          </View>
        </View>
      ) : null}
      {shuffleLine ? (
        <View style={styles.shuffleRow} accessibilityRole="text" accessibilityLabel={shuffleLine}>
          <View style={styles.shuffleRule} />
          <Text style={styles.shuffleText} numberOfLines={1}>
            {shuffleLine}
          </Text>
          <View style={styles.shuffleRule} />
        </View>
      ) : null}
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.heading} accessibilityRole="header">
            Up next
          </Text>
          <Text style={[styles.heading, styles.accent]}>
            {total} {total === 1 ? "track" : "tracks"} in this list
          </Text>
        </View>
        {total > 0 && !props.compact ? (
          <Pressable accessibilityRole="button" onPress={props.onClearUpcoming} style={styles.clear}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {upcoming.length && props.compact ? (
        <View>{upcoming.slice(0, COMPACT_ROWS).map((item) => <View key={item.key}>{renderRow(item, null, false)}</View>)}</View>
      ) : upcoming.length ? (
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
        <Text style={styles.empty}>Nothing is queued after this one.</Text>
      )}
      {props.footer ? <QueueFooter {...props.footer} /> : null}
    </Sheet>
  )
}

/** PS or KIIRTAN: a small tag so both kinds read apart in one queue. */
function TrackTag({ number }: { number: number }) {
  const kiirtan = trackTag(number) === "KIIRTAN"
  return (
    <View style={[styles.tag, kiirtan ? styles.tagKiirtan : styles.tagPs]} aria-hidden>
      <Text style={[styles.tagText, kiirtan ? styles.tagTextKiirtan : styles.tagTextPs]}>{kiirtan ? "KIIRTAN" : "PS"}</Text>
    </View>
  )
}

/** Shuffle, Repeat (off, all, one) and Timer: three equal buttons, orange when on. Each answers on touch-down. */
function QueueFooter({ shuffleOn, repeat, timerOn, onShuffle, onRepeat, onTimer, onShuffleEverything }: NonNullable<Props["footer"]>) {
  const buttons = buildQueueFooter({ shuffleOn, repeat, timerOn })
  const act = { shuffle: onShuffle, repeat: onRepeat, timer: onTimer }
  const icon = { shuffle: "shuffle", repeat: "repeat", timer: "timer" } as const
  return (
    <View>
      {onShuffleEverything ? (
        <TouchButton
          accessibilityRole="button"
          accessibilityLabel="Shuffle everything: all songs and all Kiirtans"
          onAction={onShuffleEverything}
          containerStyle={styles.everythingHit}
          style={styles.everything}
        >
          <PlayerIcon name="shuffle" size={20} color={amColors.white} />
          <Text style={styles.footerText}>Shuffle everything</Text>
        </TouchButton>
      ) : null}
    <View style={styles.footer}>
      {buttons.map((b) => (
        <TouchButton
          key={b.id}
          accessibilityRole="button"
          accessibilityLabel={b.label}
          accessibilityState={{ selected: b.active }}
          onAction={act[b.id]}
          containerStyle={styles.footerHit}
          style={[styles.footerBtn, b.active && styles.footerBtnOn]}
        >
          <PlayerIcon name={icon[b.id]} size={20} color={amColors.white} />
          <Text style={styles.footerText} numberOfLines={1}>
            {b.label}
          </Text>
        </TouchButton>
      ))}
    </View>
    </View>
  )
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  shuffleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 2 },
  shuffleRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: queueColors.grab },
  shuffleText: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, color: queueColors.heading, flexShrink: 1 },
  footer: { flexDirection: "row", gap: 8, paddingHorizontal: 10, paddingTop: 12 },
  footerHit: { flex: 1 },
  everythingHit: { paddingHorizontal: 10, paddingTop: 12 },
  everything: {
    height: 48,
    borderRadius: 9999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  titleText: { flexShrink: 1 },
  tag: { paddingHorizontal: 6, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tagPs: { backgroundColor: "rgba(255, 255, 255, 0.12)" },
  tagKiirtan: { backgroundColor: amColors.gold300 },
  tagText: { fontFamily: amFonts.bold, fontSize: 10, lineHeight: 12, letterSpacing: 0.6 },
  tagTextPs: { color: "rgba(255, 255, 255, 0.78)" },
  tagTextKiirtan: { color: "#1E1E1E" },
  footerBtn: {
    height: 48,
    borderRadius: 9999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: queueColors.row,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  footerBtnOn: { backgroundColor: amColors.orange500, borderColor: amColors.orange500 },
  footerText: { fontFamily: amFonts.semi, fontSize: 14, color: amColors.white },
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
  sub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18.85, color: queueColors.sub, fontVariant: ["tabular-nums"] },
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
