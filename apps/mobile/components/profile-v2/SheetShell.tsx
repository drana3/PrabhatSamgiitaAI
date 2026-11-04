import { useCallback, useEffect, useRef, type ComponentType, type ReactNode, type Ref } from "react"
import { Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from "react-native"
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

import { amProto, type AmProto } from "@/constants/tokens/amToday"
import { amSpring } from "@/constants/tokens/amMotion"
import { scrimOpacity, settleSheet, sheetPositionDuringDrag } from "@/lib/sheetPhysics"

const REDUCED_FADE_MS = 180
/** `.scrim{background:rgba(30,30,30,0.45)}`: the colour is solid, opacity follows the sheet. */
const SCRIM = "#1E1E1E"

type Props = {
  p: AmProto
  /** accessibility name of the dialog */
  label: string
  /** called once the sheet has left the screen */
  onClosed: () => void
  /** drawn over the sheet content, inside the sheet (confirmation card) */
  overlay?: ReactNode
  children: ReactNode
}

/**
 * The bottom sheet of the prototype (`.sheetroot` > `.scrim` + `.sheet`): 40dp top corners, a 44dp grab
 * strip, content-sized up to 780dp (and never taller than the screen minus the status area).
 *
 * - Drag is 1:1 from the grab point. A running animation is cancelled and the drag continues from the
 *   current on-screen value, so a sheet caught mid-flight never jumps.
 * - On release the landing point is the momentum projection of the finger velocity, and that velocity is
 *   handed to the spring. Pulling up past open meets a rubber band.
 * - Only transform and opacity change. With reduced motion the slide becomes a cross-fade.
 * - When the content is taller than the sheet it scrolls; the sheet only drags down when the list is at its top.
 */
export function SheetShell({ p, label, onClosed, overlay, children }: Props) {
  const { height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const top = insets.top || amProto.statusArea
  const maxHeight = Math.min(amProto.sheetMaxHeight, windowHeight - top - 12)
  const reduce = useReducedMotion()

  const heightSV = useSharedValue(windowHeight)
  const y = useSharedValue(windowHeight)
  const fade = useSharedValue(reduce ? 0 : 1)
  const startY = useSharedValue(0)
  const engaged = useSharedValue(false)
  const scrollY = useSharedValue(0)
  const opened = useRef(false)

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const measured = event.nativeEvent.layout.height
      if (measured <= 0) return
      heightSV.value = measured
      if (opened.current) return
      opened.current = true
      if (reduce) {
        y.value = 0
        fade.value = withTiming(1, { duration: REDUCED_FADE_MS })
      } else {
        y.value = withSpring(0, amSpring.default)
      }
    },
    [fade, heightSV, reduce, y],
  )

  useEffect(() => {
    // a new window height (rotation) must not leave a hidden sheet half visible
    if (!opened.current) y.value = windowHeight
  }, [windowHeight, y])

  const dismiss = useCallback(
    (velocity = 0) => {
      if (reduce) {
        fade.value = withTiming(0, { duration: REDUCED_FADE_MS }, (finished) => {
          if (finished) runOnJS(onClosed)()
        })
        return
      }
      cancelAnimation(y)
      y.value = withSpring(heightSV.value, { ...amSpring.default, velocity }, (finished) => {
        if (finished) runOnJS(onClosed)()
      })
    },
    [fade, heightSV, onClosed, reduce, y],
  )

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

  const sheetStyle = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateY: y.value }] }))
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity(y.value, heightSV.value) * fade.value }))

  const surface = p.sand200

  return (
    <View style={s.root} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }, scrimStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={() => dismiss(0)} />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={label}
          onLayout={onLayout}
          style={[s.sheet, { backgroundColor: surface, maxHeight }, sheetStyle]}
        >
          <View style={s.grab}>
            <View style={[s.grabBar, { backgroundColor: p.ink300 }]} />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            ref={scrollRef as unknown as Ref<ScrollView>}
            bounces={false}
            overScrollMode="never"
            style={s.scroll}
            keyboardShouldPersistTaps="handled"
            onScroll={(event) => {
              scrollY.value = event.nativeEvent.contentOffset.y
            }}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingBottom: 32 + (insets.bottom > 0 ? insets.bottom - 8 : 0) }}
          >
            {children}
          </ScrollView>
          {overlay}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: "hidden" },
  grab: { height: 44, alignItems: "center", justifyContent: "center" },
  grabBar: { width: 44, height: 5, borderRadius: 3 },
  scroll: { flexGrow: 0, flexShrink: 1 },
})
