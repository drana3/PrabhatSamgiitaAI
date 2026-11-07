import { useEffect, useState } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"

import { KPress } from "@/components/kirtan/KPress"
import { amSpring } from "@/constants/tokens/amMotion"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSheetBackHandler } from "@/hooks/useSheetBackHandler"

import { PILL } from "./parts"

export type DialogAction = { label: string; onPress: () => void; tone: "primary" | "quiet" | "danger" }

/**
 * A question with a few plain answers, laid over the screen (not a system alert, so the words can be as long as they
 * need and are the same on the web preview). The first action is the safe one. A tap outside, Back and Escape all
 * answer with `onDismiss` (the safe answer). It rises with a spring and can be left in the middle of rising.
 */
export function ConfirmDialog({
  theme,
  open,
  title,
  body,
  actions,
  onDismiss,
}: {
  theme: SongsTheme
  open: boolean
  title: string
  body: string
  actions: DialogAction[]
  onDismiss: () => void
}) {
  const reduce = useReducedMotion()
  const [mounted, setMounted] = useState(open)
  const p = useSharedValue(0)

  useSheetBackHandler(open, onDismiss)

  useEffect(() => {
    if (open) {
      setMounted(true)
      p.value = reduce ? withTiming(1, { duration: 150 }) : withSpring(1, amSpring.default)
    } else if (mounted) {
      p.value = withTiming(0, { duration: 150 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // unmount once the fade-out has had its time
  useEffect(() => {
    if (open || !mounted) return undefined
    const id = setTimeout(() => setMounted(false), 200)
    return () => clearTimeout(id)
  }, [open, mounted])

  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof document === "undefined") return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onDismiss])

  const scrim = useAnimatedStyle(() => ({ opacity: p.value }))
  const card = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: reduce ? 0 : (1 - p.value) * 24 }, { scale: reduce ? 1 : 0.96 + 0.04 * p.value }] }))

  if (!mounted) return null
  return (
    <View style={s.layer} accessibilityViewIsModal pointerEvents="auto">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? "rgba(0,0,0,0.6)" : "rgba(32,40,26,0.45)" }, scrim]}>
        <Pressable accessibilityRole="button" accessibilityLabel={actions[0]?.label} onPress={onDismiss} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }, card]} accessibilityRole="alert">
        <Text style={[s.title, { color: theme.textHeading }]} accessibilityRole="header">
          {title}
        </Text>
        <Text style={[s.body, { color: theme.textBody }]}>{body}</Text>
        <View style={s.actions}>
          {actions.map((action) => (
            <KPress
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={action.onPress}
              pressedScale={0.98}
              style={[
                s.button,
                action.tone === "primary" && { backgroundColor: theme.ink900, borderColor: theme.ink900 },
                action.tone === "quiet" && { backgroundColor: theme.card, borderColor: theme.line },
                action.tone === "danger" && { backgroundColor: theme.card, borderColor: theme.dangerText },
              ]}
            >
              <Text style={[s.buttonText, { color: action.tone === "primary" ? theme.onInk : action.tone === "danger" ? theme.dangerText : theme.textHeading }]}>{action.label}</Text>
            </KPress>
          ))}
        </View>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, zIndex: 50 },
  card: { width: "100%", maxWidth: 420, borderRadius: 24, borderWidth: 1.5, padding: 24, gap: 12 },
  title: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  actions: { gap: 8, marginTop: 12 },
  button: { minHeight: 52, borderRadius: PILL, borderWidth: 1.5, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  buttonText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22, textAlign: "center" },
})
