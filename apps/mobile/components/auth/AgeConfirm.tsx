import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { Press } from "@/components/songs-v2/Press"
import { amFonts } from "@/constants/tokens/amTypography"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { useT } from "@/lib/i18n"

/**
 * "I'm 16 or older": the tick on the create-account form (docs/age-confirmation.md). Never pre-ticked.
 * When `invalid` (the person pressed Create account without it) the box turns red and the sentence appears.
 */
export function AgeCheckbox({
  theme,
  checked,
  invalid,
  disabled,
  onToggle,
}: {
  theme: SongsTheme
  checked: boolean
  invalid?: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  const t = useT()
  const label = t("account.age.confirm")
  const edge = checked ? theme.controlOn : invalid ? theme.dangerText : theme.textBody
  return (
    <View style={styles.wrap}>
      <Press
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: Boolean(disabled) }}
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onToggle}
        pressedScale={0.99}
        style={styles.row}
      >
        <View style={[styles.box, { borderColor: edge, backgroundColor: checked ? theme.controlOn : "transparent" }]}>
          {checked ? <PlayerIcon name="check" size={16} color={theme.controlOnDot} strokeWidth={2.5} /> : null}
        </View>
        <Text style={[styles.label, { color: theme.textHeading }]}>{label}</Text>
      </Press>
      {invalid ? (
        <Text style={[styles.error, { color: theme.dangerText }]} accessibilityRole="alert">
          {t("account.age.required")}
        </Text>
      ) : null}
    </View>
  )
}

/** The line under the Apple / Google buttons: no tick there, the button press is the confirmation. */
export function AgeNotice({ theme, style }: { theme: SongsTheme; style?: StyleProp<TextStyle> }) {
  const t = useT()
  return <Text style={[styles.notice, { color: theme.textMuted }, style]}>{t("account.age.line")}</Text>
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 6 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21 },
  error: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingLeft: 40 },
  notice: { textAlign: "center", paddingHorizontal: 8, fontFamily: amFonts.regular, fontSize: 13, lineHeight: 19 },
})
