import { ChoiceField } from "@/components/kirtan/add/ChoiceField"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { useT } from "@/lib/i18n"
import type { ChoiceOption } from "@/lib/kirtan/choiceField"
import { AI_TYPE, kindHasRecordingType, kindRequiresRecordingType, normalizeRecordingType, recordingTypeLabel, recordingTypesFor } from "@/lib/kirtan/recordingInfo"

/**
 * "How was it recorded": studio, live at a programme, or made by AI. REQUIRED for a Kiirtan, optional for the other kinds that carry it.
 * ONE row with a sheet (ChoiceField, Dada, 10 Nov 2026), no longer a row of big chips; holds no state (the caller passes the value and
 * takes the change). The AI note shows in the sheet and again under the row once AI is chosen. Words and rules: lib/kirtan/recordingInfo.ts,
 * docs/kiirtan-recording-info.md. The ids and the rules did not change.
 */
export function RecordingTypeField({ theme, kind, value, onChange, invalid, errorText, disabled }: { theme: SongsTheme; kind: string; value: string | null; onChange: (next: string | null) => void; invalid?: boolean; errorText?: string | null; disabled?: boolean }) {
  const t = useT()
  if (!kindHasRecordingType(kind)) return null
  const required = kindRequiresRecordingType(kind)
  const options: ChoiceOption[] = recordingTypesFor(kind).map((id) => ({ id, label: recordingTypeLabel(id) }))
  // an older draft may still say "home": it reads as the studio recording it has become
  const shown = normalizeRecordingType(value)
  return (
    <ChoiceField
      theme={theme}
      label={t("recinfo.type.field")}
      hint={t(required ? "recinfo.type.hint" : "recinfo.type.hintOptional")}
      options={options}
      value={shown}
      onChange={onChange}
      required={required}
      showOptional={required}
      invalid={invalid}
      errorText={errorText}
      disabled={disabled}
      noteOf={(id) => (id === AI_TYPE ? t("recinfo.type.aiNote") : undefined)}
      below={shown === AI_TYPE ? t("recinfo.type.aiNote") : null}
      testID="recording-type-field"
    />
  )
}
