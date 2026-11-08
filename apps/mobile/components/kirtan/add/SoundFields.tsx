import { StyleSheet, Text, View } from "react-native"

import { FieldError, RequiredMark } from "@/components/kirtan/add/KindFields"
import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { kindHasPerformance, kindHasTempo, kindRequiresPerformance, PERFORMANCES, performanceLabel, TEMPO_IDS, tempoLabel } from "@/lib/kirtan/recordingInfo"

/**
 * "Solo or group" (REQUIRED for a Kiirtan, optional for a Bhajan) and "Tempo" (optional; a Kiirtan and Dance music). Two short
 * rows of choices; no state: the caller passes the value and takes the change. Ids, words and rules: lib/kirtan/recordingInfo.ts.
 */
export function PerformanceField({ theme, kind, value, onChange, invalid, errorText, disabled }: { theme: SongsTheme; kind: string; value: string | null; onChange: (next: string | null) => void; invalid?: boolean; errorText?: string | null; disabled?: boolean }) {
  const t = useT()
  if (!kindHasPerformance(kind)) return null
  const required = kindRequiresPerformance(kind)
  return (
    <View style={s.root}>
      <View style={s.head}>
        <Text style={[s.label, { color: theme.textHeading }]}>{t("recinfo.performance.field")}</Text>
        <RequiredMark theme={theme} required={required} invalid={invalid} />
      </View>
      {required ? <Text style={[s.hint, { color: theme.textBody }]}>{t("recinfo.performance.hint")}</Text> : null}
      <View style={s.chips}>
        {PERFORMANCES.map((id) => (
          <ChoiceChip key={id} theme={theme} label={performanceLabel(id)} on={value === id} invalid={invalid} disabled={disabled} onPress={() => onChange(value === id && !required ? null : id)} />
        ))}
      </View>
      {errorText ? <FieldError theme={theme} text={errorText} /> : null}
    </View>
  )
}

export function TempoField({ theme, kind, value, onChange, disabled }: { theme: SongsTheme; kind: string; value: string | null; onChange: (next: string | null) => void; disabled?: boolean }) {
  const t = useT()
  if (!kindHasTempo(kind)) return null
  return (
    <View style={s.root}>
      <View style={s.head}>
        <Text style={[s.label, { color: theme.textHeading }]}>{t("recinfo.tempo.field")}</Text>
        <RequiredMark theme={theme} required={false} />
      </View>
      <Text style={[s.hint, { color: theme.textBody }]}>{t("recinfo.tempo.hint")}</Text>
      <View style={s.chips}>
        {TEMPO_IDS.map((id) => (
          <ChoiceChip key={id} theme={theme} label={tempoLabel(id)} on={value === id} disabled={disabled} onPress={() => onChange(value === id ? null : id)} />
        ))}
      </View>
    </View>
  )
}

function ChoiceChip({ theme, label, on, invalid, disabled, onPress }: { theme: SongsTheme; label: string; on: boolean; invalid?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled: !!disabled }}
      disabled={disabled}
      accessibilityLabel={label}
      onPress={onPress}
      pressedScale={0.95}
      style={[s.chip, { backgroundColor: on ? theme.brand : theme.card, borderColor: on ? theme.brand : invalid ? amColors.danger : theme.line }]}
    >
      <Text style={[s.chipText, { color: on ? theme.onBrand : theme.textHeading }]}>{label}</Text>
    </Press>
  )
}

const s = StyleSheet.create({
  root: { gap: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 70, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
})
