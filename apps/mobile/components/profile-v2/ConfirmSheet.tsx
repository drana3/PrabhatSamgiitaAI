import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { PressScale } from "@/components/today/motion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import { amControl, amGap, amRadius, amSpace } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"

export type ConfirmRequest = {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
}

const RISE_DP = 32

/**
 * Confirmation sheet for destructive actions. Rises from the bottom of the
 * profile sheet and leaves by the same path. Opacity and transform only.
 * Cancel is the first and easiest button; the destructive one is separate.
 */
export function ConfirmSheet({
  theme,
  request,
  onDismiss,
  bottomOffset = amGap.gutter,
}: {
  theme: AmTheme
  request: ConfirmRequest | null
  onDismiss: () => void
  /** distance of the card from the bottom edge: a screen with a floating pill passes the pill's top */
  bottomOffset?: number
}) {
  const reduce = useReducedMotion()
  const progress = useSharedValue(0)
  const [shown, setShown] = useState<ConfirmRequest | null>(null)

  useEffect(() => {
    if (request) {
      setShown(request)
      progress.value = reduce ? withTiming(1, { duration: 150 }) : withSpring(1, amSpring.default)
    }
  }, [request, reduce, progress])

  const close = (after?: () => void) => {
    const done = () => {
      setShown(null)
      onDismiss()
      after?.()
    }
    if (reduce) {
      progress.value = withTiming(0, { duration: 150 }, (finished) => {
        if (finished) runOnJS(done)()
      })
    } else {
      progress.value = withSpring(0, amSpring.default, (finished) => {
        if (finished) runOnJS(done)()
      })
    }
  }

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value * 0.5 }))
  const card = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduce ? 0 : (1 - progress.value) * RISE_DP }],
  }))

  if (!shown) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={StyleSheet.absoluteFill}
          onPress={() => close()}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.line, bottom: bottomOffset },
          card,
        ]}
      >
        <Text style={[amType.heading, { color: theme.textHeading }]} accessibilityRole="header">
          {shown.title}
        </Text>
        <Text style={[amType.body, { color: theme.textBody }]}>{shown.body}</Text>
        <View style={styles.actions}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={() => close()}
            style={[styles.button, { backgroundColor: theme.inner }]}
          >
            <Text style={[styles.buttonLabel, { color: theme.textHeading }]}>Cancel</Text>
          </PressScale>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={shown.confirmLabel}
            onPress={() => close(shown.onConfirm)}
            style={[styles.button, { backgroundColor: amColors.danger }]}
          >
            <Text style={[styles.buttonLabel, { color: amColors.white }]}>{shown.confirmLabel}</Text>
          </PressScale>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: amColors.ink900 },
  card: {
    position: "absolute",
    left: amGap.gutter,
    right: amGap.gutter,
    bottom: amGap.gutter,
    borderRadius: amRadius.panel,
    borderWidth: StyleSheet.hairlineWidth,
    padding: amGap.padPanel,
    gap: amGap.text,
  },
  actions: { gap: amSpace.s3, marginTop: amSpace.s2 },
  button: {
    height: amControl.pillHeight,
    borderRadius: amRadius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22 },
})
