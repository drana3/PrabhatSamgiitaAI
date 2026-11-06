import type { ReactNode } from "react"
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"

import { KPress } from "@/components/kirtan/KPress"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"

/**
 * Small pieces shared by the Upload hub, the "offer chords" flow and the review screen. Square-cornered (2 px) on
 * purpose: chords are written, not tapped like bubbles. Colours come from the app's own tokens (SongsTheme).
 */
/** Soft corners of the song page: cards and fields 20, round buttons and chips, a small box for the check mark. */
export const CORNER = 20
export const PILL = 9999
export const BOX = 8

export function Label({ theme, children }: { theme: SongsTheme; children: ReactNode }) {
  return <Text style={[s.label, { color: theme.textHeading }]}>{children}</Text>
}

export function Hint({ theme, children, tone = "body" }: { theme: SongsTheme; children: ReactNode; tone?: "body" | "danger" }) {
  return (
    <Text style={[s.hint, { color: tone === "danger" ? theme.dangerText : theme.textBody }]} accessibilityLiveRegion={tone === "danger" ? "polite" : undefined}>
      {children}
    </Text>
  )
}

export function Chip({
  theme,
  label,
  on,
  onPress,
  a11y,
  minWidth,
  role = "radio",
  danger,
}: {
  theme: SongsTheme
  label: string
  on?: boolean
  onPress: () => void
  a11y?: string
  minWidth?: number
  role?: "radio" | "button" | "checkbox"
  danger?: boolean
}) {
  return (
    <KPress
      accessibilityRole={role}
      accessibilityLabel={a11y ?? label}
      accessibilityState={role === "button" ? undefined : { selected: Boolean(on), checked: role === "checkbox" ? Boolean(on) : undefined }}
      onPress={onPress}
      pressedScale={0.96}
      style={[
        s.chip,
        { minWidth },
        { backgroundColor: on ? theme.ink900 : theme.card, borderColor: on ? theme.ink900 : danger ? theme.dangerText : theme.line },
      ]}
    >
      <Text style={[s.chipText, { color: on ? theme.onInk : danger ? theme.dangerText : theme.textHeading }]} numberOfLines={1}>
        {label}
      </Text>
    </KPress>
  )
}

export function ActionButton({
  theme,
  label,
  onPress,
  disabled,
  busy,
  tone = "primary",
  style,
}: {
  theme: SongsTheme
  label: string
  onPress: () => void
  disabled?: boolean
  busy?: boolean
  tone?: "primary" | "quiet"
  style?: StyleProp<ViewStyle>
}) {
  const primary = tone === "primary"
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(busy) }}
      onPress={disabled ? undefined : onPress}
      pressedScale={0.98}
      outerStyle={style}
      style={[s.button, primary ? { backgroundColor: amColors.orange700 } : { backgroundColor: theme.card, borderColor: theme.line, borderWidth: 1.5 }, { opacity: disabled ? 0.55 : 1 }]}
    >
      <Text style={[s.buttonText, { color: primary ? "#FFFFFF" : theme.textHeading }]}>{label}</Text>
    </KPress>
  )
}

export function CheckRow({ theme, on, label, onToggle, invalid }: { theme: SongsTheme; on: boolean; label: string; onToggle: () => void; invalid?: boolean }) {
  return (
    <KPress accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onToggle} pressedScale={0.99} style={s.check}>
      <View style={[s.box, { borderColor: on ? amColors.orange700 : invalid ? amColors.danger : theme.textBody, backgroundColor: on ? amColors.orange700 : "transparent" }]}>
        {on ? <PlayerIcon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} /> : null}
      </View>
      <Text style={[s.checkText, { color: theme.textHeading }]}>{label}</Text>
    </KPress>
  )
}

const s = StyleSheet.create({
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: PILL, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  button: { minHeight: 56, borderRadius: PILL, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  buttonText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, textAlign: "center" },
  check: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 6, minHeight: 44 },
  box: { width: 26, height: 26, borderRadius: BOX, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkText: { flex: 1, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21 },
})
