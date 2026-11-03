import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Dimensions, Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler"
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
import { X } from "lucide-react-native"

import { PressScale } from "@/components/today/motion"
import { amSpring } from "@/constants/tokens/amMotion"
import { amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amType, amFonts } from "@/constants/tokens/amTypography"
import type { AmTheme } from "@/constants/tokens/amColors"
import { backdropOpacity, settleSheet, sheetOffset } from "@/lib/sheetPhysics"

type Props = {
  visible: boolean
  onClose: () => void
  title: string
  theme: AmTheme
  children: ReactNode
}

/**
 * Bottom sheet (radius 40) driven by springs, not transitions.
 * - The drag follows the finger one to one from wherever it was grabbed, so a
 *   sheet caught mid-animation continues from its live position.
 * - Past fully open it rubber-bands. On release the finger's velocity goes into
 *   the spring and the landing point is the projected momentum.
 * - Only transform and opacity move. With Reduce Motion the sheet cross-fades.
 */
export function SpringSheet({ visible, onClose, title, theme, children }: Props) {
  const insets = useSafeAreaInsets()
  const reduce = useReducedMotion()
  const screenHeight = Dimensions.get("window").height
  const [mounted, setMounted] = useState(visible)
  const height = useSharedValue(screenHeight * 0.6)
  const translateY = useSharedValue(screenHeight)
  const fade = useSharedValue(0)
  const grabOrigin = useSharedValue(0)

  const finish = useCallback(() => {
    setMounted(false)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (visible) {
      setMounted(true)
      if (reduce) {
        translateY.value = 0
        fade.value = withTiming(1, { duration: 200 })
      } else {
        translateY.value = screenHeight
        translateY.value = withSpring(0, amSpring.default)
      }
    }
  }, [visible, reduce, screenHeight, translateY, fade])

  const dismiss = useCallback(() => {
    if (reduce) {
      fade.value = withTiming(0, { duration: 150 }, (done) => {
        if (done) runOnJS(finish)()
      })
      return
    }
    cancelAnimation(translateY)
    translateY.value = withSpring(height.value, amSpring.default, (done) => {
      if (done) runOnJS(finish)()
    })
  }, [reduce, fade, translateY, height, finish])

  const pan = Gesture.Pan()
    .enabled(!reduce)
    .onBegin(() => {
      cancelAnimation(translateY)
      grabOrigin.value = translateY.value
    })
    .onUpdate((event) => {
      translateY.value = sheetOffset(grabOrigin.value + event.translationY, height.value)
    })
    .onEnd((event) => {
      const settle = settleSheet({
        translation: translateY.value,
        velocity: event.velocityY,
        height: height.value,
      })
      const config = {
        ...(Math.abs(event.velocityY) > 800 && !settle.dismiss ? amSpring.fling : amSpring.default),
        velocity: event.velocityY,
      }
      translateY.value = withSpring(settle.target, config, (done) => {
        if (done && settle.dismiss) runOnJS(finish)()
      })
    })

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: reduce ? fade.value : 1,
    transform: [{ translateY: translateY.value }],
  }))
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: reduce ? fade.value * 0.4 : backdropOpacity(translateY.value, height.value),
  }))

  const onLayout = (event: LayoutChangeEvent) => {
    height.value = event.nativeEvent.layout.height
  }

  if (!mounted) return null

  return (
    <Modal transparent visible animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[styles.backdrop, { backgroundColor: theme.textHeading }, backdropStyle]} />
        <Pressable
          style={styles.fill}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <Animated.View
          onLayout={onLayout}
          style={[
            styles.sheet,
            { backgroundColor: theme.page, paddingBottom: Math.max(insets.bottom, 16) },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={styles.header}>
              <View style={[styles.grabber, { backgroundColor: theme.line }]} />
              <View style={styles.titleRow}>
                <Text style={[amType.heading, { color: theme.textHeading, fontFamily: amFonts.bold }]}>
                  {title}
                </Text>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={dismiss}
                  pressedScale={0.92}
                  style={[styles.close, { backgroundColor: theme.card, borderColor: theme.line }]}
                >
                  <X size={20} color={theme.textHeading} />
                </PressScale>
              </View>
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "78%",
    borderTopLeftRadius: amRadius.sheet,
    borderTopRightRadius: amRadius.sheet,
    paddingHorizontal: 10,
  },
  header: { paddingTop: 8, paddingHorizontal: 10 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 8 },
  titleRow: {
    minHeight: amTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  close: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amTouchTarget / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
})
