import { useEffect, useState, type ReactNode } from "react"
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { ArrowLeft } from "lucide-react-native"

import { PressBox } from "@/components/learn-v2/PressBox"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import { amControl, amGap, amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"

type ThemeProps = { theme: AmTheme }

/** Round 44px back button and a small label, for full-screen sub-screens. */
export function SubHeader({
  theme,
  title,
  onBack,
  right,
}: ThemeProps & { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <PressBox
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        pressedScale={0.92}
        style={[styles.round, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <ArrowLeft size={20} color={theme.textHeading} />
      </PressBox>
      <Text style={[amType.label, styles.headerTitle, { color: theme.eyebrow }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  )
}

/**
 * Progress bar. The fill is a full-width bar scaled from its left edge, so only
 * transform changes. Starts from the value on screen, never from the target.
 */
export function ProgressBar({
  value,
  trackColor,
  fillColor,
  height = 8,
}: {
  value: number
  trackColor: string
  fillColor: string
  height?: number
}) {
  const reduce = useReducedMotion()
  const progress = useSharedValue(Math.max(0, Math.min(1, value)))

  useEffect(() => {
    const target = Math.max(0, Math.min(1, value))
    progress.value = reduce ? withTiming(target, { duration: 150 }) : withSpring(target, amSpring.default)
  }, [value, reduce, progress])

  const fill = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0.0001, progress.value) }],
  }))

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={[styles.track, { height, backgroundColor: trackColor, borderRadius: height / 2 }]}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: fillColor, borderRadius: height / 2, transformOrigin: "0% 50%" },
          fill,
        ]}
      />
    </View>
  )
}

type PillVariant = "brand" | "sand" | "dark" | "light"

/** 48px pill button. Text on orange is always white. */
export function PillButton({
  theme,
  label,
  onPress,
  variant = "brand",
  disabled,
  style,
  accessibilityLabel,
}: ThemeProps & {
  label: string
  onPress: () => void
  variant?: PillVariant
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  const palette = pillPalette(theme, variant)
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      pressedScale={0.97}
      outerStyle={style}
      style={[
        styles.pill,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Text style={[styles.pillText, { color: palette.text }]}>{label}</Text>
    </PressBox>
  )
}

function pillPalette(theme: AmTheme, variant: PillVariant) {
  switch (variant) {
    case "brand":
      return { bg: theme.brand, border: theme.brand, text: theme.onBrand }
    case "dark":
      return { bg: amColors.ink800, border: amColors.ink800, text: amColors.white }
    case "light":
      return { bg: amColors.white, border: amColors.white, text: amColors.ink800 }
    case "sand":
    default:
      return { bg: theme.inner, border: theme.line, text: theme.textHeading }
  }
}

/**
 * Segmented control. The indicator slides with a spring; only translateX changes.
 */
export function Segmented({
  theme,
  options,
  value,
  onChange,
}: ThemeProps & {
  options: ReadonlyArray<{ key: string; label: string }>
  value: string
  onChange: (key: string) => void
}) {
  const reduce = useReducedMotion()
  const [width, setWidth] = useState(0)
  const index = Math.max(0, options.findIndex((option) => option.key === value))
  const segment = width > 0 ? (width - SEG_PAD * 2) / options.length : 0
  const x = useSharedValue(0)

  useEffect(() => {
    const target = index * segment
    x.value = reduce ? withTiming(target, { duration: 150 }) : withSpring(target, amSpring.default)
  }, [index, segment, reduce, x])

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.segmented, { backgroundColor: theme.inner, borderColor: theme.line }]}
    >
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { width: segment, backgroundColor: theme.brand }, indicator]}
        />
      ) : null}
      {options.map((option) => {
        const on = option.key === value
        return (
          <PressBox
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.key)}
            pressedScale={0.97}
            outerStyle={styles.segmentOuter}
            style={styles.segment}
          >
            <Text
              style={[
                styles.segmentText,
                { color: on ? theme.onBrand : theme.textHeading, fontFamily: on ? amFonts.bold : amFonts.semi },
              ]}
            >
              {option.label}
            </Text>
          </PressBox>
        )
      })}
    </View>
  )
}

/** Three dots, one per step of the song path. */
export function StepDots({
  done,
  onColor,
  offColor,
}: {
  done: readonly [boolean, boolean, boolean]
  onColor: string
  offColor: string
}) {
  return (
    <View style={styles.dots} accessibilityLabel={`${done.filter(Boolean).length} of 3 steps done`}>
      {done.map((on, index) => (
        <View key={index} style={[styles.dot, { backgroundColor: on ? onColor : offColor }]} />
      ))}
    </View>
  )
}

/** Overline: 13px, 600, uppercase. */
export function Overline({ color, children }: { color: string; children: ReactNode }) {
  return <Text style={[amType.label, { color }]}>{children}</Text>
}

const SEG_PAD = 4

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: amGap.block / 2,
    paddingVertical: amGap.grid,
  },
  headerTitle: { flex: 1 },
  round: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amRadius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  track: { width: "100%", overflow: "hidden" },
  fill: { ...StyleSheet.absoluteFillObject },
  pill: {
    minHeight: amControl.pillHeight,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 20 },
  segmented: {
    flexDirection: "row",
    borderRadius: amRadius.pill,
    borderWidth: 1,
    padding: SEG_PAD,
  },
  indicator: {
    position: "absolute",
    top: SEG_PAD,
    left: SEG_PAD,
    bottom: SEG_PAD,
    borderRadius: amRadius.pill,
  },
  segmentOuter: { flex: 1 },
  segment: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  segmentText: { fontSize: 15, lineHeight: 20 },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
})
