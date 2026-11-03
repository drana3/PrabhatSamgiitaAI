import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { PressBox } from "@/components/learn-v2/PressBox"
import { Overline, PillButton } from "@/components/learn-v2/ui"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amSpring, projectMomentum } from "@/constants/tokens/amMotion"
import { amGap, amRadius } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { REVIEW_STYLES, type ReviewStyle } from "@/lib/learn/srs"

/** Past the edge the sheet resists instead of stopping dead. */
function rubberBand(distance: number): number {
  "worklet"
  return 36 * (1 - Math.exp(-distance / 36))
}

/**
 * "How often do words come back?" (spec SCR-27). Bottom sheet, 40px top radius.
 * The handle follows the finger one to one; on release the landing point is the
 * momentum projection of the finger velocity, and the spring starts from it.
 */
export function ReviewStyleSheet({
  theme,
  visible,
  value,
  onSelect,
  onClose,
}: {
  theme: AmTheme
  visible: boolean
  value: ReviewStyle
  onSelect: (style: ReviewStyle) => void
  onClose: () => void
}) {
  const reduce = useReducedMotion()
  const { height: screenHeight } = useWindowDimensions()
  const [mounted, setMounted] = useState(visible)
  const [sheetHeight, setSheetHeight] = useState(480)
  const y = useSharedValue(screenHeight)
  const backdrop = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      y.value = reduce ? withTiming(0, { duration: 150 }) : withSpring(0, amSpring.default)
      backdrop.value = withTiming(1, { duration: 200 })
      return
    }
    backdrop.value = withTiming(0, { duration: 200 })
    const done = (finished?: boolean) => {
      "worklet"
      if (finished) runOnJS(setMounted)(false)
    }
    y.value = reduce
      ? withTiming(screenHeight, { duration: 150 }, done)
      : withSpring(screenHeight, amSpring.default, done)
  }, [visible, reduce, screenHeight, y, backdrop])

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      y.value = event.translationY >= 0 ? event.translationY : -rubberBand(-event.translationY)
    })
    .onEnd((event) => {
      const landing = projectMomentum(y.value, event.velocityY)
      if (landing > sheetHeight * 0.5) {
        runOnJS(onClose)()
      } else {
        y.value = withSpring(0, { ...amSpring.default, velocity: event.velocityY })
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))

  if (!mounted) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close review style"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
        style={[styles.sheet, { backgroundColor: theme.card }, sheetStyle]}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.handleArea} accessibilityLabel="Drag down to close">
            <View style={[styles.handle, { backgroundColor: theme.line }]} />
          </View>
        </GestureDetector>
        <Text style={[amType.heading, styles.title, { color: theme.textHeading }]}>How often do words come back?</Text>
        <View style={styles.options} accessibilityRole="radiogroup">
          {REVIEW_STYLES.map((option) => {
            const on = option.key === value
            return (
              <PressBox
                key={option.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => onSelect(option.key)}
                pressedScale={0.985}
                style={[
                  styles.option,
                  {
                    backgroundColor: theme.card,
                    borderColor: on ? theme.brand : theme.line,
                    borderWidth: on ? 2 : 1,
                  },
                ]}
              >
                <Overline color={theme.eyebrow}>{option.tag}</Overline>
                <Text style={[styles.optionName, { color: theme.textHeading }]}>{option.name}</Text>
                <Text style={[amType.body, { color: theme.textBody, fontSize: 15, lineHeight: 21 }]}>
                  {option.description}
                </Text>
                <Text style={[styles.ladder, { color: theme.textHeading }]}>{option.ladder}</Text>
              </PressBox>
            )
          })}
        </View>
        <Text style={[amType.body, { color: theme.textBody, fontSize: 14, lineHeight: 19 }]}>
          New to this? Start with Simple steps and switch to Adaptive at about fifty words. Changing the style keeps all
          your progress.
        </Text>
        <PillButton theme={theme} label="Done" onPress={onClose} style={styles.done} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(32, 40, 26, 0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: amRadius.sheet,
    borderTopRightRadius: amRadius.sheet,
    paddingHorizontal: amGap.gutter + 10,
    paddingBottom: 32,
    gap: amGap.grid,
  },
  handleArea: { alignSelf: "center", paddingTop: 12, paddingBottom: 12, paddingHorizontal: 48 },
  handle: { width: 40, height: 5, borderRadius: 3 },
  title: { textTransform: "uppercase", fontFamily: amFonts.display, letterSpacing: -0.5 },
  options: { gap: amGap.grid },
  option: { borderRadius: amRadius.card, padding: amGap.padCard, gap: 4 },
  optionName: { fontFamily: amFonts.bold, fontSize: 19, lineHeight: 24 },
  ladder: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 19 },
  done: { alignSelf: "stretch", backgroundColor: amColors.white },
})
