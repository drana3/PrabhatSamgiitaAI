import { useEffect, useState } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { KPress } from "@/components/kirtan/KPress"
import { amSpring } from "@/constants/tokens/amMotion"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSheetBackHandler } from "@/hooks/useSheetBackHandler"

export type MenuItem = { id: string; label: string; tone?: "danger" }

/**
 * The ⋯ menu of a chart row: a short sheet rising from the bottom with the actions of that row, one per line, the
 * destructive one last and red. A tap outside, Back, Escape and "Close" all answer with `onDismiss`. It rises with a
 * spring (transform and opacity only) and can be left while it is still rising. The words of each item are the caller's.
 */
export function RowMenu({
  theme,
  open,
  title,
  subtitle,
  items,
  closeLabel,
  onSelect,
  onDismiss,
}: {
  theme: SongsTheme
  open: boolean
  title: string
  subtitle?: string
  items: MenuItem[]
  closeLabel: string
  onSelect: (id: string) => void
  onDismiss: () => void
}) {
  const reduce = useReducedMotion()
  const insets = useSafeAreaInsets()
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
  const card = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: reduce ? 0 : (1 - p.value) * 32 }] }))

  if (!mounted) return null
  return (
    <View style={s.layer} accessibilityViewIsModal pointerEvents="auto">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? "rgba(0,0,0,0.6)" : "rgba(32,40,26,0.45)" }, scrim]}>
        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onDismiss} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line, marginBottom: Math.max(insets.bottom, 12) }, card]}>
        <View style={[s.head, { borderBottomColor: theme.line }]}>
          <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text style={[s.sub, { color: theme.textBody }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {items.map((item) => (
          <KPress
            key={item.id}
            accessibilityRole="menuitem"
            accessibilityLabel={item.label}
            onPress={() => onSelect(item.id)}
            pressedScale={0.99}
            style={[s.item, { borderBottomColor: theme.line }]}
          >
            <Text style={[s.itemText, { color: item.tone === "danger" ? theme.dangerText : theme.textHeading }]}>{item.label}</Text>
          </KPress>
        ))}
        <KPress accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onDismiss} pressedScale={0.99} style={s.item}>
          <Text style={[s.itemText, { color: theme.textBody }]}>{closeLabel}</Text>
        </KPress>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", paddingHorizontal: 12, zIndex: 50 },
  card: { width: "100%", maxWidth: 520, alignSelf: "center", borderRadius: 24, borderWidth: 1.5, overflow: "hidden" },
  head: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 2, borderBottomWidth: 1 },
  title: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 24 },
  sub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  item: { minHeight: 52, paddingHorizontal: 20, justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth },
  itemText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22 },
})
