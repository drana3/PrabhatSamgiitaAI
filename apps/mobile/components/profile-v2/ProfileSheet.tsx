import { useCallback, useEffect, useRef, type ComponentType, type ReactNode, type Ref } from "react"
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler"
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
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import { amGap, amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amType } from "@/constants/tokens/amTypography"
import { scrimOpacity, settleSheet, sheetHeight, sheetPositionDuringDrag } from "@/lib/sheetPhysics"

const REDUCED_FADE_MS = 180

type Props = {
  theme: AmTheme
  /** called once the sheet has left the screen */
  onClosed: () => void
  /** drawn over the sheet content, inside the sheet (confirmation card) */
  overlay?: ReactNode
  children: ReactNode
}

/**
 * Bottom sheet that follows the finger.
 *
 * - Drag is 1:1 from the grab point (position = where the sheet was when the
 *   drag began + finger travel). A running animation is cancelled and the drag
 *   continues from the current on-screen value, so a sheet caught mid-flight
 *   never jumps.
 * - On release the landing point is the momentum projection of the finger
 *   velocity, and that velocity is handed to the spring.
 * - Pulling up past open meets a rubber band.
 * - Only transform and opacity change. With reduced motion the slide is
 *   replaced by a cross-fade (dragging still works: that is the user's hand).
 * - The scroll view and the sheet pan work together: the sheet only drags
 *   when the list is at its top.
 */
export function ProfileSheet({ theme, onClosed, overlay, children }: Props) {
  const { height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const height = sheetHeight(windowHeight, insets.top)
  const reduce = useReducedMotion()

  const heightSV = useSharedValue(height)
  const y = useSharedValue(height)
  const fade = useSharedValue(reduce ? 0 : 1)
  const startY = useSharedValue(0)
  const engaged = useSharedValue(false)
  const scrollY = useSharedValue(0)

  useEffect(() => {
    heightSV.value = height
  }, [height, heightSV])

  useEffect(() => {
    if (reduce) {
      y.value = 0
      fade.value = withTiming(1, { duration: REDUCED_FADE_MS })
    } else {
      y.value = withSpring(0, amSpring.default)
    }
  }, [reduce, y, fade])

  const dismiss = useCallback(
    (velocity = 0) => {
      if (reduce) {
        fade.value = withTiming(0, { duration: REDUCED_FADE_MS }, (finished) => {
          if (finished) runOnJS(onClosed)()
        })
        return
      }
      y.value = withSpring(height, { ...amSpring.default, velocity }, (finished) => {
        if (finished) runOnJS(onClosed)()
      })
    },
    [fade, height, onClosed, reduce, y],
  )

  // the gesture handler takes the list's ref to let the sheet pan and the list scroll together
  const scrollRef = useRef<ComponentType | undefined>(undefined)

  const pan = Gesture.Pan()
    // activates on a downward move of 10dp; an upward move hands the touch to the list
    .activeOffsetY([-1_000_000, 10])
    .failOffsetY([-10, 1_000_000])
    .onStart(() => {
      cancelAnimation(y)
      startY.value = y.value
      engaged.value = scrollY.value <= 1
    })
    .onUpdate((event) => {
      if (!engaged.value) return
      y.value = sheetPositionDuringDrag(startY.value, event.translationY, heightSV.value)
    })
    .onEnd((event) => {
      if (!engaged.value) return
      const settle = settleSheet({ y: y.value, velocity: event.velocityY, height: heightSV.value })
      const spring = settle.spring === "fling" ? amSpring.fling : amSpring.default
      if (reduce) {
        if (settle.dismiss) {
          fade.value = withTiming(0, { duration: REDUCED_FADE_MS }, (finished) => {
            if (finished) runOnJS(onClosed)()
          })
        } else {
          y.value = withTiming(0, { duration: REDUCED_FADE_MS })
        }
        return
      }
      y.value = withSpring(
        settle.target,
        { mass: spring.mass, stiffness: spring.stiffness, damping: spring.damping, velocity: event.velocityY },
        (finished) => {
          if (settle.dismiss && finished) runOnJS(onClosed)()
        },
      )
    })
    .simultaneousWithExternalGesture(scrollRef)

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: y.value }],
  }))
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity(y.value, heightSV.value) * fade.value,
  }))

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close profile"
          style={StyleSheet.absoluteFill}
          onPress={() => dismiss(0)}
        />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { height, backgroundColor: theme.page, borderColor: theme.line },
            sheetStyle,
          ]}
        >
          <View style={styles.grabArea}>
            <View style={[styles.grabber, { backgroundColor: theme.textMuted }]} />
          </View>
          <View style={styles.header}>
            <Text style={[amType.title, { color: theme.textHeading }]} accessibilityRole="header">
              Profile
            </Text>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => dismiss(0)}
              style={[styles.close, { backgroundColor: theme.card, borderColor: theme.line }]}
            >
              <X size={20} color={theme.textHeading} />
            </PressScale>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            ref={scrollRef as unknown as Ref<ScrollView>}
            bounces={false}
            overScrollMode="never"
            onScroll={(event) => {
              scrollY.value = event.nativeEvent.contentOffset.y
            }}
            scrollEventThrottle={16}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + amGap.padPanel },
            ]}
          >
            {children}
          </ScrollView>
          {overlay}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { backgroundColor: amColors.ink900 },
  sheet: {
    borderTopLeftRadius: amRadius.sheet,
    borderTopRightRadius: amRadius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  grabArea: { height: 24, alignItems: "center", justifyContent: "center" },
  grabber: { width: 40, height: 5, borderRadius: 3, opacity: 0.5 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: amGap.padCard,
    paddingBottom: amGap.text,
  },
  close: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: amGap.gutter,
    gap: amGap.block,
  },
})
