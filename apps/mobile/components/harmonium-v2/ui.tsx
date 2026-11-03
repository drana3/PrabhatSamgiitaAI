import type { ReactNode } from "react"
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"
import { ArrowLeft, Minus, Plus } from "lucide-react-native"

import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import { amControl, amGap, amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"

type ThemeProps = { theme: AmTheme }

type PressBoxProps = Omit<PressableProps, "style" | "children"> & {
  outerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  pressedScale?: number
  children?: ReactNode
}

/** Scales on touch-down with a spring that starts from the value on screen (interruptible). */
export function PressBox({ outerStyle, style, pressedScale = 0.97, children, ...rest }: PressBoxProps) {
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <Pressable
      {...rest}
      style={outerStyle}
      onPressIn={(event) => {
        scale.value = withSpring(pressedScale, amSpring.default)
        rest.onPressIn?.(event)
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, amSpring.default)
        rest.onPressOut?.(event)
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  )
}

export function SubHeader({ theme, title, onBack }: ThemeProps & { title: string; onBack: () => void }) {
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
    </View>
  )
}

type PillVariant = "brand" | "sand" | "dark"

export function PillButton({
  theme,
  label,
  onPress,
  variant = "brand",
  style,
  accessibilityState,
}: ThemeProps & {
  label: string
  onPress: () => void
  variant?: PillVariant
  style?: StyleProp<ViewStyle>
  accessibilityState?: PressableProps["accessibilityState"]
}) {
  const palette =
    variant === "brand"
      ? { bg: theme.brand, border: theme.brand, text: theme.onBrand }
      : variant === "dark"
        ? { bg: amColors.ink800, border: amColors.ink800, text: amColors.white }
        : { bg: theme.card, border: theme.line, text: theme.textHeading }
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={accessibilityState}
      onPress={onPress}
      outerStyle={style}
      style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <Text style={[styles.pillText, { color: palette.text }]}>{label}</Text>
    </PressBox>
  )
}

/** `Sa is  [-]  D  [+]`: the key control. Each button is 44px. */
export function SaStepper({
  theme,
  value,
  onStep,
}: ThemeProps & { value: string; onStep: (direction: -1 | 1) => void }) {
  return (
    <View style={styles.stepper}>
      <Text style={[amType.lead, { color: theme.textHeading }]}>Sa is</Text>
      <PressBox
        accessibilityRole="button"
        accessibilityLabel="Lower the key by a semitone"
        onPress={() => onStep(-1)}
        pressedScale={0.9}
        style={[styles.round, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <Minus size={20} color={theme.textHeading} />
      </PressBox>
      <Text
        accessibilityLabel={`Sa is ${value}`}
        style={[styles.saValue, { color: theme.textHeading }]}
      >
        {value}
      </Text>
      <PressBox
        accessibilityRole="button"
        accessibilityLabel="Raise the key by a semitone"
        onPress={() => onStep(1)}
        pressedScale={0.9}
        style={[styles.round, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <Plus size={20} color={theme.textHeading} />
      </PressBox>
    </View>
  )
}

export function Overline({ color, children }: { color: string; children: ReactNode }) {
  return <Text style={[amType.label, { color }]}>{children}</Text>
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: amGap.grid },
  headerTitle: { flex: 1 },
  round: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amRadius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    minHeight: amControl.pillHeight,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 20 },
  stepper: { flexDirection: "row", alignItems: "center", gap: amGap.grid },
  saValue: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 34, minWidth: 48, textAlign: "center" },
})
