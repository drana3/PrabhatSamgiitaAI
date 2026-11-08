import { StyleSheet, Text, View } from "react-native"

import { FieldError, RequiredMark } from "@/components/kirtan/add/KindFields"
import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { kindHasRecordingType, kindRequiresRecordingType, recordingTypeLabel, recordingTypesFor } from "@/lib/kirtan/recordingInfo"

/**
 * "How was it recorded": studio, live at a programme, at home, or made by AI. REQUIRED for a Kiirtan, optional for the
 * other kinds that carry it. A short row of choices; holds no state (the caller passes the value and takes the change).
 * Words and rules: lib/kirtan/recordingInfo.ts, docs/kiirtan-recording-info.md. This is the form's stop-gap until the upload
 * wizard replaces it (docs/kiirtan-upload-wizard.md is a proposal); the ids and the rules stay.
 */
export function RecordingTypeField({ theme, kind, value, onChange, invalid, errorText, disabled }: { theme: SongsTheme; kind: string; value: string | null; onChange: (next: string | null) => void; invalid?: boolean; errorText?: string | null; disabled?: boolean }) {
  const t = useT()
  if (!kindHasRecordingType(kind)) return null
  const required = kindRequiresRecordingType(kind)
  return (
    <View style={s.root}>
      <View style={s.head}>
        <Text style={[s.label, { color: theme.textHeading }]}>{t("recinfo.type.field")}</Text>
        {required ? <RequiredMark theme={theme} required invalid={invalid} /> : null}
      </View>
      <Text style={[s.hint, { color: theme.textBody }]}>{t(required ? "recinfo.type.hint" : "recinfo.type.hintOptional")}</Text>
      <View style={s.chips}>
        {recordingTypesFor(kind).map((id) => {
          const on = value === id
          return (
            <Press
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: !!disabled }}
              disabled={disabled}
              accessibilityLabel={recordingTypeLabel(id)}
              onPress={() => onChange(on && !required ? null : id)}
              pressedScale={0.95}
              style={[s.chip, { backgroundColor: on ? theme.brand : theme.card, borderColor: on ? theme.brand : invalid ? amColors.danger : theme.line }]}
            >
              <Text style={[s.chipText, { color: on ? theme.onBrand : theme.textHeading }]}>{recordingTypeLabel(id)}</Text>
            </Press>
          )
        })}
      </View>
      {value === "ai" ? <Text style={[s.hint, { color: theme.textBody }]}>{t("recinfo.type.aiNote")}</Text> : null}
      {errorText ? <FieldError theme={theme} text={errorText} /> : null}
    </View>
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
