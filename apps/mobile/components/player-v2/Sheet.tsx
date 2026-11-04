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

import { coverSheet } from "@/components/nav-v2/sheetCover"
import { PressScale } from "@/components/today/motion"
import { playerColors, queueColors } from "@/components/player-v2/playerTokens"
import { ringColor } from "@/components/player-v2/Rows"
import { amColors, amDarkSurface, type AmTheme } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { rubberBandClamp, settleSnap } from "@/lib/playerV2/gesture"

type Props = {
  visible: boolean
  onClose: () => void
  /** The small caps line on the left of the header (prototype .sh-title .over). */
  title: string
  theme: AmTheme
  /** Forest ground with white text (the queue). */
  dark?: boolean
  /** Fill the available height (lists that scroll by themselves) instead of fitting the content. */
  fill?: boolean
  children: ReactNode
}

const REDUCED_FADE_MS = 150
const RUBBER_LIMIT = 64
const FLING_SPEED = 800
/** .sheet max-height */
const MAX_HEIGHT = 780
/** .sheet padding-bottom */
const BOTTOM_PAD = 32
/** Strip of the screen that stays visible above a tall sheet. */
const PEEK = 64

/**
 * Bottom sheet (prototype .sheet): 40px top radius, a 44px grab area with a
 * 44x5 handle, a header with the small caps title and a Done button, then the
 * content. Spring physics: the handle and header drag it down 1:1 from the grab
 * point, it resists past the top, and it lands on the snap point the momentum
 * projects to. Grabbing it mid-flight continues from its live position. With
 * Reduce Motion it cross-fades.
 */
export function Sheet({ visible, onClose, title, theme, dark, fill, children }: Props) {
  const reduce = useReducedMotion()
  const { height: windowHeight } = useWindowDimensions()
  const maxHeight = Math.min(MAX_HEIGHT, windowHeight - PEEK)
  const y = useSharedValue(windowHeight)
  const startY = useSharedValue(0)
  const measured = useSharedValue(0)
  const [mounted, setMounted] = useState(visible)
  const [ready, setReady] = useState(false)

  // While mounted the sheet covers the tab pill and the mini player.
  useEffect(() => (mounted ? coverSheet() : undefined), [mounted])

  const unmount = useCallback(() => {
    setMounted(false)
    setReady(false)
  }, [])

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
      if (!mounted) y.value = windowHeight
      setMounted(true)
    } else if (mounted) {
      animateTo(measured.value + 48, 0, unmount)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  // Slide in once the content height is known.
  useEffect(() => {
    if (visible && ready) animateTo(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ready])

  const drag = Gesture.Pan()
    .onBegin(() => {
      cancelAnimation(y)
      startY.value = y.value
    })
    .onUpdate((event) => {
      y.value = rubberBandClamp(startY.value + event.translationY, 0, measured.value + 48, RUBBER_LIMIT)
    })
    .onEnd((event) => {
      const hidden = measured.value + 48
      const target = settleSnap(y.value, event.velocityY, [0, hidden])
      const config = Math.abs(event.velocityY) > FLING_SPEED ? amSpring.fling : amSpring.default
      y.value = withSpring(target, { ...config, velocity: event.velocityY }, (done) => {
        if (done && target > 0) {
          runOnJS(onClose)()
          runOnJS(unmount)()
        }
      })
    })

  const sheetStyle = useAnimatedStyle(() => {
    const span = Math.max(1, measured.value + 48)
    const open = 1 - Math.min(1, Math.max(0, y.value / span))
    return reduce
      ? { opacity: open, transform: [{ translateY: 0 }] }
      : { opacity: 1, transform: [{ translateY: Math.max(-RUBBER_LIMIT, y.value) }] }
  })
  const scrimStyle = useAnimatedStyle(() => {
    const span = Math.max(1, measured.value + 48)
    return { opacity: 1 - Math.min(1, Math.max(0, y.value / span)) }
  })

  if (!mounted) return null

  const ground = dark ? amDarkSurface.card : theme.page
  const ink = dark ? amColors.white : theme.textHeading
  const over = dark ? amColors.gold300 : theme.eyebrow
  const handle = dark ? queueColors.grab : ringColor(theme)

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
        onLayout={(e) => {
          measured.value = e.nativeEvent.layout.height
          if (!ready && e.nativeEvent.layout.height > 0) setReady(true)
        }}
        style={[
          styles.sheet,
          { backgroundColor: ground, maxHeight },
          fill && { height: maxHeight },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={drag}>
          <View>
            <View style={styles.grab}>
              <View style={[styles.handle, { backgroundColor: handle }]} />
            </View>
            <View style={styles.header}>
              <Text style={[styles.over, { color: over }]} accessibilityRole="header" numberOfLines={1}>
                {title}
              </Text>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Done"
                onPress={onClose}
                pressedScale={0.96}
                style={styles.done}
              >
                <Text style={[styles.doneText, { color: ink }]}>Done</Text>
              </PressScale>
            </View>
          </View>
        </GestureDetector>
        {fill ? (
          <View style={styles.bodyFill}>{children}</View>
        ) : (
          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false} bounces={false}>
            {children}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: playerColors.scrim },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingBottom: BOTTOM_PAD,
    overflow: "hidden",
  },
  grab: { height: 44, alignItems: "center", justifyContent: "center" },
  handle: { width: 44, height: 5, borderRadius: 9999 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 20, paddingRight: 10, paddingBottom: 12 },
  over: { ...amType.label, flexShrink: 1 },
  done: { height: 44, paddingHorizontal: 16, justifyContent: "center" },
  doneText: { fontFamily: amFonts.semi, fontSize: 15 },
  bodyFill: { flex: 1, minHeight: 0 },
  bodyScroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
})
