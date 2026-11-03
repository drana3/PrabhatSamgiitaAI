import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import type { AmTheme } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import { amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amType } from "@/constants/tokens/amTypography"
import { sheetPosition, sheetSettle } from "@/lib/songPage/sheetPhysics"

const RUBBER_LIMIT = amSpace.s24
const REDUCED_MS = 150

type Props = {
  theme: AmTheme
  visible: boolean
  onClose: () => void
  title: string
  /** share of the screen height the sheet fills */
  heightRatio?: number
  children: ReactNode
}

/**
 * Bottom sheet (spec SCR-18, SCR-25). The handle and title follow the finger
 * 1:1 from the grab point, release lands by momentum projection with the
 * finger's velocity handed to the spring, and pulling it above the open
 * position meets a rubber band. Entry, exit and drag share one value, so
 * every move can be interrupted from where the sheet is on screen. Only
 * transform and opacity move; reduced motion turns the slide into a cross-fade.
 */
export function BottomSheet({ theme, visible, onClose, title, heightRatio = 0.82, children }: Props) {
  const { height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reduce = useReducedMotion()
  const height = Math.round(windowHeight * heightRatio)
  const [mounted, setMounted] = useState(visible)
  const translateY = useSharedValue(height)
  const start = useSharedValue(0)
  const heightValue = useSharedValue(height)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    heightValue.value = height
  }, [height, heightValue])

  const unmount = useCallback(() => setMounted(false), [])

  useEffect(() => {
    if (visible) {
      setMounted(true)
      // From wherever the sheet is now, never from a fixed start.
      translateY.value = reduce ? withTiming(0, { duration: REDUCED_MS }) : withSpring(0, amSpring.default)
      return
    }
    cancelAnimation(translateY)
    const done = (finished?: boolean) => {
      "worklet"
      if (finished) runOnJS(unmount)()
    }
    translateY.value = reduce
      ? withTiming(heightValue.value, { duration: REDUCED_MS }, done)
      : withSpring(heightValue.value, amSpring.default, done)
  }, [visible, reduce, translateY, heightValue, unmount])

  useEffect(() => {
    if (!visible) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeRef.current()
      return true
    })
    return () => sub.remove()
  }, [visible])

  const pan = Gesture.Pan()
    .onBegin(() => {
      cancelAnimation(translateY)
      start.value = translateY.value
    })
    .onUpdate((event) => {
      translateY.value = sheetPosition(start.value, event.translationY, RUBBER_LIMIT)
    })
    .onEnd((event) => {
      const { target, fling } = sheetSettle(translateY.value, event.velocityY, heightValue.value)
      const close = target > 0
      const finish = (finished?: boolean) => {
        "worklet"
        if (finished && close) runOnJS(onClose)()
      }
      if (reduce) {
        translateY.value = withTiming(target, { duration: REDUCED_MS }, finish)
        return
      }
      translateY.value = withSpring(
        target,
        { ...(fling ? amSpring.fling : amSpring.default), velocity: event.velocityY },
        finish,
      )
    })

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, heightValue.value], [1, 0], Extrapolation.CLAMP),
  }))
  const sheetStyle = useAnimatedStyle(() =>
    reduce
      ? { opacity: interpolate(translateY.value, [0, heightValue.value], [1, 0], Extrapolation.CLAMP) }
      : { transform: [{ translateY: translateY.value }] },
  )

  if (!mounted) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { height, backgroundColor: theme.page, borderColor: theme.line, paddingBottom: insets.bottom },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.grab} accessible accessibilityRole="header" accessibilityLabel={title}>
            <View style={[styles.handle, { backgroundColor: theme.line }]} />
            <Text style={[amType.heading, { color: theme.textHeading }]}>{title}</Text>
          </View>
        </GestureDetector>
        <View style={styles.body}>{children}</View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: amRadius.sheet,
    borderTopRightRadius: amRadius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  grab: {
    minHeight: amTouchTarget + amSpace.s8,
    paddingHorizontal: amSpace.s6,
    paddingTop: amSpace.s2,
    paddingBottom: amSpace.s3,
    gap: amSpace.s3,
  },
  handle: {
    alignSelf: "center",
    width: amSpace.s12,
    height: amSpace.s1,
    borderRadius: amRadius.full,
  },
  body: { flex: 1 },
})
