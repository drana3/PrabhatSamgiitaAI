import { StyleSheet, Text, View } from "react-native"

import { FieldError, RequiredMark } from "@/components/kirtan/add/KindFields"
import { OwnWord, TAG_INPUT_GAP } from "@/components/kirtan/add/OwnWord"
import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { NEW_WORDS_PER_WEEK } from "@/lib/kirtan/instruments"
import { KIIRTAN_STYLES, OTHER_STYLE, similarStyle, STYLE_OTHER_MAX, styleChoices, styleLabel } from "@/lib/kirtan/styles"

export type StyleValue = { style: string | null; styleOther: string }

/**
 * "Indian Kiirtan / style": an optional field of a Kiirtan (never of the other kinds). A short row of choices, "Not sure" to
 * leave it empty, and "Other" which asks for the style's name. Holds no state: the caller passes the value and takes the change.
 * Rules and the list: lib/kirtan/styles.ts. Renders nothing for any other kind.
 */
export function StyleField({ theme, kind, value, onChange, invalid, errorText, disabled }: { theme: SongsTheme; kind: string; value: StyleValue; onChange: (next: StyleValue) => void; invalid?: boolean; errorText?: string | null; disabled?: boolean }) {
  const t = useT()
  if (kind !== "kiirtan") return null
  // the style of a Kiirtan is required: there is no "not sure" choice, "Other" and its name is the way out
  const choices = styleChoices()
  const current = value.style ?? ""
  // "Dhrupat" is offered "Dhrupad"; a name that IS a listed style is turned into it before it is sent
  const near = current === OTHER_STYLE ? similarStyle(value.styleOther) : null
  const listed = current === OTHER_STYLE ? KIIRTAN_STYLES.find((id) => id === value.styleOther.trim().toLowerCase()) : undefined
  const pick = near ?? listed
  const suggestion = pick ? { question: near ? t("instrument.didYouMean", { name: styleLabel(pick) }) : undefined, actionLabel: t("instrument.useListed", { name: styleLabel(pick) }), onUse: () => onChange({ style: pick, styleOther: "" }) } : null
  return (
    <View style={s.root}>
      <View style={s.head}>
        <Text style={[s.label, { color: theme.textHeading }]}>{t("style.field")}</Text>
        <RequiredMark theme={theme} required invalid={invalid} />
      </View>
      <Text style={[s.hint, { color: theme.textBody }]}>{t("ugc.form.style.hint")}</Text>
      <View style={s.tags}>
        <View style={s.chips}>
          {choices.map((c) => {
            const on = current === c.id
            return (
              <Press
                key={c.id || "none"}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: !!disabled }}
                disabled={disabled}
                accessibilityLabel={c.label}
                onPress={() => onChange({ style: c.id || null, styleOther: c.id === OTHER_STYLE ? value.styleOther : "" })}
                pressedScale={0.95}
                style={[s.chip, { backgroundColor: on ? theme.brand : theme.card, borderColor: on ? theme.brand : invalid ? amColors.danger : theme.line }]}
              >
                <Text style={[s.chipText, { color: on ? theme.onBrand : theme.textHeading }]}>{c.label}</Text>
              </Press>
            )
          })}
        </View>
        {current === OTHER_STYLE ? (
          <OwnWord
            theme={theme}
            value={value.styleOther}
            onChange={(text) => onChange({ style: OTHER_STYLE, styleOther: text })}
            placeholder={t("style.otherName")}
            maxLength={STYLE_OTHER_MAX}
            note={t("instrument.newNote", { count: NEW_WORDS_PER_WEEK })}
            suggestion={suggestion}
            disabled={disabled}
          />
        ) : null}
      </View>
      {errorText ? <FieldError theme={theme} text={errorText} /> : null}
    </View>
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
