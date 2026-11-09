import { TagPicker, type TagOption } from "@/components/kirtan/add/TagPicker"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { useT } from "@/lib/i18n"
import { formInstrumentChoices, instrumentLabel, isInstrumentId, kindHasInstrument, listedInstrumentFor, normalizedWord, OTHER_INSTRUMENT, similarInstrument } from "@/lib/kirtan/instruments"
import type { TagValue } from "@/lib/kirtan/tags"

export type InstrumentValue = { instrument: string | null; instrumentOther: string }

/** the id the picker gives a word the team already accepted (it is listed for everybody, not the person's own word) */
const WORD = "word:"

/**
 * "Main instrument": an optional field of every kind of music, as the compact picker with ONE choice: guitar, harmonium, piano, voice
 * only (a cappella), the words the team accepted from other people, and "add your own". A word that IS a listed instrument becomes it
 * and one almost like it is offered as "Did you mean" (lib/kirtan/tags.ts and instruments.ts). Holds no state: the caller passes the
 * value and takes the change. Rules and the list: lib/kirtan/instruments.ts, docs/kiirtan-recording-info.md ("Add your own").
 */
export function InstrumentField({ theme, kind, value, onChange, accepted, newWordsPerWeek, invalid, errorText, disabled }: { theme: SongsTheme; kind: string; value: InstrumentValue; onChange: (next: InstrumentValue) => void; accepted: readonly { key: string; label: string }[]; newWordsPerWeek: number; invalid?: boolean; errorText?: string | null; disabled?: boolean }) {
  const t = useT()
  if (!kindHasInstrument(kind)) return null
  const options: TagOption[] = [...formInstrumentChoices(), ...accepted.map((a) => ({ id: `${WORD}${a.key}`, label: a.label }))]
  const acceptedKey = value.instrument === OTHER_INSTRUMENT ? accepted.find((a) => a.key === normalizedWord(value.instrumentOther))?.key : undefined
  const tags: TagValue = value.instrument
    ? value.instrument === OTHER_INSTRUMENT
      ? acceptedKey
        ? { ids: [`${WORD}${acceptedKey}`], own: [] }
        : { ids: [], own: value.instrumentOther.trim() ? [value.instrumentOther.trim()] : [] }
      : { ids: [value.instrument], own: [] }
    : { ids: [], own: [] }
  const labelOf = (id: string) => (id.startsWith(WORD) ? (accepted.find((a) => `${WORD}${a.key}` === id)?.label ?? id.slice(WORD.length)) : instrumentLabel(id))
  return (
    <TagPicker
      theme={theme}
      label={t("instrument.field")}
      hint={t("instrument.hint")}
      invalid={invalid}
      errorText={errorText}
      disabled={disabled}
      single
      options={options}
      labelOf={labelOf}
      value={tags}
      onChange={(next) => {
        const id = next.ids[0]
        if (id?.startsWith(WORD)) onChange({ instrument: OTHER_INSTRUMENT, instrumentOther: labelOf(id) })
        else if (id && isInstrumentId(id)) onChange({ instrument: id, instrumentOther: "" })
        else if (next.own[0]) onChange({ instrument: OTHER_INSTRUMENT, instrumentOther: next.own[0] })
        else onChange({ instrument: null, instrumentOther: "" })
      }}
      listedFor={(word) => listedInstrumentFor(word)}
      similar={(word) => similarInstrument(word)}
      ownNote={t("instrument.newNote", { count: newWordsPerWeek })}
      testID="instrument-field"
    />
  )
}
