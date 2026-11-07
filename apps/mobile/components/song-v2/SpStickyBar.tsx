import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import { songAccents } from "@/lib/songPage/accent"
import { stickyBarValues, type BarMarks } from "@/lib/songPage/stickyBar"

import { useT } from "@/lib/i18n"
import { SpIcon } from "./SpIcon"
import { SpPress, SpRound } from "./SpUi"

/** Height of the bar below the safe-area top: 44 buttons with 6 above and below. */
export const SP_BAR_CONTENT = 56

/**
 * Collapsing top bar of a page that starts with a big hero (the Spotify playlist page): a round back button on
 * the left, always. As the hero scrolls away the bar's ground fades in (`tint`, the colour of the hero's
 * wash), the title fades in centered, and a round orange Play / Pause button pops in on the right.
 *
 * Everything follows `scrollY` 1:1 on the UI thread (opacity and translateY only; the Play button also has a
 * spring scale when it appears). `marks` says where the hero's parts are, see lib/songPage/stickyBar.
 * Reusable: the song page and the song lists use it.
 */
export function SpStickyBar({
  t,
  title,
  tint,
  scrollY,
  marks,
  topInset,
  onBack,
  onAction,
  showAction = true,
  playing = false,
  highlight = false,
  actionLabel,
}: {
  t: SpTheme
  title: string
  /** Opaque colour of the ground once it is fully in (the hero wash's top colour). */
  tint: string
  scrollY: SharedValue<number>
  marks: SharedValue<BarMarks>
  /** Safe-area top (the status bar band on the web preview). */
  topInset: number
  onBack: () => void
  onAction?: () => void
  /** false: no Play button (nothing to play). */
  showAction?: boolean
  /** The action is Pause now. */
  playing?: boolean
  /** The title is drawn orange: this is the item that plays. */
  highlight?: boolean
  actionLabel?: string
}) {
  const tr = useT()
  const reduce = useReducedMotion()
  const [live, setLive] = useState(false)
  const pop = useSharedValue(0.7)

  const ground = useAnimatedStyle(() => ({ opacity: stickyBarValues(scrollY.value, marks.value).bg }))
  const titleStyle = useAnimatedStyle(() => {
    const v = stickyBarValues(scrollY.value, marks.value)
    return { opacity: v.title, transform: [{ translateY: v.titleShift }] }
  })
  const actionStyle = useAnimatedStyle(() => {
    const v = stickyBarValues(scrollY.value, marks.value)
    return { opacity: v.button, transform: [{ translateY: v.buttonShift }, { scale: pop.value }] }
  })

  // The button takes touches only while it is mostly visible; it pops in with a spring when it appears.
  useAnimatedReaction(
    () => stickyBarValues(scrollY.value, marks.value).button > 0.5,
    (on, was) => {
      if (on === was) return
      runOnJS(setLive)(on)
      pop.value = reduce ? 1 : on ? withSpring(1, amSpring.fling) : withTiming(0.7, { duration: 120 })
    },
  )

  const accent = songAccents(t)
  const height = topInset + SP_BAR_CONTENT

  return (
    <View style={[styles.bar, { height, paddingTop: topInset }]} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint }, ground]} />
      <View style={styles.row} pointerEvents="box-none">
        <SpRound t={t} icon="back" label={tr("common.back")} onPress={onBack} />
        <Animated.View pointerEvents="none" style={[styles.titleWrap, titleStyle]}>
          <Text
            numberOfLines={1}
            accessibilityRole="header"
            style={[styles.title, { color: highlight ? accent.text : t.ink900 }]}
          >
            {title}
          </Text>
        </Animated.View>
        <View style={styles.end} pointerEvents="box-none">
          {showAction ? (
            <Animated.View style={actionStyle} pointerEvents={live ? "auto" : "none"}>
              <SpPress
                onPress={onAction}
                accessibilityLabel={actionLabel ?? (playing ? tr("player.pause") : tr("player.play"))}
                style={[styles.play, { backgroundColor: accent.fill }]}
                pressedScale={0.92}
              >
                <SpIcon name={playing ? "pause" : "play"} size={20} color={accent.onFill} />
              </SpPress>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 40 },
  row: { height: SP_BAR_CONTENT, flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
  titleWrap: { position: "absolute", left: 72, right: 72, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.17, textAlign: "center" },
  end: { flex: 1, alignItems: "flex-end" },
  play: { width: 44, height: 44, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
})
