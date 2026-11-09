import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { ChevronDown } from "lucide-react-native"

import { SpringSheet } from "@/components/assistant-v2/SpringSheet"
import { FieldError, RequiredMark } from "@/components/kirtan/add/KindFields"
import { Row, pickerStyles as p } from "@/components/kirtan/add/TagPicker"
import { Press } from "@/components/songs-v2/Press"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useT } from "@/lib/i18n"
import { choiceLabel, choiceRailText, choiceRows, pickChoice, rowIsOn, type ChoiceOption } from "@/lib/kirtan/choiceField"

type Props = {
  theme: SongsTheme
  /** field name: the first line of the row and the title of the sheet */
  label: string
  /** ONE short line of explanation, shown at the top of the sheet (not on the page) */
  hint?: string | null
  /** the choices, in the order the sheet shows them */
  options: readonly ChoiceOption[]
  /** the chosen id; null when nothing is chosen */
  value: string | null
  onChange: (next: string | null) => void
  /** the "Required" pill; false shows the quiet "Optional" and adds "Not chosen" to the top of the sheet */
  required: boolean
  /** show "Optional" in the row; a field that never showed it (the type of recording of a Bhajan) passes false */
  showOptional?: boolean
  invalid?: boolean
  errorText?: string | null
  disabled?: boolean
  /** a line under one choice in the sheet (the AI note) */
  noteOf?: (id: string) => string | undefined
  /** a line under the row while this value is chosen (the AI note is repeated there so nobody misses it) */
  below?: string | null
  testID?: string
}

/**
 * The compact choice field (Dada, 10 Nov 2026): ONE row on the form with the label (and the Required / Optional mark) on the first line and
 * the chosen value on the second, a chevron on the right. A tap opens the same white bottom sheet as the key picker and the tag picker (the
 * SpringSheet, TagPicker's rows); one tap picks and the sheet leaves. It replaces the rows of big chips of "Solo or group", "How was it
 * recorded?", "Tempo" and "Which dance?" (about 100 pt of height each became 60). The explanation moved into the sheet.
 * Holds no value: the caller passes it and takes the change. The rules: lib/kirtan/choiceField.ts.
 */
export function ChoiceField({ theme, label, hint, options, value, onChange, required, showOptional = true, invalid, errorText, disabled, noteOf, below, testID }: Props) {
  const t = useT()
  const am = useAmTheme()
  const [open, setOpen] = useState(false)
  const chosen = choiceLabel(options, value)
  const railText = choiceRailText(options, value, t("picker.none"))
  const close = () => setOpen(false)
  const choose = (picked: string | null) => {
    const next = pickChoice(value, picked, required)
    if (next.changed) onChange(next.value)
    close()
  }
  const rows = choiceRows(options, !required)

  return (
    <View style={s.root} testID={testID}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={t("picker.open", { field: label })}
        accessibilityHint={railText}
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        pressedScale={0.98}
        style={[s.rail, { backgroundColor: theme.card, borderColor: invalid ? amColors.danger : theme.line }]}
      >
        <View style={s.text}>
          <View style={s.head}>
            <Text style={[p.label, { color: theme.textHeading }]}>{label}</Text>
            {required || showOptional ? <RequiredMark theme={theme} required={required} invalid={invalid} /> : null}
          </View>
          <Text numberOfLines={1} style={[chosen ? s.value : s.none, { color: chosen ? theme.textHeading : theme.textMuted }]}>
            {railText}
          </Text>
        </View>
        <View style={[s.chevron, { backgroundColor: theme.brand }]}>
          <ChevronDown size={20} color={theme.onBrand} />
        </View>
      </Press>
      {below ? <Text style={[p.hint, { color: theme.textBody }]}>{below}</Text> : null}
      {errorText ? <FieldError theme={theme} text={errorText} /> : null}

      <SpringSheet visible={open} onClose={close} title={label} theme={am}>
        <View style={p.sheetBody}>
          {hint ? <Text style={[p.hint, { color: theme.textBody }]}>{hint}</Text> : null}
          <View style={p.listContent}>
            {rows.map((row) =>
              row.kind === "none" ? (
                <Row key="none" theme={theme} label={t("picker.none")} on={rowIsOn(row, value)} a11yLabel={t("choice.clear.a11y", { field: label })} onPress={() => choose(null)} />
              ) : (
                <Row key={row.id} theme={theme} label={row.label} on={rowIsOn(row, value)} note={noteOf?.(row.id)} onPress={() => choose(row.id)} />
              ),
            )}
          </View>
        </View>
      </SpringSheet>
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 8 },
  rail: { minHeight: 60, borderRadius: 16, borderWidth: 1, paddingLeft: 16, paddingRight: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, gap: 2 },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 4 },
  value: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22 },
  none: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  chevron: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
})
