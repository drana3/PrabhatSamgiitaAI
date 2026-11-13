import { useCallback, useEffect, useRef, useState } from "react"
import { StyleSheet, Text } from "react-native"
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"

import type { AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"

const SHOW_MS = 1800
const RISE_MS = 320
const BOTTOM = 172

/** One-line message that rises over the lower player and leaves after 1.8 s (prototype .toast). */
export function usePlayerToast() {
  const [message, setMessage] = useState("")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current)
    setMessage(text)
    timer.current = setTimeout(() => setMessage(""), SHOW_MS)
  }, [])
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  return { message, show }
}

export function PlayerToast({ message, theme }: { message: string; theme: AmTheme }) {
  const reduce = useReducedMotion()
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = message ? withTiming(1, { duration: RISE_MS, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }) : 0
  }, [message, progress])
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduce ? 0 : (1 - progress.value) * 16 }],
  }))
  if (!message) return null
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { backgroundColor: theme.textHeading }, style]}
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
    bottom: BOTTOM,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
  },
  text: { fontFamily: amFonts.semi, fontSize: 14 },
})
