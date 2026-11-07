import { StyleSheet, Text, TextInput, View } from "react-native"

import { RequiredMark } from "@/components/kirtan/add/KindFields"
import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { OTHER_STYLE, STYLE_OTHER_MAX, styleChoices } from "@/lib/kirtan/styles"

export type StyleValue = { style: string | null; styleOther: string }

/**
 * "Indian Kiirtan / style": an optional field of a Kiirtan (never of the other kinds). A short row of choices, "Not sure" to
 * leave it empty, and "Other" which asks for the style's name. Holds no state: the caller passes the value and takes the change.
 * Rules and the list: lib/kirtan/styles.ts. Renders nothing for any other kind.
 */
export function StyleField({ theme, kind, value, onChange }: { theme: SongsTheme; kind: string; value: StyleValue; onChange: (next: StyleValue) => void }) {
  const t = useT()
  if (kind !== "kiirtan") return null
  const choices = [{ id: "", label: t("style.none") }, ...styleChoices()]
  const current = value.style ?? ""
  return (
    <View style={s.root}>
      <View style={s.head}>
        <Text style={[s.label, { color: theme.textHeading }]}>{t("style.field")}</Text>
        <RequiredMark theme={theme} required={false} />
      </View>
      <Text style={[s.hint, { color: theme.textBody }]}>{t("style.field.hint")}</Text>
      <View style={s.chips}>
        {choices.map((c) => {
          const on = current === c.id
          return (
            <Press
              key={c.id || "none"}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={c.label}
              onPress={() => onChange({ style: c.id || null, styleOther: c.id === OTHER_STYLE ? value.styleOther : "" })}
              pressedScale={0.95}
              style={[s.chip, { backgroundColor: on ? theme.brand : theme.card, borderColor: on ? theme.brand : theme.line }]}
            >
              <Text style={[s.chipText, { color: on ? theme.onBrand : theme.textHeading }]}>{c.label}</Text>
            </Press>
          )
        })}
      </View>
      {current === OTHER_STYLE ? (
        <TextInput
          value={value.styleOther}
          onChangeText={(text) => onChange({ style: OTHER_STYLE, styleOther: text.slice(0, STYLE_OTHER_MAX) })}
          placeholder={t("style.otherName")}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t("style.otherName")}
          maxLength={STYLE_OTHER_MAX}
          style={[s.input, { color: theme.textHeading, backgroundColor: theme.card, borderColor: theme.line }]}
        />
      ) : null}
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
  input: { minHeight: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, fontFamily: amFonts.medium, fontSize: 16 },
})
