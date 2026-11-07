import { useEffect, useRef } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated"

import { TodayPress } from "@/components/today/TodayPress"
import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"

export type Bar = { key: number; message: string; actionLabel?: string; onAction?: () => void }

/** How long the bar stays (ms). Long enough to read a sentence and to reach Undo. */
export const BAR_MS = 5000

/**
 * A pill at the bottom of the centre: "Notification deleted  Undo", or a plain notice ("That song is not in
 * the library any more"). It rises on a spring from where it is, leaves by the same path, and goes by itself.
 * `bottom` is the safe distance above the tab bar and the home indicator.
 */
export function UndoBar({ p, bar, bottom, onDismiss }: { p: AmProto; bar: Bar | null; bottom: number; onDismiss: () => void }) {
  const rise = useSharedValue(0)
  const reduce = useReducedMotion()
  // the last bar stays drawn while it sinks, so it leaves by the way it came
  const last = useRef<Bar | null>(null)
  if (bar) last.current = bar
  const shown = bar ?? last.current

  useEffect(() => {
    rise.value = reduce ? (bar ? 1 : 0) : withSpring(bar ? 1 : 0, amSpring.default)
    if (!bar) return
    const timer = setTimeout(onDismiss, BAR_MS)
    return () => clearTimeout(timer)
  }, [bar, onDismiss, reduce, rise])

  const style = useAnimatedStyle(() => ({ opacity: rise.value, transform: [{ translateY: (1 - rise.value) * 24 }] }))
  if (!shown) return null
  return (
    <Animated.View style={[s.wrap, { bottom }, style]} pointerEvents={bar ? "box-none" : "none"}>
      <View style={[s.bar, { backgroundColor: p.ink900 }]} accessibilityLiveRegion="polite">
        <Text style={[s.message, { color: p.onInk }]} numberOfLines={3}>
          {shown.message}
        </Text>
        {bar && bar.actionLabel && bar.onAction ? (
          <TodayPress
            accessibilityRole="button"
            accessibilityLabel={bar.actionLabel}
            onPress={() => {
              bar.onAction?.()
              onDismiss()
            }}
            pressedScale={0.95}
            style={s.action}
          >
            <Text style={[s.actionText, { color: p.gold300 }]}>{bar.actionLabel}</Text>
          </TodayPress>
        ) : null}
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: 16 },
  bar: { minHeight: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 20, paddingRight: 8, paddingVertical: 6, maxWidth: 420 },
  message: { flexShrink: 1, fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  action: { minHeight: 44, paddingHorizontal: 14, justifyContent: "center" },
  actionText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
})
