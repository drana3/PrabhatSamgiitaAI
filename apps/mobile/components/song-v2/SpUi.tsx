import { useEffect, type ReactNode } from "react"
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"

import { SpIcon, type SpIconName } from "./SpIcon"
import { note as noteStyle, over, pillText, secH2 } from "./spType"

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/**
 * `.press`: the control answers on pointer-down (scale .98), by spring from the value on screen,
 * so letting go halfway never jumps. Layout style goes on the pressable itself.
 */
export function SpPress({
  style,
  onPress,
  onLongPress,
  children,
  pressedScale = 0.98,
  disabled,
  accessibilityLabel,
  accessibilityState,
  accessibilityRole = "button",
  testID,
}: {
  style?: StyleProp<ViewStyle>
  onPress?: () => void
  onLongPress?: () => void
  children?: ReactNode
  pressedScale?: number
  disabled?: boolean
  accessibilityLabel?: string
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean }
  accessibilityRole?: "button" | "tab" | "radio" | "checkbox" | "link"
  testID?: string
}) {
  const scale = useSharedValue(1)
  const reduce = useReducedMotion()
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        scale.value = reduce ? 1 : withSpring(pressedScale, amSpring.default)
      }}
      onPressOut={() => {
        scale.value = reduce ? 1 : withSpring(1, amSpring.default)
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  )
}

export type SpPillVariant = "brand" | "sand" | "ink" | "danger" | "peach"

/** `.pill`: 48 high, 70 radius, 600 16, gap 8. */
export function SpPill({
  t,
  label,
  variant = "brand",
  icon,
  onPress,
  style,
  textStyle,
  accessibilityLabel,
}: {
  t: SpTheme
  label: string
  variant?: SpPillVariant
  icon?: SpIconName
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  accessibilityLabel?: string
}) {
  const colors = pillColors(t, variant)
  return (
    <SpPress
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.pill,
        { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: colors.border === "transparent" ? 0 : 1 },
        style,
      ]}
    >
      {icon ? <SpIcon name={icon} size={18} color={colors.fg} filled={icon === "play"} /> : null}
      <Text style={[pillText, { color: colors.fg }, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </SpPress>
  )
}

function pillColors(t: SpTheme, variant: SpPillVariant) {
  switch (variant) {
    case "brand":
      return { bg: t.action, fg: t.onAction, border: "transparent" }
    case "ink":
      return { bg: t.ink900, fg: t.onInk, border: "transparent" }
    case "danger":
      return { bg: t.danger, fg: "#FFFFFF", border: "transparent" }
    case "peach":
      return { bg: t.orange100, fg: t.orange700, border: "transparent" }
    default:
      return { bg: t.white, fg: t.ink800, border: t.sand300 }
  }
}

/** `.round`: 44 circle, glass-strong fill with a glass edge. */
export function SpRound({
  t,
  icon,
  onPress,
  label,
  size = 44,
  iconSize = 22,
  tone = "glass",
  color,
  filled,
  children,
  style,
}: {
  t: SpTheme
  icon?: SpIconName
  onPress?: () => void
  label: string
  size?: number
  iconSize?: number
  /** glass: top bar buttons. sand: the key / capo steppers */
  tone?: "glass" | "sand" | "peach" | "white"
  color?: string
  filled?: boolean
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const bg = tone === "sand" ? t.sand100 : tone === "peach" ? t.orange100 : tone === "white" ? t.white : t.glassStrong
  const border = tone === "sand" || tone === "white" ? t.sand300 : tone === "peach" ? "transparent" : t.glassEdge
  const fg = color ?? (tone === "peach" ? t.orange700 : t.ink800)
  return (
    <SpPress
      onPress={onPress}
      accessibilityLabel={label}
      style={[
        { width: size, height: size, borderRadius: 9999, backgroundColor: bg, borderColor: border, borderWidth: 1 },
        styles.center,
        style,
      ]}
    >
      {children ?? (icon ? <SpIcon name={icon} size={iconSize} color={fg} filled={filled} /> : null)}
    </SpPress>
  )
}

/** `.chip`: 44 high (36 small), 70 radius, 600 15; on = ink fill. */
export function SpChip({
  t,
  label,
  on,
  onPress,
  size = "md",
  trailingIcon,
  style,
}: {
  t: SpTheme
  label: string
  on?: boolean
  onPress?: () => void
  size?: "md" | "sm" | "xs"
  trailingIcon?: SpIconName
  style?: StyleProp<ViewStyle>
}) {
  const height = size === "md" ? 44 : size === "sm" ? 36 : 36
  const padding = size === "md" ? 20 : 14
  const fontSize = size === "md" ? 15 : 14
  const fg = on ? (t.dark ? t.onAction : t.onInk) : t.ink800
  return (
    <SpPress
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected: !!on }}
      style={[
        styles.chip,
        {
          height,
          paddingHorizontal: padding,
          backgroundColor: on ? (t.dark ? t.action : t.ink900) : t.white,
          borderColor: on ? (t.dark ? t.action : t.ink900) : t.sand300,
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: amFonts.semi, fontSize, color: fg }} numberOfLines={1}>
        {label}
      </Text>
      {trailingIcon ? <SpIcon name={trailingIcon} size={14} color={fg} strokeWidth={2} /> : null}
    </SpPress>
  )
}

/** `.toast`: ink pill above the tab bar, rises in. */
export function SpToast({ t, message }: { t: SpTheme; message: string }) {
  const reduce = useReducedMotion()
  const p = useSharedValue(0)
  useEffect(() => {
    p.value = 0
    p.value = withTiming(1, { duration: 320, easing: Easing.bezier(0.2, 0.7, 0.2, 1) })
  }, [message, p])
  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: reduce ? 0 : (1 - p.value) * 16 }],
  }))
  if (!message) return null
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole="alert"
      style={[styles.toast, { backgroundColor: t.ink900 }, anim]}
    >
      <Text style={{ fontFamily: amFonts.semi, fontSize: 14, color: t.onInk }} numberOfLines={1}>
        {message}
      </Text>
    </Animated.View>
  )
}

/** Radio / check circle of the sheets (`.rdo`, `.chk`): 24 round, 2px ink-300 ring, orange when on. */
export function SpMark({ t, on, kind }: { t: SpTheme; on: boolean; kind: "check" | "radio" }) {
  return (
    <View
      style={[
        styles.mark,
        { borderColor: on ? t.action : t.ink300, backgroundColor: on ? t.action : "transparent" },
      ]}
    >
      {on && kind === "check" ? <SpIcon name="check" size={16} color="#FFFFFF" strokeWidth={2.6} /> : null}
      {on && kind === "radio" ? <View style={styles.radioDot} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  center: { alignItems: "center", justifyContent: "center" },
  chip: {
    borderRadius: 70,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 172,
    zIndex: 60,
    height: 48,
    borderRadius: 70,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  card: { marginHorizontal: 10, padding: 20, borderRadius: 30, borderWidth: 1, gap: 16 },
  tcHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  gap: { flexDirection: "row", alignItems: "center", columnGap: 12, paddingVertical: 8 },
  gapBtn: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  gapAction: { fontFamily: amFonts.semi, fontSize: 15 },
  mark: { width: 24, height: 24, borderRadius: 9999, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 9999, backgroundColor: "#FFFFFF" },
})

/** `.tcard`: white card, 30 radius, 20 padding, 16 gap, 10 side margin. */
export function SpCard({ t, children, style }: { t: SpTheme; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, { backgroundColor: t.white, borderColor: t.sand300 }, style]}>{children}</View>
  )
}

/** `.t-sec-h2.sp-sec`: the 26px section heading of the long page (`first` sits 20 under the tabs, others 36). */
export function SpSectionTitle({
  t,
  label,
  first,
  onLayoutY,
}: {
  t: SpTheme
  label: string
  first?: boolean
  onLayoutY?: (y: number) => void
}) {
  return (
    <Text
      accessibilityRole="header"
      onLayout={(event) => onLayoutY?.(event.nativeEvent.layout.y)}
      style={[secH2(t, 26), { marginTop: first ? 20 : 36, marginHorizontal: 10, marginBottom: 14 }]}
    >
      {label}
    </Text>
  )
}

/** `.tc-head`: an eyebrow on the left and a quiet note on the right. */
/**
 * The honest line when a song lacks the chosen language: "Not available in Russian yet. Showing
 * English." and a Request action (the existing request flow). Nothing else is shown in its place.
 */
export function SpGapNote({
  t,
  text,
  requested,
  onRequest,
}: {
  t: SpTheme
  text: string
  requested: boolean
  onRequest: () => void
}) {
  return (
    <View style={styles.gap} accessibilityRole="alert">
      <Text style={[noteStyle(t), { flex: 1 }]}>{text}</Text>
      {requested ? (
        <Text style={[styles.gapAction, { color: t.ink500 }]}>Requested</Text>
      ) : (
        <SpPress onPress={onRequest} accessibilityLabel="Request this language" style={styles.gapBtn}>
          <Text style={[styles.gapAction, { color: t.orange700 }]}>Request</Text>
        </SpPress>
      )}
    </View>
  )
}

export function SpTcHead({ t, label, note }: { t: SpTheme; label: string; note?: string }) {
  return (
    <View style={styles.tcHead}>
      <Text style={over(t)}>{label}</Text>
      {note ? <Text style={[noteStyle(t), { flexShrink: 1, textAlign: "right" }]}>{note}</Text> : null}
    </View>
  )
}
