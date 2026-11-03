import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { amRadius, amSpace } from "@/constants/tokens/amSpacing"
import { amSpring } from "@/constants/tokens/amMotion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amType } from "@/constants/tokens/amTypography"
import { rubberBandClamp, settleSnap } from "@/lib/playerV2/gesture"

type Props = {
  visible: boolean
  onClose: () => void
  title: string
  theme: AmTheme
  /** Share of the window height, 0..1. */
  heightShare?: number
  children: ReactNode
}

const REDUCED_FADE_MS = 150
const RUBBER_LIMIT = 64
const FLING_SPEED = 800

/**
 * Bottom sheet with spring physics (spec SCR-12, SCR-18). Drag the handle or
 * the title down to dismiss: it follows the finger 1:1, resists past the top,
 * and lands on the snap point the momentum projects to. Grabbing it mid-flight
 * continues from its live position. With Reduce Motion it cross-fades.
 */
export function Sheet({ visible, onClose, title, theme, heightShare = 0.7, children }: Props) {
  const reduce = useReducedMotion()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const sheetHeight = Math.round(windowHeight * heightShare)
  const y = useSharedValue(sheetHeight)
  const startY = useSharedValue(0)
  const [mounted, setMounted] = useState(visible)

  const unmount = useCallback(() => setMounted(false), [])

  const animateTo = useCallback(
    (target: number, velocity = 0, after?: () => void) => {
      if (reduce) {
        y.value = withTiming(target, { duration: REDUCED_FADE_MS }, (done) => {
          if (done && after) runOnJS(after)()
        })
        return
      }
      const config = Math.abs(velocity) > FLING_SPEED ? amSpring.fling : amSpring.default
      y.value = withSpring(target, { ...config, velocity }, (done) => {
        if (done && after) runOnJS(after)()
      })
    },
    [reduce, y],
  )

  useEffect(() => {
    if (visible) {
      setMounted(true)
      animateTo(0)
    } else if (mounted) {
      animateTo(sheetHeight, 0, unmount)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const drag = Gesture.Pan()
    .onBegin(() => {
      cancelAnimation(y)
      startY.value = y.value
    })
    .onUpdate((event) => {
      y.value = rubberBandClamp(startY.value + event.translationY, 0, sheetHeight, RUBBER_LIMIT)
    })
    .onEnd((event) => {
      const target = settleSnap(y.value, event.velocityY, [0, sheetHeight])
      const config = Math.abs(event.velocityY) > FLING_SPEED ? amSpring.fling : amSpring.default
      y.value = withSpring(target, { ...config, velocity: event.velocityY }, (done) => {
        if (done && target > 0) {
          runOnJS(onClose)()
          runOnJS(unmount)()
        }
      })
    })

  const sheetStyle = useAnimatedStyle(() => {
    const open = 1 - Math.min(1, Math.max(0, y.value / sheetHeight))
    return reduce
      ? { opacity: open, transform: [{ translateY: 0 }] }
      : { opacity: 1, transform: [{ translateY: Math.max(-RUBBER_LIMIT, y.value) }] }
  })
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, Math.max(0, y.value / sheetHeight)),
  }))

  if (!mounted) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
          onPressIn={onClose}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          { height: sheetHeight, backgroundColor: theme.card, paddingBottom: insets.bottom + amSpace.s4 },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={drag}>
          <View style={styles.grab}>
            <View style={[styles.handle, { backgroundColor: amColors.sand400 }]} />
            <Text style={[amType.label, { color: theme.eyebrow }]} accessibilityRole="header">
              {title}
            </Text>
          </View>
        </GestureDetector>
        <View style={styles.body}>{children}</View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: "rgba(0, 0, 0, 0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: amRadius.sheet,
    borderTopRightRadius: amRadius.sheet,
    overflow: "hidden",
  },
  grab: {
    alignItems: "center",
    gap: amSpace.s3,
    paddingTop: amSpace.s3,
    paddingBottom: amSpace.s4,
    minHeight: 44,
  },
  handle: { width: 40, height: 4, borderRadius: 2 },
  body: { flex: 1, paddingHorizontal: amSpace.s4 },
})
