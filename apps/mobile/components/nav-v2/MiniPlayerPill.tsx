import { useCallback, useEffect } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { Frost } from "@/components/common/Frost"
import { MAX_FONT_SCALE } from "@/constants/fontScale"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"

import { HomeCover } from "@/components/home/HomeBlocks"
import { KiirtanCover } from "@/components/kirtan/KiirtanCover"
import { withKindWord } from "@/lib/kirtan/kind"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { SaveButton } from "@/components/save/SaveButton"
import { useSheetCover } from "@/components/nav-v2/sheetCover"
import { PressScale } from "@/components/today/motion"
import { amReveal, amSpring, projectMomentum } from "@/constants/tokens/amMotion"
import { amNav } from "@/constants/tokens/amNav"
import { amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useRadioPools } from "@/hooks/useRadioPools"
import { useT } from "@/lib/i18n"
import { miniRadioLine } from "@/lib/radio/labels"
import { miniProgress, miniSubtitle, isDarkTheme, rubberBand } from "@/lib/navV2"
import { songPlayback } from "@/lib/playback"
import { skipToNextSong, skipToPreviousSong } from "@/lib/playerV2/transport"
import type { SaveItem } from "@/lib/save/saveToSheet"
import { usePlayerStore } from "@/stores/playerStore"

/**
 * Pill colours from the prototype (.mini): white 38% with a 60% edge in Light, neutral
 * rgb(38,35,32) at 94% with a 10% edge in Dark, and a 1px highlight along the top edge.
 */
const MINI_PALETTE = {
  light: { background: "rgba(255, 255, 255, 0.38)", edge: "rgba(255, 255, 255, 0.6)", highlight: "rgba(255, 255, 255, 0.55)" },
  dark: { background: "rgba(38, 35, 32, 0.94)", edge: "rgba(255, 255, 255, 0.10)", highlight: "rgba(255, 255, 255, 0.08)" },
} as const

/** Distance the pill travels when it appears or leaves. */
const SLIDE = 16
/** Finger travel before a drag counts, and how far a drag must carry (after momentum) to act. */
const DRAG_SLOP = 8
const OPEN_DISTANCE = 72
const SWIPE_DISTANCE = 84
const COVER = 44

type Props = {
  /** from miniPlayerVisible(): route rule plus "something is loaded" */
  visible: boolean
  /** distance of the pill from the bottom of the screen (above the tab bar, or above the safe area) */
  bottom: number
  /** tap on the text, or a drag upwards: open the full player */
  onOpenPlayer: () => void
}

/**
 * The persistent mini-player: ONE pill above the tab bar (or above the bottom edge on screens with no tab
 * bar), on every screen while something is loaded. Cover, title, subtitle, save, play/pause and a thin
 * orange progress line on its lower edge. Tap the text or drag the pill up to open the full player; drag
 * it left or right for next / previous.
 *
 * Motion: the drag follows the finger 1:1 (rubber band against the direction that does nothing), the
 * landing point is the momentum projection of the release velocity, and the pill springs from where it is
 * on screen, so every movement can be interrupted. Only transform and opacity animate. With Reduce
 * Motion the pill just fades and the drag still works but nothing springs.
 */
export function MiniPlayerPill({ visible, bottom, onOpenPlayer }: Props) {
  const theme = useAmTheme()
  const t = useT()
  const reduce = useReducedMotion()
  const palette = MINI_PALETTE[isDarkTheme(theme) ? "dark" : "light"]

  const currentSong = usePlayerStore((s) => s.currentSong)
  const position = usePlayerStore((s) => s.position)
  const duration = usePlayerStore((s) => s.duration)
  const showPause = usePlayerStore((s) => (s.currentSong ? songPlayback(s, s.currentSong).showPause : false))
  const isBuffering = usePlayerStore((s) => (s.currentSong ? songPlayback(s, s.currentSong).isBuffering : false))
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const pause = usePlayerStore((s) => s.pause)
  // While the Radio runs, the second line says what it plays ("Radio · Kiirtan, Bhajan") instead of the track number.
  const radioRunning = usePlayerStore((s) => s.playbackMode === "random" && s.driveAutoAdvance)
  const radio = useRadioPools()
  const isKiirtan = currentSong?.kind === "kiirtan"
  const kiirtanId = currentSong?.kiirtan?.id ?? null

  // A bottom sheet covers the mini player, as in the prototype.
  const covered = useSheetCover((s) => s.count > 0)
  const shown = useSharedValue(visible ? 1 : 0)
  useEffect(() => {
    const target = visible && !covered ? 1 : 0
    shown.value = reduce ? withTiming(target, { duration: amReveal.durationMs / 2 }) : withSpring(target, amSpring.default)
  }, [visible, covered, reduce, shown])

  const dx = useSharedValue(0)
  const dy = useSharedValue(0)
  const axis = useSharedValue(0) // 0 undecided, 1 vertical, 2 horizontal

  // The same Next / Previous as the Player buttons and the lock screen.
  const goNext = useCallback(() => skipToNextSong(), [])
  const goPrevious = useCallback(() => skipToPreviousSong(), [])

  const settle = (value: { value: number }, velocity: number) => {
    "worklet"
    value.value = reduce ? 0 : withSpring(0, { ...(Math.abs(velocity) > 500 ? amSpring.fling : amSpring.default), velocity })
  }

  const drag = Gesture.Pan()
    .activeOffsetY([-DRAG_SLOP, DRAG_SLOP])
    .activeOffsetX([-DRAG_SLOP, DRAG_SLOP])
    .onStart(() => {
      "worklet"
      // take over from wherever the pill is on screen right now (it may still be springing back)
      cancelAnimation(dx)
      cancelAnimation(dy)
      axis.value = 0
    })
    .onUpdate((event) => {
      "worklet"
      if (axis.value === 0) axis.value = Math.abs(event.translationY) > Math.abs(event.translationX) ? 1 : 2
      if (axis.value === 1) {
        // up is 1:1; down meets a rubber band
        dy.value = rubberBand(event.translationY, -400, 0, 120)
      } else {
        dx.value = rubberBand(event.translationX, -140, 140, 160)
      }
    })
    .onEnd((event) => {
      "worklet"
      if (axis.value === 1) {
        const landing = projectMomentum(event.translationY, event.velocityY)
        const open = landing < -OPEN_DISTANCE
        settle(dy, event.velocityY)
        if (open) scheduleOnRN(onOpenPlayer)
      } else {
        const landing = projectMomentum(event.translationX, event.velocityX)
        settle(dx, event.velocityX)
        if (landing < -SWIPE_DISTANCE) scheduleOnRN(goNext)
        else if (landing > SWIPE_DISTANCE) scheduleOnRN(goPrevious)
      }
      axis.value = 0
    })
    .onFinalize((_event, success) => {
      "worklet"
      if (success) return
      settle(dx, 0)
      settle(dy, 0)
    })

  const animated = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [
      { translateX: dx.value },
      { translateY: (reduce ? 0 : (1 - shown.value) * SLIDE) + dy.value },
    ],
  }))

  if (!currentSong) return null

  const progress = miniProgress(position, duration)
  const saveItem: SaveItem = isKiirtan && kiirtanId ? { kind: "kiirtan", id: kiirtanId } : { kind: "song", number: currentSong.number }
  const blurTint = isDarkTheme(theme) ? "dark" : "light"
  return (
    <Animated.View
      pointerEvents={visible && !covered ? "box-none" : "none"}
      aria-hidden={!visible}
      style={[styles.slot, { bottom }, animated]}
    >
      <GestureDetector gesture={drag}>
        <View style={[styles.pill, { backgroundColor: palette.background, borderColor: palette.edge }]} collapsable={false}>
          <Frost intensity={amNav.miniBlurIntensity} tint={blurTint} style={[StyleSheet.absoluteFill, styles.blur]} />
          <View pointerEvents="none" style={[styles.highlight, { backgroundColor: palette.highlight }]} />
          <View style={styles.mainSlot}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={t("player.mini.open", { title: currentSong.title })}
            onPress={onOpenPlayer}
            pressedScale={0.985}
            style={styles.main}
          >
            <View style={styles.cover}>
              {isKiirtan ? (
                <KiirtanCover type={currentSong.kiirtan?.type} kind={currentSong.kiirtan?.recording} coverUrl={currentSong.thumbnailUrl || null} width={COVER} height={COVER} radius={12} glyph={22} photoSeed={currentSong.kiirtan?.id ?? String(currentSong.id)} title={currentSong.title} durationSec={currentSong.durationSeconds || null} />
              ) : (
                <HomeCover number={currentSong.number} size={COVER} radius={12} />
              )}
            </View>
            <View style={styles.text}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.title, { color: theme.textHeading }]} numberOfLines={1}>
                {currentSong.title}
              </Text>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.sub, { color: theme.textBody }]} numberOfLines={1}>
                {radioRunning
                  ? miniRadioLine(radio.chosen, radio.counts)
                  : withKindWord(miniSubtitle({ number: currentSong.number, position, duration, kind: isKiirtan ? "kiirtan" : "song" }), currentSong.kiirtan?.recording)}
              </Text>
            </View>
          </PressScale>
          </View>

          <SaveButton
            item={saveItem}
            size={24}
            color={theme.textHeading}
            title={currentSong.title}
            style={styles.control}
          />
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={showPause ? t("player.mini.pause", { title: currentSong.title }) : t("player.mini.play", { title: currentSong.title })}
            onPress={() => {
              if (showPause) pause()
              else togglePlay()
            }}
            style={[styles.control, { backgroundColor: theme.brand }]}
          >
            {isBuffering ? (
              <ActivityIndicator color={theme.onBrand} size="small" />
            ) : showPause ? (
              <PlayerIcon name="pause" size={22} color={theme.onBrand} />
            ) : (
              <PlayerIcon name="play" size={22} color={theme.onBrand} />
            )}
          </PressScale>

          <View pointerEvents="none" style={styles.track}>
            <View
              style={[
                styles.bar,
                { backgroundColor: theme.brand, transform: [{ scaleX: Math.max(progress, 0.0001) }] },
              ]}
            />
          </View>
        </View>
      </GestureDetector>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  slot: {
    position: "absolute",
    left: amNav.inset,
    right: amNav.inset,
  },
  pill: {
    height: amNav.miniHeight,
    borderRadius: amNav.radius,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 10,
    paddingRight: 8,
  },
  /** the touch wrapper: takes the free width so a long title truncates instead of pushing the buttons out */
  mainSlot: { flex: 1, minWidth: 0 },
  main: {
    minWidth: 0,
    minHeight: amTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cover: { width: COVER, height: COVER, borderRadius: 12, overflow: "hidden" },
  text: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  title: {
    fontFamily: amFonts.semi,
    fontSize: 16,
    lineHeight: 20,
  },
  sub: {
    fontFamily: amFonts.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  control: {
    flexShrink: 0,
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  /**
   * The blur layer carries the pill's own radius. A backdrop blur is not always clipped by the rounded
   * overflow of its parent (the browser preview drew a square frosted rectangle around the pill), so it is
   * rounded itself and nothing square can show.
   */
  blur: { borderRadius: amNav.radius, overflow: "hidden" },
  highlight: { position: "absolute", left: 0, right: 0, top: 0, height: 1 },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: amNav.miniBarHeight,
  },
  bar: {
    flex: 1,
    // the hairline grows from the left edge
    transformOrigin: "left",
  },
})
