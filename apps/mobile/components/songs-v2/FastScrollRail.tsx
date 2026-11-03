import { useEffect, useMemo, useRef, useState } from "react"
import { PanResponder, StyleSheet, Text, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated"

import { amSpring } from "@/constants/tokens/amMotion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amSpace } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"
import { RAIL, railFraction, railLabelAt, railRowIndex, rowFraction } from "@/lib/songsV2/rail"
import type { ListRow } from "@/lib/songsV2/sort"

const THUMB = 36

/**
 * 22px frosted rail on the right edge (spec SCR-30). Touch down anywhere on it
 * or drag: the list jumps 1:1 to the matching row and a bubble to the left of
 * the finger names the letter, category, PS number or length. Release hides
 * the bubble. While the list scrolls by itself the thumb follows it.
 * Hidden when there are too few rows to need it (parent decides).
 */
export function FastScrollRail({
  theme,
  rows,
  /** index of the first visible row, reported by the list */
  visibleIndex,
  onJump,
}: {
  theme: AmTheme
  rows: readonly ListRow[]
  visibleIndex: number
  onJump: (index: number) => void
}) {
  const reduce = useReducedMotion()
  const [height, setHeight] = useState(0)
  const [bubble, setBubble] = useState<{ label: string; y: number } | null>(null)
  const thumbY = useSharedValue(0)
  const dragging = useRef(false)
  const last = useRef(-1)
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const heightRef = useRef(0)
  heightRef.current = height

  const jumpTo = (y: number) => {
    const h = heightRef.current
    const f = railFraction(y, h)
    const index = railRowIndex(f, rowsRef.current.length)
    thumbY.value = f * Math.max(0, h - THUMB)
    setBubble({ label: railLabelAt(rowsRef.current, index), y: f * h })
    if (index !== last.current) {
      last.current = index
      onJump(index)
    }
  }

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          dragging.current = true
          jumpTo(event.nativeEvent.locationY)
        },
        onPanResponderMove: (event) => jumpTo(event.nativeEvent.locationY),
        onPanResponderRelease: () => {
          dragging.current = false
          last.current = -1
          setBubble(null)
        },
        onPanResponderTerminate: () => {
          dragging.current = false
          last.current = -1
          setBubble(null)
        },
      }),
    // jumpTo reads refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // The list scrolled by itself: the thumb follows with a spring.
  const followTarget = rowFraction(visibleIndex, rows.length) * Math.max(0, height - THUMB)
  useEffect(() => {
    if (dragging.current) return
    thumbY.value = reduce ? followTarget : withSpring(followTarget, amSpring.default)
  }, [followTarget, reduce, thumbY])

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateY: thumbY.value }] }))

  return (
    <View
      style={[styles.rail, { top: RAIL.topInset, bottom: RAIL.bottomInset }]}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      accessibilityLabel="Fast scroll"
      accessibilityRole="adjustable"
      {...responder.panHandlers}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.track, { backgroundColor: theme.glass, borderColor: theme.glassEdge }]} />
      <Animated.View pointerEvents="none" style={[styles.thumb, { backgroundColor: theme.brand }, thumbStyle]} />
      {bubble ? (
        <View pointerEvents="none" style={[styles.bubble, { top: Math.min(Math.max(0, bubble.y - RAIL.bubbleSize / 2), Math.max(0, height - RAIL.bubbleSize)) }]}>
          <Text style={styles.bubbleText} numberOfLines={1} adjustsFontSizeToFit>
            {bubble.label}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  rail: { position: "absolute", right: 0, width: RAIL.width, zIndex: 5 },
  track: { borderRadius: RAIL.width / 2, borderWidth: 1 },
  thumb: { position: "absolute", left: amSpace.s1, width: RAIL.width - amSpace.s2, height: THUMB, borderRadius: (RAIL.width - amSpace.s2) / 2 },
  bubble: {
    position: "absolute",
    right: RAIL.width + amSpace.s6,
    minWidth: RAIL.bubbleSize,
    height: RAIL.bubbleSize,
    paddingHorizontal: amSpace.s3,
    borderRadius: RAIL.bubbleSize / 2,
    backgroundColor: amColors.ink800,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleText: { fontFamily: amFonts.bold, fontSize: 19, color: amColors.white },
})
