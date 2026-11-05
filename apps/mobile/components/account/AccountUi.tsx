import { forwardRef, useState, type ReactNode } from "react"
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native"

import { SpRound } from "@/components/song-v2/SpUi"
import { LIST_SIDE } from "@/components/songs-v2/ListParts"
import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSpTheme } from "@/hooks/useSpTheme"

/** Side padding of the account pages. */
export const ACCOUNT_SIDE = LIST_SIDE

/** The 54px status area of the phone frame in the web preview; the real inset on a phone. */
export function topInset(insetTop: number): number {
  return Platform.OS === "web" ? 54 : insetTop
}

/** Back round and the page title in capitals (same bar as Your library). */
export function AccountBar({ theme, title, onBack, inset }: { theme: SongsTheme; title: string; onBack: () => void; inset: number }) {
  const sp = useSpTheme()
  return (
    <View style={{ paddingTop: inset, backgroundColor: theme.page }}>
      <View style={s.titleRow}>
        <SpRound t={sp} icon="back" label="Back" onPress={onBack} />
        <Text style={[s.barTitle, { color: theme.textHeading }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      </View>
    </View>
  )
}

/** Quiet error line: danger text, no box. */
export function InlineError({ theme, children, onRetry, retryLabel = "Try again" }: { theme: SongsTheme; children: ReactNode; onRetry?: () => void; retryLabel?: string }) {
  return (
    <View style={s.errorRow} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={[s.errorText, { color: theme.dangerText }]}>{children}</Text>
      {onRetry ? (
        <Press accessibilityRole="button" accessibilityLabel={retryLabel} onPress={onRetry} pressedScale={0.96} style={s.retryBtn}>
          <Text style={[s.retryText, { color: theme.accent }]}>{retryLabel}</Text>
        </Press>
      ) : null}
    </View>
  )
}

type FieldProps = Omit<TextInputProps, "style"> & {
  theme: SongsTheme
  label: string
  error?: string | null
  hint?: string | null
  /** right side of the label line (a counter) */
  aside?: string | null
}

/** Labelled text field: 56dp, card ground, hairline; the border turns bright orange on focus. Errors sit under it. */
export const AccountField = forwardRef<TextInput, FieldProps>(function AccountField({ theme, label, error, hint, aside, onFocus, onBlur, ...input }, ref) {
  const [focused, setFocused] = useState(false)
  const border = error ? theme.dangerText : focused ? theme.accentBright : theme.line
  return (
    <View style={s.field}>
      <View style={s.labelRow}>
        <Text style={[s.label, { color: theme.textBody }]}>{label}</Text>
        {aside ? <Text style={[s.aside, { color: theme.textMuted }]}>{aside}</Text> : null}
      </View>
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

export type ButtonTone = "brand" | "black" | "white" | "quiet"

/**
 * Full-width 52dp pill. brand: orange700 with white text (the one primary action). black: Apple.
 * white: Google, hairline edge. quiet: text only. Press feedback on touch-down; `loading` shows a spinner and blocks taps.
 */
export function AccountButton({
  theme,
  label,
  onPress,
  tone = "brand",
  icon,
  loading,
  disabled,
  style,
  accessibilityLabel,
}: {
  theme: SongsTheme
  label: string
  onPress: () => void
  tone?: ButtonTone
  icon?: ReactNode
  loading?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  const look = buttonLook(theme, tone)
  const inactive = Boolean(disabled || loading)
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      disabled={inactive}
      onPress={onPress}
      pressedScale={tone === "quiet" ? 0.97 : 0.98}
      outerStyle={style}
      style={[s.button, { backgroundColor: look.bg, borderColor: look.border, borderWidth: look.border === "transparent" ? 0 : 1, opacity: disabled && !loading ? 0.45 : 1 }]}
    >
      {loading ? <ActivityIndicator size="small" color={look.fg} /> : icon}
      <Text style={[s.buttonText, { color: look.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Press>
  )
}

function buttonLook(theme: SongsTheme, tone: ButtonTone): { bg: string; fg: string; border: string } {
  switch (tone) {
    case "brand":
      return { bg: theme.brand, fg: theme.onBrand, border: "transparent" }
    case "black":
      return { bg: "#000000", fg: "#FFFFFF", border: theme.dark ? "rgba(255,255,255,0.28)" : "#000000" }
    case "white":
      return { bg: "#FFFFFF", fg: "#1F1F1F", border: theme.dark ? "rgba(255,255,255,0.28)" : "#C9C4BF" }
    case "quiet":
      return { bg: "transparent", fg: theme.accent, border: "transparent" }
  }
}

const s = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 10, paddingRight: LIST_SIDE, height: 56 },
  barTitle: { flex: 1, fontFamily: amFonts.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.6, textTransform: "uppercase" },
  errorRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12 },
  errorText: { flexShrink: 1, fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  retryBtn: { minHeight: 44, justifyContent: "center" },
  retryText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
  field: { gap: 8 },
  labelRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  label: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, letterSpacing: 0.4 },
  aside: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  input: { height: 56, borderRadius: 16, paddingHorizontal: 16, fontFamily: amFonts.medium, fontSize: 17 },
  fieldNote: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  button: { height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 20 },
  buttonText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
})
