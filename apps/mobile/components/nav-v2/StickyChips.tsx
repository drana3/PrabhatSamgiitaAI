import { ScrollView, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated"

import { KPress } from "@/components/kirtan/KPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"

/**
 * The chips row of the Today, Songs and Kiirtan tabs, and the ONLY sticky element of those screens.
 *  - Full width, scrolls sideways, 16px side padding, 8px between chips.
 *  - Opaque and exactly the page colour: no grey, no translucency, no blur. The screen's peach wash
 *    ends above this row, so nothing shows through and no band appears.
 *  - A hairline (8% ink) fades in under it only after content has scrolled beneath it.
 *  - Chips fade out under a soft mask on the right edge only.
 *  - The active chip is filled orange with dark text; the others are outlined on the card colour.
 */
export const STICKY_CHIPS_HEIGHT = 56
export const STICKY_CHIPS_PAD = 16
export const STICKY_CHIPS_GAP = 8

export type ChipItem<T extends string = string> = { id: T; label: string }

export function chipColorsOf(p: AmProto) {
  return {
    page: p.sand200,
    card: p.white,
    line: p.sand300,
    active: p.orange500,
    onActive: "#1E1E1E",
    text: p.ink800,
    hairline: p.dark ? "rgba(245, 242, 239, 0.08)" : "rgba(30, 30, 30, 0.08)",
  }
}
export type ChipColors = ReturnType<typeof chipColorsOf>

/** `#RRGGBB` with an alpha, for the right-edge fade. */
export function hexAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Opacity of the hairline: 0 until the row is stuck (`stickAt` is its natural offset), full 12px later. */
export function hairlineOpacity(scroll: number, stickAt: number): number {
  "worklet"
  return interpolate(scroll, [stickAt, stickAt + 12], [0, 1], Extrapolation.CLAMP)
}

type Props<T extends string> = {
  items: readonly ChipItem<T>[]
  value: T | null
  onChange: (id: T) => void
  colors: ChipColors
  /** scroll offset of the screen and the offset where this row reaches the top */
  scrollY: SharedValue<number>
  stickAt: number
  /** extra content after the last chip, e.g. a link chip */
  tail?: React.ReactNode
}

export function StickyChipsRow<T extends string>({ items, value, onChange, colors, scrollY, stickAt, tail }: Props<T>) {
  const hair = useAnimatedStyle(() => ({ opacity: hairlineOpacity(scrollY.value, stickAt) }))
  return (
    <View style={[styles.row, { backgroundColor: colors.page }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll} accessibilityRole="tablist">
        {items.map((chip) => {
          const on = chip.id === value
          return (
            <KPress
              key={chip.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={chip.label}
              onActivate={() => onChange(chip.id)}
              pressedScale={0.94}
              style={[styles.chip, { backgroundColor: on ? colors.active : colors.card, borderColor: on ? colors.active : colors.line }]}
            >
              <Text style={[styles.text, { color: on ? colors.onActive : colors.text }]}>{chip.label}</Text>
            </KPress>
          )
        })}
        {tail}
      </ScrollView>
      <LinearGradient
        pointerEvents="none"
        colors={[hexAlpha(colors.page, 0), colors.page]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.fade}
      />
      <Animated.View pointerEvents="none" style={[styles.hair, { backgroundColor: colors.hairline }, hair]} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { height: STICKY_CHIPS_HEIGHT, justifyContent: "center", zIndex: 9 },
  scroll: { paddingHorizontal: STICKY_CHIPS_PAD, gap: STICKY_CHIPS_GAP, alignItems: "center" },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 70, borderWidth: 1, justifyContent: "center" },
  text: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  fade: { position: "absolute", top: 0, bottom: 0, right: 0, width: 32 },
  hair: { position: "absolute", left: 0, right: 0, bottom: 0, height: 1 },
})
