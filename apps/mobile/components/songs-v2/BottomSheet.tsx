import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
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

import { PressScale } from "@/components/today/motion"
import { amSpring } from "@/constants/tokens/amMotion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amType } from "@/constants/tokens/amTypography"
import { resolveRelease, scrimOpacity, sheetOffsetForDrag } from "@/lib/songsV2/sheetPhysics"

type Props = {
  open: boolean
  /** Called after the sheet has left the screen (drag, scrim tap, Done). */
  onClose: () => void
  theme: AmTheme
  eyebrow?: string
  accessibilityLabel: string
  doneLabel?: string
  /** Share of the window the sheet may fill. */
  maxHeightRatio?: number
  children: ReactNode
}

const FADE_MS = 150

/**
 * White sheet, radius 40 (spec section 1). The finger drags it 1:1 from the
 * grab area; on release it lands where momentum projection says, with the
 * finger's velocity handed to a no-overshoot spring. Pulling up past open is
 * rubber-banded. A catch mid-spring starts from the on-screen value, so every
 * transition can be interrupted. Only transform and opacity animate.
 * With reduced motion the slide becomes a cross-fade.
 */
export function BottomSheet({
  open,
  onClose,
  theme,
  eyebrow,
  accessibilityLabel,
  doneLabel = "Done",
  maxHeightRatio = 0.86,
  children,
}: Props) {
  const reduce = useReducedMotion()
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const [mounted, setMounted] = useState(open)
  const offset = useSharedValue(window.height)
  const sheetHeight = useSharedValue(window.height)
  const fade = useSharedValue(0)
  const start = useSharedValue(0)

  const finishClose = useCallback(() => {
    setMounted(false)
    onClose()
  }, [onClose])

  const animateTo = useCallback(
    (target: number, velocity: number, closing: boolean) => {
      if (reduce) {
        cancelAnimation(offset)
        offset.value = target
        fade.value = withTiming(closing ? 0 : 1, { duration: FADE_MS }, (done) => {
          if (done && closing) runOnJS(finishClose)()
        })
        return
      }
      fade.value = withTiming(closing ? 0 : 1, { duration: FADE_MS * 2 })
      offset.value = withSpring(target, { ...amSpring.default, velocity }, (done) => {
        if (done && closing) runOnJS(finishClose)()
      })
    },
    [fade, finishClose, offset, reduce],
  )

  // Open and close from the parent travel the same path.
  useEffect(() => {
    if (open) {
      setMounted(true)
      animateTo(0, 0, false)
    } else if (mounted) {
      animateTo(sheetHeight.value, 0, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pan = Gesture.Pan()
    .onBegin(() => {
      cancelAnimation(offset)
      start.value = offset.value
    })
    .onUpdate((event) => {
      offset.value = sheetOffsetForDrag(start.value, event.translationY)
    })
    .onEnd((event) => {
      const release = resolveRelease({
        offset: offset.value,
        velocity: event.velocityY,
        height: sheetHeight.value,
      })
      fade.value = withTiming(release.closes ? 0 : 1, { duration: FADE_MS * 2 })
      offset.value = withSpring(release.target, { ...amSpring.default, velocity: event.velocityY }, (done) => {
        if (done && release.closes) runOnJS(finishClose)()
      })
    })

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: reduce ? fade.value : 1,
    transform: [{ translateY: reduce ? 0 : offset.value }],
  }))
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: reduce ? fade.value * 0.4 : scrimOpacity(offset.value, sheetHeight.value),
  }))

  if (!mounted) return null

  const close = () => animateTo(sheetHeight.value, 0, true)

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${accessibilityLabel}`}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        accessibilityRole="none"
        accessibilityLabel={accessibilityLabel}
        onLayout={(event) => {
          sheetHeight.value = event.nativeEvent.layout.height
        }}
        style={[
          styles.sheet,
          { backgroundColor: theme.card, maxHeight: window.height * maxHeightRatio, paddingBottom: Math.max(insets.bottom, amSpace.s4) },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.grabArea}>
            <View style={[styles.grabber, { backgroundColor: theme.line }]} />
            <View style={styles.titleRow}>
              <Text style={[amType.label, { color: theme.eyebrow, flex: 1 }]} numberOfLines={1}>
                {eyebrow ?? ""}
              </Text>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={doneLabel}
                onPress={close}
                pressedScale={0.94}
                style={styles.done}
              >
                <Text style={[amType.label, { color: theme.textHeading }]}>{doneLabel}</Text>
              </PressScale>
            </View>
          </View>
        </GestureDetector>
        <ScrollView
          bounces
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: amColors.sage900 },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: amRadius.sheet,
    borderTopRightRadius: amRadius.sheet,
    overflow: "hidden",
  },
  grabArea: { paddingTop: amSpace.s2, paddingHorizontal: amGap.padCard },
  grabber: { alignSelf: "center", width: amSpace.s12, height: amSpace.s1, borderRadius: amSpace.s1 / 2 },
  titleRow: { minHeight: amTouchTarget, flexDirection: "row", alignItems: "center", gap: amSpace.s3 },
  done: { minHeight: amTouchTarget, minWidth: amTouchTarget, alignItems: "flex-end", justifyContent: "center" },
  body: { paddingHorizontal: amGap.padCard, paddingBottom: amSpace.s4, gap: amGap.text },
})
