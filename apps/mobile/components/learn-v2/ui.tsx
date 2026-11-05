import "@/lib/webFontSmoothing"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"

import { AvatarFace } from "@/components/profile-v2/AvatarFace"
import { DottedGlow } from "@/components/learn-v2/GreenPanel"
import { PressBox } from "@/components/learn-v2/PressBox"
import { amColors, amDark, amDarkSurface, type AmTheme } from "@/constants/tokens/amColors"
import { amReveal, amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"

/**
 * Presentation primitives of the Learn area, measured on the design prototype
 * (apps/mobile/public/mockup/Main.dc.html, CSS lines 14-989). The prototype's
 * `--am-*` variables become the AmTheme plus the few extra tones in `toneOf`.
 */

export function isDarkLearnTheme(theme: AmTheme): boolean {
  return theme.page === amDark.page
}

/** Tones the prototype takes from variables that AmTheme does not carry. */
export function toneOf(theme: AmTheme) {
  const dark = isDarkLearnTheme(theme)
  return {
    dark,
    /** --am-ink-900: chip.on background, big numbers */
    ink900: dark ? amDarkSurface.heading : amColors.ink900,
    /** --on-ink */
    onInk: dark ? amDarkSurface.onLight : amColors.white,
    /** --am-ink-300: second tone of headings, "of 5" */
    ink300: dark ? amDarkSurface.muted : amColors.headingSecond,
    /** --am-orange-100: peach card, avatar */
    peach: dark ? amDarkSurface.peach : amColors.orange100,
  }
}

/** the prototype's `.scr` top padding: the status bar area above the 56px head */
export const LEARN_TOP = 54

export function useLearnTopInset(): number {
  const insets = useSafeAreaInsets()
  return Math.max(insets.top, LEARN_TOP)
}

// ---------------------------------------------------------------------------
// Icons (the prototype's own paths, 24px box, 1.75 stroke)
// ---------------------------------------------------------------------------

export function Icon({ d, size = 18, color, stroke = 1.75 }: { d: string; size?: number; color: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  )
}

export const ICON_ARROW = "M5 12h14M13 6l6 6-6 6"
export const ICON_CHEVRON = "M9 5l7 7-7 7"
export const ICON_BACK = "M15 5l-7 7 7 7"

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** `.over`: 13px, 600, +0.08em, uppercase, orange-700 (gold in dark). */
export function Over({
  children,
  color,
  style,
  numeric,
}: {
  children: ReactNode
  color: string
  style?: StyleProp<TextStyle>
  numeric?: boolean
}) {
  return <Text style={[styles.over, { color }, numeric && styles.num, style]}>{children}</Text>
}

/** `.t-page-h1`: 45px 800, two tones, 12px 10px 20px around it. */
export function PageHeading({ theme, first, second }: { theme: AmTheme; first: string; second: string }) {
  const tone = toneOf(theme)
  return (
    <View style={styles.pageHeadingBox}>
      <Text accessibilityRole="header" style={[styles.pageHeading, { color: theme.textHeading }]}>
        {first}
        {"\n"}
        <Text style={{ color: tone.ink300 }}>{second}</Text>
      </Text>
    </View>
  )
}

/** `.t-sec-h2`: 30px 800, accent line below in ink-300. */
export function SectionHeading({ theme, first, accent }: { theme: AmTheme; first: string; accent: string }) {
  const tone = toneOf(theme)
  return (
    <Text accessibilityRole="header" style={[styles.sectionHeading, { color: theme.textHeading }]}>
      {first}
      {"\n"}
      <Text style={{ color: tone.ink300 }}>{accent}</Text>
    </Text>
  )
}

/** `.t-h3` inside the cards: 800 uppercase, line height 1. */
export function CardTitle({ children, color, size = 24 }: { children: ReactNode; color: string; size?: number }) {
  return <Text style={[styles.h3, { color, fontSize: size, lineHeight: size, letterSpacing: -0.02 * size }]}>{children}</Text>
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

/** `.pill`: 48px (40 small), 70px radius, brand or white-with-border. Text on orange is white. */
export function Pill({
  theme,
  label,
  onPress,
  variant = "brand",
  small,
  arrow,
  go,
  full,
  height,
  style,
  disabled,
}: {
  theme: AmTheme
  label: string
  onPress: () => void
  variant?: "brand" | "sand"
  small?: boolean
  arrow?: boolean
  /** `.go`: sits at the left of its card with 8px above */
  go?: boolean
  full?: boolean
  height?: number
  style?: StyleProp<ViewStyle>
  disabled?: boolean
}) {
  const brand = variant === "brand"
  const color = brand ? amColors.white : theme.textHeading
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      pressedScale={0.98}
      outerStyle={[go && styles.go, full && styles.full, style]}
      style={[
        styles.pill,
        small && styles.pillSmall,
        height ? { height } : null,
        brand
          ? { backgroundColor: theme.brand }
          : { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.pillText, small && styles.pillTextSmall, { color }]}>{label}</Text>
      {arrow ? <Icon d={ICON_ARROW} color={color} /> : null}
    </PressBox>
  )
}

/** `.chip`: 44px, or 36px small. On: ink in light, green inside `.wlangs`. */
export function Chip({
  theme,
  label,
  on,
  onPress,
  small,
  green,
}: {
  theme: AmTheme
  label: string
  on: boolean
  onPress: () => void
  small?: boolean
  green?: boolean
}) {
  const tone = toneOf(theme)
  const onBg = tone.dark ? theme.brand : green ? amColors.sage700 : tone.ink900
  const onFg = tone.dark ? theme.onBrand : green ? amColors.white : tone.onInk
  return (
    <PressBox
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, selected: on }}
      onPress={onPress}
      pressedScale={0.97}
      style={[
        styles.chip,
        small && styles.chipSmall,
        { backgroundColor: on ? onBg : theme.card, borderColor: on ? onBg : theme.line },
      ]}
    >
      <Text style={[styles.chipText, small && styles.chipTextSmall, { color: on ? onFg : theme.textHeading }]}>{label}</Text>
    </PressBox>
  )
}

/** 44px round button of the overlay head: white, 1px line, chevron. */
export function BackButton({ theme, onPress }: { theme: AmTheme; onPress: () => void }) {
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      pressedScale={0.94}
      style={[styles.round, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <Icon d={ICON_BACK} size={22} color={theme.textHeading} />
    </PressBox>
  )
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type LCardTone = "prg" | "green" | "dark" | "olive" | "white" | "peach"

export function lcardPalette(tone: LCardTone, theme: AmTheme) {
  const t = toneOf(theme)
  switch (tone) {
    case "prg":
    case "green":
      return { bg: amColors.sage700, over: amColors.gold300, text: amColors.white, body: "rgba(255,255,255,0.82)", border: undefined }
    case "dark":
      return { bg: amColors.sage900, over: amColors.gold300, text: amColors.white, body: "rgba(255,255,255,0.82)", border: undefined }
    case "olive":
      return { bg: amColors.sage200, over: amColors.sage700, text: amColors.sage900, body: amColors.sage900, border: undefined }
    case "peach":
      return { bg: t.peach, over: theme.eyebrow, text: theme.textHeading, body: theme.textHeading, border: undefined }
    case "white":
    default:
      return { bg: theme.card, over: theme.eyebrow, text: theme.textHeading, body: theme.textHeading, border: theme.line }
  }
}

/** `.lcard`: 25px padding, 30px radius, 12px gap, the three-colour rhythm. */
export function LCard({
  theme,
  tone,
  children,
  style,
}: {
  theme: AmTheme
  tone: LCardTone
  children: (colors: ReturnType<typeof lcardPalette>) => ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const colors = lcardPalette(tone, theme)
  return (
    <View
      style={[
        styles.lcard,
        { backgroundColor: colors.bg },
        colors.border ? { borderWidth: 1, borderColor: colors.border } : null,
        style,
      ]}
    >
      {tone === "prg" ? <DottedGlow /> : null}
      {children(colors)}
    </View>
  )
}

/** Body line of a card: 16px 500, at most 28ch wide. */
export function CardText({
  children,
  color,
  bold,
  wide,
}: {
  children: ReactNode
  color: string
  bold?: boolean
  /** `.step p{max-width:none}`: the full width of the card */
  wide?: boolean
}) {
  return <Text style={[styles.cardText, { color }, bold && { fontFamily: amFonts.semi }, wide && { maxWidth: "100%" }]}>{children}</Text>
}

/** `.card.cardbtn`: white row, 20px radius, 76px high, eyebrow and title, chevron. */
export function NavRow({
  theme,
  eyebrow,
  title,
  onPress,
  numericEyebrow,
}: {
  theme: AmTheme
  eyebrow: string
  title: string
  onPress: () => void
  numericEyebrow?: boolean
}) {
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={`${eyebrow}, ${title}`}
      onPress={onPress}
      pressedScale={0.98}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <View style={styles.cardMain}>
        <Over color={theme.eyebrow} numeric={numericEyebrow}>
          {eyebrow}
        </Over>
        <Text style={[styles.cardTitle, { color: theme.textHeading }]}>{title}</Text>
      </View>
      <Icon d={ICON_CHEVRON} size={22} color={theme.textBody} />
    </PressBox>
  )
}

/** `.track`: 6px bar, the fill is a full-width bar scaled from the left. Starts from the value on screen. */
export function Track({
  value,
  theme,
  height = 6,
  fill = amColors.orange500,
  trackColor,
}: {
  value: number
  theme: AmTheme
  height?: number
  fill?: string
  trackColor?: string
}) {
  const reduce = useReducedMotion()
  const progress = useSharedValue(Math.max(0, Math.min(1, value)))
  useEffect(() => {
    const target = Math.max(0, Math.min(1, value))
    progress.value = reduce ? withTiming(target, { duration: 150 }) : withSpring(target, amSpring.default)
  }, [value, reduce, progress])
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.0001, progress.value) }] }))
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={[styles.track, { height, borderRadius: height, backgroundColor: trackColor ?? theme.line }]}
    >
      <Animated.View
        style={[styles.trackFill, { backgroundColor: fill, borderRadius: height, transformOrigin: "0% 50%" }, style]}
      />
    </View>
  )
}

/** `.dots`: three 28x6 bars for the song path. */
export function StepBars({ theme, done }: { theme: AmTheme; done: readonly boolean[] }) {
  return (
    <View style={styles.dots} accessibilityLabel={`${done.filter(Boolean).length} of ${done.length} steps done`}>
      {done.map((on, i) => (
        <View key={i} style={[styles.dotBar, { backgroundColor: on ? amColors.orange500 : theme.line }]} />
      ))}
    </View>
  )
}

/** `.meter`: five 22x6 bars, the memory strength of a learned song. */
export function Meter({ theme, strength }: { theme: AmTheme; strength: number }) {
  return (
    <View style={styles.meter} accessibilityLabel={`Memory strength ${strength} of 5`}>
      {[1, 2, 3, 4, 5].map((k) => (
        <View key={k} style={[styles.meterBar, { backgroundColor: strength >= k ? (isDarkLearnTheme(theme) ? amColors.orange500 : amColors.sage700) : theme.line }]} />
      ))}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Segmented control (`.seg`)
// ---------------------------------------------------------------------------

const SEG_PAD = 4

export function Segmented({
  theme,
  options,
  value,
  onChange,
}: {
  theme: AmTheme
  options: ReadonlyArray<{ key: string; label: string }>
  value: string
  onChange: (key: string) => void
}) {
  const reduce = useReducedMotion()
  const [width, setWidth] = useState(0)
  const index = Math.max(0, options.findIndex((option) => option.key === value))
  const segment = width > 0 ? (width - SEG_PAD * 2 - 2) / options.length : 0
  const x = useSharedValue(0)
  const placed = useRef(false)

  useEffect(() => {
    const target = index * segment
    if (!placed.current && segment > 0) {
      placed.current = true
      x.value = target
      return
    }
    x.value = reduce ? withTiming(target, { duration: 150 }) : withSpring(target, amSpring.default)
  }, [index, segment, reduce, x])

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.seg, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      {segment > 0 ? <Animated.View pointerEvents="none" style={[styles.segInd, { width: segment }, indicator]} /> : null}
      {options.map((option) => {
        const on = option.key === value
        return (
          <PressBox
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.key)}
            pressedScale={0.97}
            outerStyle={styles.segOuter}
            style={styles.segButton}
          >
            <Text style={[styles.segText, { color: on ? amColors.white : theme.textBody }]}>{option.label}</Text>
          </PressBox>
        )
      })}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

/** One quick fade and rise when a full-screen overlay opens (`searchin`, 220ms). */
function ScreenIn({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.22, 1, 0.36, 1) })
  }, [progress])
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduce ? 0 : (1 - progress.value) * -8 }],
  }))
  return <Animated.View style={[styles.flex, animated]}>{children}</Animated.View>
}

/**
 * `.search` overlay: sand page, 54px top, a head with the round back button and an
 * eyebrow label, then a scrolling body with 20px gaps and 10px sides.
 */
export function OverlayScreen({
  theme,
  label,
  onBack,
  right,
  children,
  overlay,
}: {
  theme: AmTheme
  label: ReactNode
  onBack: () => void
  right?: ReactNode
  children: ReactNode
  overlay?: ReactNode
}) {
  const top = useLearnTopInset()
  return (
    <View style={[styles.flex, { backgroundColor: theme.page, paddingTop: top }]}>
      <ScreenIn>
        <View style={styles.ovlHead}>
          <BackButton theme={theme} onPress={onBack} />
          {typeof label === "string" ? (
            <Over color={theme.eyebrow} style={styles.flex}>
              {label}
            </Over>
          ) : (
            <View style={styles.flex}>{label}</View>
          )}
          {right}
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.ovlBody} style={styles.flex}>
          {children}
        </ScrollView>
      </ScreenIn>
      {overlay}
    </View>
  )
}

/** Logo mark left, avatar right (`.head`, 56px). */
export function LearnHead({
  theme,
  initials,
  onAvatar,
  logo,
}: {
  theme: AmTheme
  initials: string
  onAvatar: () => void
  logo: ReactNode
}) {
  const tone = toneOf(theme)
  return (
    <View style={styles.head}>
      <View style={styles.logo}>{logo}</View>
      <PressBox
        accessibilityRole="button"
        accessibilityLabel="Profile and settings"
        onPress={onAvatar}
        pressedScale={0.94}
        style={[styles.avatar, { backgroundColor: tone.peach }]}
      >
        <AvatarFace initial={initials} textStyle={[styles.avatarText, { color: theme.eyebrow }]} />
      </PressBox>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Toast (`.toast`)
// ---------------------------------------------------------------------------

export function useToast(): { show: (message: string) => void; node: ReactNode } {
  const [message, setMessage] = useState("")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const show = useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current)
    setMessage(next)
    timer.current = setTimeout(() => setMessage(""), 1800)
  }, [])
  return { show, node: message ? <ToastView key={message} message={message} /> : null }
}

function ToastView({ message }: { message: string }) {
  const tone = toneOf(useAmTheme())
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withTiming(1, { duration: amReveal.durationMs, easing: Easing.bezier(...amReveal.easing) })
  }, [progress])
  const animated = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * 16 }] }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { backgroundColor: tone.ink900 }, animated]}
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.toastText, { color: tone.onInk }]}>{message}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  full: { alignSelf: "stretch" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  num: { fontVariant: ["tabular-nums"] },
  pageHeadingBox: { paddingTop: 12, paddingHorizontal: 10, paddingBottom: 20 },
  pageHeading: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  sectionHeading: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 30, letterSpacing: -0.6, textTransform: "uppercase" },
  h3: { fontFamily: amFonts.display, textTransform: "uppercase" },
  go: { alignSelf: "flex-start", marginTop: 8 },
  pill: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pillSmall: { height: 40, paddingHorizontal: 16 },
  pillText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22 },
  pillTextSmall: { fontSize: 14, lineHeight: 20 },
  chip: { height: 44, paddingHorizontal: 20, borderRadius: 70, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipSmall: { height: 36, paddingHorizontal: 13 },
  chipText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  chipTextSmall: { fontSize: 14, lineHeight: 18 },
  round: { width: 44, height: 44, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  lcard: { padding: 25, borderRadius: 30, gap: 12, overflow: "hidden", width: "100%" },
  cardText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 21.6, maxWidth: 252 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 76,
    paddingVertical: 12,
    paddingLeft: 20,
    paddingRight: 16,
    borderRadius: 20,
    borderWidth: 1,
    width: "100%",
  },
  cardMain: { flex: 1, minWidth: 0, gap: 4 },
  cardTitle: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 22, letterSpacing: -0.19 },
  track: { height: 6, width: "100%", overflow: "hidden" },
  trackFill: { ...StyleSheet.absoluteFillObject },
  dots: { flexDirection: "row", gap: 6, marginTop: 8 },
  dotBar: { width: 28, height: 6, borderRadius: 3 },
  meter: { flexDirection: "row", gap: 4, marginTop: 4 },
  meterBar: { width: 22, height: 6, borderRadius: 3 },
  seg: { flexDirection: "row", height: 56, padding: SEG_PAD, borderRadius: 70, borderWidth: 1 },
  segInd: { position: "absolute", left: SEG_PAD, top: SEG_PAD, height: 46, borderRadius: 70, backgroundColor: amColors.orange700 },
  segOuter: { flex: 1 },
  segButton: { height: 46, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  segText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22 },
  ovlHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 8, paddingHorizontal: 10, paddingBottom: 12 },
  ovlBody: { gap: 20, paddingHorizontal: 10, paddingBottom: 140 },
  head: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10 },
  logo: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 22 },
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 172,
    height: 48,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  toastText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
})
