import { useEffect } from "react"
import { StyleSheet, Text } from "react-native"
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"

const RISE_MS = 280

/**
 * The one-line message after a tick ("Added to Mine"). It sits at the top, under the status bar,
 * so it never covers the sheet's rows or the Done pill, and it comes in over the scrim.
 */
export function SaveToast({ message, id }: { message: string; id: number }) {
  const theme = useAmTheme()
  const reduce = useReducedMotion()
  const insets = useSafeAreaInsets()
  const shown = useSharedValue(0)
  useEffect(() => {
    shown.value = 0
    shown.value = withTiming(1, { duration: RISE_MS, easing: Easing.bezier(0.2, 0.7, 0.2, 1) })
  }, [id, shown])
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: reduce ? 0 : (1 - shown.value) * -16 }],
  }))
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { top: Math.max(insets.top, 12) + 8, backgroundColor: theme.textHeading }, style]}
    >
      <Text style={[styles.text, { color: theme.page }]} numberOfLines={1}>
        {message}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 80,
  },
  text: { fontFamily: amFonts.semi, fontSize: 14 },
})
