import { ChoiceField } from "@/components/kirtan/add/ChoiceField"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { useT } from "@/lib/i18n"
import type { ChoiceOption } from "@/lib/kirtan/choiceField"
import { kindLabel } from "@/lib/kirtan/kind"
import { PS_SONG_COUNT, RECORDING_KINDS, type RecordingKind } from "@/lib/kirtan/types"

/** The kinds the add form and the playlist offer: every kind but Others, which has its own page (app/add-mantra.tsx). */
export const FORM_KINDS: readonly RecordingKind[] = RECORDING_KINDS.filter((k) => k !== "other_mantra")

/**
 * "What kind of recording": ONE row with the chosen kind and a sheet that lists the kinds, each with its short line under the name (Dada,
 * 10 Nov 2026; it replaces the six big tiles of the add form, the chips of the playlist and the chips of one track). A recording always has
 * a kind, so the sheet has no "Not chosen" row and the row carries no Required mark. Holds no state: the caller passes the kind and takes
 * the change (what a change resets is the caller's own rule). `blurbs` adds the one-line explanation of every kind in the sheet.
 */
export function KindField({ theme, label, hint, value, onChange, kinds = FORM_KINDS, blurbs = true, disabled, testID }: { theme: SongsTheme; label: string; hint?: string | null; value: RecordingKind; onChange: (next: RecordingKind) => void; kinds?: readonly RecordingKind[]; blurbs?: boolean; disabled?: boolean; testID?: string }) {
  const t = useT()
  const options: ChoiceOption[] = kinds.map((k) => ({ id: k, label: kindLabel(k), ...(blurbs ? { note: t(`ugc.add.blurb.${k}`, { count: PS_SONG_COUNT }) } : {}) }))
  return (
    <ChoiceField
      theme={theme}
      label={label}
      hint={hint}
      options={options}
      value={value}
      onChange={(next) => {
        if (next) onChange(next as RecordingKind)
      }}
      required
      showMark={false}
      disabled={disabled}
      testID={testID}
    />
  )
}
