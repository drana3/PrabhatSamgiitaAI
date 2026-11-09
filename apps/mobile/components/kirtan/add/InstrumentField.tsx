import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { FieldError, RequiredMark } from "@/components/kirtan/add/KindFields"
import { OwnWord, TAG_INPUT_GAP } from "@/components/kirtan/add/OwnWord"
import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { instrumentChoices, instrumentLabel, kindHasInstrument, listedInstrumentFor, normalizedWord, OTHER_INSTRUMENT, similarInstrument, WORD_MAX } from "@/lib/kirtan/instruments"

export type InstrumentValue = { instrument: string | null; instrumentOther: string }

/**
 * "Main instrument": an optional field of every kind of music. A row of picks (the fixed list, then the words the team
 * accepted from other people), and "Add your own", which asks for a word. A word almost like a listed instrument ("harmonyum")
 * is offered the listed one before it is sent ("Did you mean Harmonium?"). The note says the team checks new words and how many
 * one person may add a week. Holds no state but which pick is open: the caller passes the value and takes the change.
 * Rules and the list: lib/kirtan/instruments.ts, docs/kiirtan-recording-info.md ("Add your own").
 */
export function InstrumentField({ theme, kind, value, onChange, accepted, newWordsPerWeek, invalid, errorText, disabled }: { theme: SongsTheme; kind: string; value: InstrumentValue; onChange: (next: InstrumentValue) => void; accepted: readonly { key: string; label: string }[]; newWordsPerWeek: number; invalid?: boolean; errorText?: string | null; disabled?: boolean }) {
  const t = useT()
  const word = value.instrumentOther
  const isAccepted = (text: string) => !!normalizedWord(text) && accepted.some((a) => a.key === normalizedWord(text))
  // "Add your own" is open while the person writes; a tap on an accepted word closes it
  const [writing, setWriting] = useState(value.instrument === OTHER_INSTRUMENT && !isAccepted(word))
  if (!kindHasInstrument(kind)) return null
  const current = value.instrument ?? ""
  const choices = instrumentChoices().filter((c) => c.id !== OTHER_INSTRUMENT)
  const showInput = current === OTHER_INSTRUMENT && writing
  const sameAsListed = showInput ? listedInstrumentFor(word) : null
  const didYouMean = showInput ? similarInstrument(word) : null
  const pick = (id: string) => {
    setWriting(false)
    onChange(current === id ? { instrument: null, instrumentOther: "" } : { instrument: id, instrumentOther: "" })
  }
  const suggested = sameAsListed ?? didYouMean
  const suggestion = suggested ? { question: sameAsListed ? undefined : t("instrument.didYouMean", { name: instrumentLabel(suggested) }), actionLabel: t("instrument.useListed", { name: instrumentLabel(suggested) }), onUse: () => pick(suggested) } : null
  return (
    <View style={s.root}>
      <View style={s.head}>
        <Text style={[s.label, { color: theme.textHeading }]}>{t("instrument.field")}</Text>
        <RequiredMark theme={theme} required={false} />
      </View>
      <Text style={[s.hint, { color: theme.textBody }]}>{t("instrument.hint")}</Text>
      <View style={s.tags}>
        <View style={s.chips}>
          {choices.map((c) => (
            <Chip key={c.id} theme={theme} label={c.label} on={current === c.id} invalid={invalid} disabled={disabled} onPress={() => pick(c.id)} />
          ))}
          {accepted.map((a) => (
            <Chip key={`word-${a.key}`} theme={theme} label={a.label} on={current === OTHER_INSTRUMENT && !writing && normalizedWord(word) === a.key} invalid={invalid} disabled={disabled} onPress={() => {
              setWriting(false)
              const on = current === OTHER_INSTRUMENT && normalizedWord(word) === a.key
              onChange(on ? { instrument: null, instrumentOther: "" } : { instrument: OTHER_INSTRUMENT, instrumentOther: a.label })
            }} />
          ))}
          <Chip theme={theme} label={t("instrument.addOwn")} on={showInput} invalid={invalid} disabled={disabled} onPress={() => {
            if (showInput) {
              setWriting(false)
              onChange({ instrument: null, instrumentOther: "" })
            } else {
              setWriting(true)
              onChange({ instrument: OTHER_INSTRUMENT, instrumentOther: "" })
            }
          }} />
        </View>
        {showInput ? (
          <OwnWord
            theme={theme}
            value={word}
            onChange={(text) => onChange({ instrument: OTHER_INSTRUMENT, instrumentOther: text })}
            placeholder={t("instrument.otherName")}
            maxLength={WORD_MAX}
            note={t("instrument.newNote", { count: newWordsPerWeek })}
            suggestion={suggestion}
            invalid={invalid}
            disabled={disabled}
          />
        ) : null}
      </View>
      {errorText ? <FieldError theme={theme} text={errorText} /> : null}
    </View>
  )
}

function Chip({ theme, label, on, invalid, disabled, onPress }: { theme: SongsTheme; label: string; on: boolean; invalid?: boolean; disabled?: boolean; onPress: () => void }) {
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
  tags: { gap: TAG_INPUT_GAP },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 70, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
})
