import { ChoiceField } from "@/components/kirtan/add/ChoiceField"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { useT } from "@/lib/i18n"
import type { ChoiceOption } from "@/lib/kirtan/choiceField"
import { kindHasPerformance, kindHasTempo, kindRequiresPerformance, PERFORMANCES, performanceLabel, TEMPO_IDS, tempoLabel } from "@/lib/kirtan/recordingInfo"
import { DANCES, type DanceId } from "@/lib/kirtan/types"

/**
 * "Solo or group" (REQUIRED for a Kiirtan, optional for a Bhajan), "Tempo" (optional; Dance music) and "Which dance?" (Dance music,
 * required): each ONE row with a sheet (ChoiceField, Dada, 10 Nov 2026), no longer a row of big chips. No state: the caller passes the
 * value and takes the change. Ids, words and rules: lib/kirtan/recordingInfo.ts, lib/kirtan/types.ts.
 */
export function PerformanceField({ theme, kind, value, onChange, invalid, errorText, disabled }: { theme: SongsTheme; kind: string; value: string | null; onChange: (next: string | null) => void; invalid?: boolean; errorText?: string | null; disabled?: boolean }) {
  const t = useT()
  if (!kindHasPerformance(kind)) return null
  const required = kindRequiresPerformance(kind)
  const options: ChoiceOption[] = PERFORMANCES.map((id) => ({ id, label: performanceLabel(id) }))
  return (
    <ChoiceField
      theme={theme}
      label={t("recinfo.performance.field")}
      hint={required ? t("recinfo.performance.hint") : null}
      options={options}
      value={value}
      onChange={onChange}
      required={required}
      invalid={invalid}
      errorText={errorText}
      disabled={disabled}
      testID="performance-field"
    />
  )
}

export function TempoField({ theme, kind, value, onChange, disabled }: { theme: SongsTheme; kind: string; value: string | null; onChange: (next: string | null) => void; disabled?: boolean }) {
  const t = useT()
  if (!kindHasTempo(kind)) return null
  const options: ChoiceOption[] = TEMPO_IDS.map((id) => ({ id, label: tempoLabel(id) }))
  return <ChoiceField theme={theme} label={t("recinfo.tempo.field")} hint={t("recinfo.tempo.hint")} options={options} value={value} onChange={onChange} required={false} disabled={disabled} testID="tempo-field" />
}

function danceOptions(t: (key: string) => string): ChoiceOption[] {
  return DANCES.map((dance) => ({ id: dance, label: t(`rec.dance.${dance}`) }))
}

/** A Dance music's dance: Tandava or Kaoshiki. Always required, so the sheet has no "Not chosen" row. The list is lib/kirtan/types.ts DANCES. */
export function DanceField({ theme, value, onChange, invalid, errorText, disabled }: { theme: SongsTheme; value: DanceId | null; onChange: (dance: DanceId) => void; invalid?: boolean; errorText?: string | null; disabled?: boolean }) {
  const t = useT()
  return (
    <ChoiceField
      theme={theme}
      label={t("rec.dance.label")}
      hint={t("rec.dance.hint")}
      options={danceOptions(t as (key: string) => string)}
      value={value}
      onChange={(next) => {
        if (next) onChange(next as DanceId)
      }}
      required
      invalid={invalid}
      errorText={errorText}
      disabled={disabled}
      testID="dance-field"
    />
  )
}

/**
 * The dance inside a card of the bulk queue (one file, or "for every file"): a small pill with the chosen dance (or "Choose") and a chevron;
 * the caller draws the label and the Required mark beside it. The same sheet as the form's field. It replaced the small Tandava / Kaoshiki chips.
 */
export function DanceMenu({ theme, value, onChange, invalid, disabled }: { theme: SongsTheme; value: DanceId | null; onChange: (dance: DanceId) => void; invalid?: boolean; disabled?: boolean }) {
  const t = useT()
  return (
    <ChoiceField
      theme={theme}
      inline
      label={t("rec.dance.label")}
      hint={t("rec.dance.hint")}
      options={danceOptions(t as (key: string) => string)}
      value={value}
      onChange={(next) => {
        if (next) onChange(next as DanceId)
      }}
      required
      invalid={invalid}
      disabled={disabled}
      testID="dance-menu"
    />
  )
}
