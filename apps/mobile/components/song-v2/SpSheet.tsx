import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native"
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

import type { SpTheme } from "@/constants/tokens/amSong"
import { amSpring } from "@/constants/tokens/amMotion"
import { sheetPosition, sheetSettle } from "@/lib/songPage/sheetPhysics"

const RUBBER_LIMIT = 96
const REDUCED_MS = 150
const MAX_HEIGHT = 780

/**
 * `.sheetroot` + `.scrim` + `.sheet` + `.grab`: a sand sheet with 40px top corners, a 44x5 grab handle in a
 * 44px zone, a scrim of rgba(30,30,30,.45). The handle follows the finger 1:1 from the grab point,
 * the release lands by momentum projection with the finger's velocity handed to the spring, pulling it up
 * meets a rubber band. Enter, exit and drag are one value, so every move is interruptible from the
 * on-screen position. Only transform and opacity move.
 */
export function SpSheet({
  t,
  visible,
  onClose,
  label,
  children,
  testID,
}: {
  t: SpTheme
  visible: boolean
  onClose: () => void
  label: string
  children: ReactNode
  testID?: string
}) {
  const { height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reduce = useReducedMotion()
  const [mounted, setMounted] = useState(visible)
  const heightValue = useSharedValue(windowHeight)
  const translateY = useSharedValue(windowHeight)
  const start = useSharedValue(0)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const maxHeight = Math.min(MAX_HEIGHT, windowHeight - 40)

  const unmount = useCallback(() => setMounted(false), [])

  useEffect(() => {
    if (visible) {
      setMounted(true)
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

  const onSheetLayout = (event: LayoutChangeEvent) => {
    heightValue.value = event.nativeEvent.layout.height
  }

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
    <View style={styles.root} pointerEvents="box-none" accessibilityViewIsModal testID={testID}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }, scrimStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={`Close ${label}`}
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        onLayout={onSheetLayout}
        accessibilityLabel={label}
        style={[
          styles.sheet,
          { maxHeight, backgroundColor: t.sand200, paddingBottom: Math.max(32, insets.bottom) },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.grab} accessible accessibilityRole="header" accessibilityLabel={`${label}, drag down to close`}>
            <View style={[styles.handle, { backgroundColor: t.ink300 }]} />
          </View>
        </GestureDetector>
        <ScrollView
          style={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 50 },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: "hidden",
  },
  grab: { height: 44, alignItems: "center", justifyContent: "center" },
  handle: { width: 44, height: 5, borderRadius: 9999 },
  body: { flexGrow: 0, flexShrink: 1 },
})
