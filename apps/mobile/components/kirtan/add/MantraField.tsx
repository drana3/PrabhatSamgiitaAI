import { TagPicker, type TagOption } from "@/components/kirtan/add/TagPicker"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { useT } from "@/lib/i18n"
import { normalizedWord } from "@/lib/kirtan/instruments"
import { isListedMantra, listedMantraFor, MANTRA_IDS, OTHER_MANTRA, type MantraValue } from "@/lib/kirtan/mantra"
import { MANTRA_TYPES } from "@/lib/kirtan/types"

export type { MantraValue }

/** the id the picker gives a name the team already accepted (it is listed for everybody, not the person's own name) */
const WORD = "word:"

const labelOfType = (id: string) => MANTRA_TYPES.find((m) => m.id === id)?.label ?? id

/**
 * "What is it" of Others (Dada, 9 Nov 2026): a REQUIRED single choice, never chips and never pre-selected. One row with the choice and a
 * Choose / Change button; it opens the same white sheet as Style and Mood with the six named ones, then "Something else", where the
 * person writes a short name. That name is held for the team like any own word (strangers see it after the team accepts it), by the same
 * queue as the main instrument's own word. Holds no state: the caller passes the value and takes the change.
 * Names and sources: docs/others-category.md; rules: lib/kirtan/mantra.ts.
 */
export function MantraField({ theme, value, onChange, accepted, newWordsPerWeek, invalid, errorText, disabled }: { theme: SongsTheme; value: MantraValue; onChange: (next: MantraValue) => void; accepted: readonly { key: string; label: string }[]; newWordsPerWeek: number; invalid?: boolean; errorText?: string | null; disabled?: boolean }) {
  const t = useT()
  const options: TagOption[] = [...MANTRA_IDS.map((id) => ({ id, label: labelOfType(id) })), ...accepted.map((a) => ({ id: `${WORD}${a.key}`, label: a.label }))]
  const acceptedKey = value.type === OTHER_MANTRA ? accepted.find((a) => a.key === normalizedWord(value.typeOther))?.key : undefined
  const tags = value.type
    ? value.type === OTHER_MANTRA
      ? acceptedKey
        ? { ids: [`${WORD}${acceptedKey}`], own: [] as string[] }
        : { ids: [] as string[], own: value.typeOther.trim() ? [value.typeOther.trim()] : [] }
      : { ids: [value.type], own: [] as string[] }
    : { ids: [] as string[], own: [] as string[] }
  const labelOf = (id: string) => (id.startsWith(WORD) ? (accepted.find((a) => `${WORD}${a.key}` === id)?.label ?? id.slice(WORD.length)) : labelOfType(id))
  return (
    <TagPicker
      theme={theme}
      label={t("mantra.type.label")}
      hint={t("mantra.type.hint")}
      required
      invalid={invalid}
      errorText={errorText}
      disabled={disabled}
      single
      options={options}
      labelOf={labelOf}
      value={tags}
      onChange={(next) => {
        const id = next.ids[0]
        if (id?.startsWith(WORD)) onChange({ type: OTHER_MANTRA, typeOther: labelOf(id) })
        else if (id && isListedMantra(id)) onChange({ type: id, typeOther: "" })
        else if (next.own[0]) onChange({ type: OTHER_MANTRA, typeOther: next.own[0] })
        else onChange({ type: null, typeOther: "" })
      }}
      listedFor={(word) => listedMantraFor(word)}
      otherLabel={t("kt.mtype.other")}
      searchPlaceholder={t("mantra.type.search")}
      ownNote={t("mantra.type.newNote", { count: newWordsPerWeek })}
      testID="mantra-field"
    />
  )
}
