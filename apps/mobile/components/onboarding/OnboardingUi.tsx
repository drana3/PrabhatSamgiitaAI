import { forwardRef, useState, type ReactNode } from "react"
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Circle, Path, Rect } from "react-native-svg"

import { Press } from "@/components/songs-v2/Press"
import { SongsReveal } from "@/components/songs-v2/SongsReveal"
import { amOnboarding } from "@/constants/tokens/amOnboarding"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { TOTAL_STEPS } from "@/lib/onboarding/flow"
import { screenTopInset } from "@/lib/screenTop"

/**
 * The building blocks of the onboarding screens, drawn from the board Для-Дады/онбординг-v2 and the
 * app's own tokens (docs/onboarding.md). One page recipe: a back round and a 3-part progress bar on top,
 * a small step label, a two-tone heading, a sentence, the content, and the buttons at the bottom.
 * Colours come from the theme only; outlines and tracks use the tokens added for them (`lineStrong`, `trackOff`).
 */

export const ONB_SIDE = 20

const HIDDEN = (Platform.OS === "web" ? { "aria-hidden": true } : { accessibilityElementsHidden: true, importantForAccessibility: "no" as const }) as object

/* ------------------------------------------------------------------ icons */

export type OnbIconName = "back" | "chevDown" | "chevRight" | "listen" | "chords" | "learn" | "kiirtan" | "radio" | "translate"

/** Line icons of the board (24 x 24, round caps), drawn in `color`. */
export function OnbIcon({ name, size = 24, color, strokeWidth = 1.8 }: { name: OnbIconName; size?: number; color: string; strokeWidth?: number }) {
  const line = { stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...HIDDEN}>
      {name === "back" ? <Path d="M15 5l-7 7 7 7" {...line} strokeWidth={2} /> : null}
      {name === "chevDown" ? <Path d="M6 9l6 6 6-6" {...line} strokeWidth={2.2} /> : null}
      {name === "chevRight" ? <Path d="M9 6l6 6-6 6" {...line} strokeWidth={2.2} /> : null}
      {name === "listen" ? (
        <>
          <Path d="M4 15v-3a8 8 0 0 1 16 0v3" {...line} />
          <Rect x={3} y={14} width={4} height={7} rx={1.5} {...line} />
          <Rect x={17} y={14} width={4} height={7} rx={1.5} {...line} />
        </>
      ) : null}
      {name === "chords" ? (
        <>
          <Rect x={5} y={3} width={14} height={18} rx={1.5} {...line} />
          <Path d="M5 9h14M5 15h14M10 3v18M14.5 3v18" {...line} />
          <Circle cx={12.2} cy={12} r={1.4} fill={color} />
          <Circle cx={7.5} cy={6} r={1.4} fill={color} />
        </>
      ) : null}
      {name === "learn" ? <Path d="M3 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H3zM21 5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z" {...line} /> : null}
      {name === "kiirtan" ? <Path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10.5v3" {...line} /> : null}
      {name === "radio" ? (
        <>
          <Circle cx={12} cy={12} r={2} {...line} />
          <Path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 5.4a9.4 9.4 0 0 0 0 13.2M18.6 5.4a9.4 9.4 0 0 1 0 13.2" {...line} />
        </>
      ) : null}
      {name === "translate" ? (
        <>
          <Rect x={3} y={4} width={12} height={9} rx={2} {...line} />
          <Rect x={9} y={11} width={12} height={9} rx={2} {...line} />
          <Path d="M6.5 8.5h5M12.5 15.5h5" {...line} />
        </>
      ) : null}
    </Svg>
  )
}

/* ------------------------------------------------------------------ page */

/**
 * The page of a step: the page colour with the warm wash fading out in the first 260dp, the status area
 * above, and the side padding. `bottomExtra` leaves room (the keyboard).
 */
export function OnbPage({ theme, children, style }: { theme: SongsTheme; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets()
  const wash = theme.dark ? amOnboarding.dark.wash : amOnboarding.light.wash
  return (
    <View style={[s.page, { backgroundColor: theme.page, paddingTop: screenTopInset(insets.top), paddingBottom: Math.max(insets.bottom, 16) + 16 }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={[wash, "rgba(0,0,0,0)"]}
        locations={[0, 1]}
        style={s.wash}
      />
      {children}
    </View>
  )
}

/**
 * The body under the top row. It scrolls when the content is taller than the screen (a large system font),
 * and when it is shorter, a `flex: 1` spacer inside pushes the buttons to the bottom.
 */
export function OnbScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  )
}

/**
 * Top row: a back round, the 3-part progress bar (empty for the screens outside the numbered steps) and a
 * spacer of the round's width so the bar stays centred. There is no Skip.
 */
export function OnbTopBar({ theme, step, onBack, hideBack }: { theme: SongsTheme; step: number; onBack?: () => void; hideBack?: boolean }) {
  const t = useT()
  return (
    <View style={s.top}>
      {hideBack || !onBack ? (
        <View style={s.round} />
      ) : (
        <Press
          accessibilityRole="button"
          accessibilityLabel={t("onb.back")}
          onPress={onBack}
          pressedScale={0.94}
          style={[s.round, { backgroundColor: theme.card, borderColor: theme.line, borderWidth: 1 }]}
        >
          <OnbIcon name="back" size={20} color={theme.textHeading} />
        </Press>
      )}
      <View
        style={s.segs}
        accessible={step > 0}
        accessibilityRole="progressbar"
        accessibilityLabel={step > 0 ? t("onb.progress.a11y", { step, total: TOTAL_STEPS }) : undefined}
      >
        {step > 0
          ? Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <View key={i} style={[s.seg, { backgroundColor: i < step ? theme.accentBright : theme.trackOff }]} />
            ))
          : null}
      </View>
      <View style={s.round} />
    </View>
  )
}

/** Small step label in capitals: "Step 2 of 3" or a short name of the screen. */
export function OnbEyebrow({ theme, children }: { theme: SongsTheme; children: string }) {
  return (
    <Text style={[s.eyebrow, { color: theme.accentText }]} accessibilityRole="text">
      {children}
    </Text>
  )
}

/** The two-tone heading: the first line in the heading colour, the second in the quieter second tone. */
export function OnbHeading({ theme, first, second }: { theme: SongsTheme; first: string; second?: string }) {
  return (
    <Text style={[s.heading, { color: theme.textHeading }]} accessibilityRole="header">
      {first}
      {second ? (
        <>
          {"\n"}
          <Text style={{ color: theme.headingSecond }}>{second}</Text>
        </>
      ) : null}
    </Text>
  )
}

export function OnbSub({ theme, children }: { theme: SongsTheme; children: ReactNode }) {
  return <Text style={[s.sub, { color: theme.textBody }]}>{children}</Text>
}

export function OnbNote({ theme, children, style }: { theme: SongsTheme; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Text style={[s.note, { color: theme.textMuted }, style as object]}>{children}</Text>
}

/** A block that rises in with the staggered entrance (80ms per index), like every redesign screen. */
export const OnbReveal = SongsReveal

/* ------------------------------------------------------------------ buttons */

export type OnbTone = "brand" | "black" | "white" | "ghost" | "outline" | "quiet"

/**
 * Pill button. brand: the one primary action (orange700, white text). black / white: Apple and Google.
 * ghost: a card-coloured pill with a strong outline. outline: orange outline for the quieter choice next to
 * the primary one. quiet: text only. `tall` is the 52dp sign-in size. Press feedback on touch-down.
 */
export function OnbButton({
  theme,
  tone = "brand",
  label,
  onPress,
  icon,
  tall,
  loading,
  disabled,
  style,
}: {
  theme: SongsTheme
  tone?: OnbTone
  label: string
  onPress: () => void
  icon?: ReactNode
  tall?: boolean
  loading?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const look = buttonLook(theme, tone)
  const inactive = Boolean(disabled || loading)
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      disabled={inactive}
      onPress={onPress}
      pressedScale={tone === "quiet" ? 0.97 : 0.98}
      outerStyle={[tone === "quiet" ? s.quietOuter : null, style]}
      style={[
        s.button,
        {
          height: tone === "quiet" ? 44 : tall ? 52 : 48,
          backgroundColor: look.bg,
          borderColor: look.border,
          borderWidth: look.borderWidth,
          opacity: disabled && !loading ? 0.42 : 1,
        },
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={look.fg} /> : icon}
      <Text style={[s.buttonText, { color: look.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Press>
  )
}

function buttonLook(theme: SongsTheme, tone: OnbTone): { bg: string; fg: string; border: string; borderWidth: number } {
  switch (tone) {
    case "brand":
      return { bg: theme.brand, fg: theme.onBrand, border: "transparent", borderWidth: 0 }
    case "black":
      return { bg: amOnboarding.apple, fg: "#FFFFFF", border: theme.dark ? theme.lineStrong : amOnboarding.apple, borderWidth: 1 }
    case "white":
      return { bg: "#FFFFFF", fg: amOnboarding.googleInk, border: theme.line, borderWidth: 1 }
    case "ghost":
      return { bg: theme.card, fg: theme.textHeading, border: theme.lineStrong, borderWidth: 1 }
    case "outline":
      return { bg: "transparent", fg: theme.accentText, border: theme.accentText, borderWidth: 1.5 }
    case "quiet":
      return { bg: "transparent", fg: theme.accentText, border: "transparent", borderWidth: 0 }
  }
}

/** "What happens when I sign in >": a text link with a small chevron, 44dp tall. */
export function OnbLink({ theme, label, onPress, chevron = true, style }: { theme: SongsTheme; label: string; onPress: () => void; chevron?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Press accessibilityRole="link" accessibilityLabel={label} onPress={onPress} pressedScale={0.97} outerStyle={[s.linkOuter, style]} style={s.link}>
      <Text style={[s.linkText, { color: theme.accentText }]}>{label}</Text>
      {chevron ? <OnbIcon name="chevRight" size={18} color={theme.accentText} /> : null}
    </Press>
  )
}

/* ------------------------------------------------------------------ group, rows */

/** The card that holds rows: card colour, 20dp corners, a soft edge in the dark theme. */
export function OnbGroup({ theme, children, style }: { theme: SongsTheme; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        s.group,
        { backgroundColor: theme.card, borderColor: theme.dark ? theme.glassEdge : "transparent" },
        style,
      ]}
    >
      {children}
    </View>
  )
}

/** The radio of a list: an empty ring in the muted tone, or the filled `controlOn` disc with its dot. */
export function OnbRadio({ theme, on }: { theme: SongsTheme; on: boolean }) {
  return (
    <View
      style={[
        s.radio,
        on ? { backgroundColor: theme.controlOn, borderColor: theme.controlOn } : { borderColor: theme.textMuted },
      ]}
    >
      {on ? <View style={[s.radioDot, { backgroundColor: theme.controlOnDot }]} /> : null}
    </View>
  )
}

/* ------------------------------------------------------------------ field */

type FieldProps = Omit<TextInputProps, "style"> & {
  theme: SongsTheme
  label: string
  error?: string | null
  hint?: string | null
}

/** Labelled field: 56dp, card ground, a strong outline (3:1), a 2dp ring in `controlOn` when focused. */
export const OnbField = forwardRef<TextInput, FieldProps>(function OnbField({ theme, label, error, hint, onFocus, onBlur, ...input }, ref) {
  const [focused, setFocused] = useState(false)
  const border = error ? theme.dangerText : focused ? theme.controlOn : theme.lineStrong
  return (
    <View style={s.field}>
      <Text style={[s.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={theme.textMuted}
        selectionColor={theme.accentBright}
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
        {...input}
        style={[
          s.input,
          { backgroundColor: theme.card, borderColor: border, color: theme.textHeading, borderWidth: focused || error ? 2 : 1 },
          Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null,
        ]}
      />
      {error ? (
        <Text style={[s.fieldNote, { color: theme.dangerText }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={[s.fieldNote, { color: theme.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  )
})

/** The error box of a failed sign-in: danger outline, the sentence and a "Try again" link. */
export function OnbError({ theme, text, onRetry }: { theme: SongsTheme; text: string; onRetry?: () => void }) {
  const t = useT()
  return (
    <View style={[s.err, { backgroundColor: theme.card, borderColor: theme.dangerText }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={[s.errText, { color: theme.dangerText }]}>{text}</Text>
      {onRetry ? (
        <Press accessibilityRole="button" accessibilityLabel={t("common.tryAgain")} onPress={onRetry} pressedScale={0.96} style={s.errRetry}>
          <Text style={[s.errRetryText, { color: theme.accentText }]}>{t("common.tryAgain")}</Text>
        </Press>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: ONB_SIDE },
  wash: { position: "absolute", left: 0, right: 0, top: 0, height: 260 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  top: { height: 44, flexDirection: "row", alignItems: "center", gap: 16 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  segs: { flex: 1, flexDirection: "row", gap: 4 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  eyebrow: { marginTop: 24, fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  heading: { marginTop: 8, fontFamily: amFonts.display, fontSize: 30, lineHeight: 30, letterSpacing: -0.6, textTransform: "uppercase" },
  sub: { marginTop: 12, fontFamily: amFonts.regular, fontSize: 16, lineHeight: 23 },
  note: { fontFamily: amFonts.regular, fontSize: 13, lineHeight: 19 },
  button: { borderRadius: 70, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20 },
  buttonText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  quietOuter: { alignSelf: "stretch" },
  linkOuter: { alignSelf: "flex-start", marginTop: 12 },
  link: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 },
  linkText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  group: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  field: { gap: 8 },
  fieldLabel: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16 },
  input: { height: 56, borderRadius: 16, paddingHorizontal: 16, fontFamily: amFonts.medium, fontSize: 17 },
  fieldNote: { fontFamily: amFonts.regular, fontSize: 13, lineHeight: 19 },
  err: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1 },
  errText: { flex: 1, fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  errRetry: { minHeight: 20, justifyContent: "center" },
  errRetryText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
})
