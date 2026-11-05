import { useCallback, useRef, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated"

import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { RAIL } from "@/lib/songsV2/rail"
import type { RailTick } from "@/lib/songsV2/layout"
import { useT } from "@/lib/i18n"
import { MAX_FONT_SCALE } from "@/constants/fontScale"

/** Touch area is wider than the 12px drawn rail so a thumb can find it. */
const TOUCH = 30

/**
 * Prototype `.rail`: a 12px frosted capsule on the right edge. One tick per letter (or category),
 * five dots when the order has no groups, an orange thumb that follows the list and a dark bubble
 * left of the finger naming where it lands. It fades in while the list scrolls and 1.1s after,
 * and only takes touches while it is visible.
 *
 * The parent owns the list: `onScrub` gets the finger position (0 to 1) and returns the bubble text.
 */
export function FastScrollRail({
  theme,
  top,
  ticks,
  visible,
  interactive,
  scrollFraction,
  held,
  onScrub,
  onHold,
}: {
  theme: SongsTheme
  /** distance from the top of the screen (status inset + 136) */
  top: number
  ticks: readonly RailTick[]
  /** 0 to 1, driven by scrolling */
  visible: SharedValue<number>
  /** false while the rail is hidden: it must not eat touches meant for the rows */
  interactive: boolean
  /** list position as 0 to 1, drives the thumb while the finger is up */
  scrollFraction: SharedValue<number>
  /** 1 while a finger is on the rail; the parent reads it to keep the rail shown */
  held: SharedValue<number>
  onScrub: (fraction: number) => string
  onHold: (held: boolean) => void
}) {
  const t = useT()
  const height = useSharedValue(0)
  const fingerY = useSharedValue(0)
  const [label, setLabel] = useState("")
  const lastIndex = useRef("")

  const scrub = useCallback(
    (y: number, h: number) => {
      const f = h > 0 ? Math.min(1, Math.max(0, y / h)) : 0
      fingerY.value = f * h
      const next = onScrub(f)
      if (next !== lastIndex.current) {
        lastIndex.current = next
        setLabel(next)
      }
    },
    [fingerY, onScrub],
  )

  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(interactive)
    .minDistance(0)
    .onBegin((event) => {
      held.value = 1
      onHold(true)
      scrub(event.y, height.value)
    })
    .onUpdate((event) => scrub(event.y, height.value))
    .onFinalize(() => {
      held.value = 0
      lastIndex.current = ""
      onHold(false)
    })

  const wrap = useAnimatedStyle(() => ({
    opacity: Math.max(visible.value, held.value),
    transform: [{ translateX: (1 - Math.max(visible.value, held.value)) * 10 }],
  }))

  const thumb = useAnimatedStyle(() => {
    const room = Math.max(0, height.value - RAIL.thumbHeight)
    const y = held.value ? Math.min(room, Math.max(0, fingerY.value - RAIL.thumbHeight / 2)) : scrollFraction.value * room
    return { transform: [{ translateY: y }] }
  })

  const bubble = useAnimatedStyle(() => {
    const y = Math.min(Math.max(0, height.value - RAIL.bubbleSize), Math.max(0, fingerY.value - RAIL.bubbleSize / 2))
    return { opacity: held.value, transform: [{ translateY: y }, { scale: 0.92 + 0.08 * held.value }] }
  })

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.touch, { top }, wrap]}
        pointerEvents={interactive ? "auto" : "none"}
        accessibilityRole="adjustable"
        accessibilityLabel={t("songs.fastScroll")}
        onLayout={(event) => {
          height.value = event.nativeEvent.layout.height
        }}
      >
        <View pointerEvents="none" style={styles.rail}>
          <View style={[styles.bg, { backgroundColor: theme.dark ? "rgba(42,58,34,0.55)" : "rgba(255,255,255,0.55)" }]} />
          {ticks.map((tick, index) =>
            tick.dot ? (
              <View key={`d${index}`} style={[styles.dot, { top: `${tick.y}%`, backgroundColor: theme.ink300 }]} />
            ) : (
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} key={`${tick.label}${index}`} numberOfLines={1} style={[styles.tick, { top: `${tick.y}%`, color: theme.textBody }]}>
                {tick.label}
              </Text>
            ),
          )}
          <Animated.View style={[styles.thumb, { backgroundColor: theme.brand }, thumb]} />
        </View>
        <Animated.View pointerEvents="none" style={[styles.bubble, { backgroundColor: theme.ink900 }, bubble]}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.bubbleText, { color: theme.onInk }]} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  touch: { position: "absolute", right: RAIL.right, bottom: RAIL.bottomInset, width: TOUCH, zIndex: 12 },
  rail: { position: "absolute", right: 0, top: 0, bottom: 0, width: RAIL.width },
  bg: { ...StyleSheet.absoluteFillObject, borderRadius: 70 },
  tick: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: amFonts.bold,
    fontSize: 8,
    lineHeight: 10,
    marginTop: -5,
  },
  dot: { position: "absolute", left: 4, width: 3, height: 3, borderRadius: 2, marginTop: -2 },
  thumb: { position: "absolute", left: 3, right: 3, top: 0, height: RAIL.thumbHeight, borderRadius: 70 },
  bubble: {
    position: "absolute",
    right: 22,
    top: 0,
    minWidth: 64,
    height: RAIL.bubbleSize,
    paddingHorizontal: 20,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    transformOrigin: "100% 50%",
  },
  bubbleText: { fontFamily: amFonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.26 },
})
