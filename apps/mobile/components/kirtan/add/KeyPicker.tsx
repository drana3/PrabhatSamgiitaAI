import { useMemo, useState } from "react"
import { ScrollView, Text, TextInput, View } from "react-native"
import { Plus, Search } from "lucide-react-native"

import { SpringSheet } from "@/components/assistant-v2/SpringSheet"
import { Row, pickerStyles as s, useKeyboardHeight } from "@/components/kirtan/add/TagPicker"
import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useT } from "@/lib/i18n"
import { keyRailText, keyRows, type KeyOption } from "@/lib/kirtan/keyPicker"

type Props = {
  theme: SongsTheme
  /** field name above the line, and the title of the sheet */
  label: string
  /** ONE short line of explanation, shown at the top of the sheet (not on the page) */
  explain: string
  /** the notes offered, in the order the sheet shows them */
  options: readonly KeyOption[]
  /** the chosen note; "" means "Not sure" */
  value: string
  onChange: (next: string) => void
  /** the words for "no answer" (Key of this tune: "Not sure"); null when the field must have a note */
  noneLabel?: string | null
  /** "Same as previous tune": a row that sets the note from the tune before and closes the sheet; omit when there is no tune before */
  sameLabel?: string | null
  onSame?: () => void
  /** a line under a note in the list (the usual chords of that key) */
  noteOf?: (id: string) => string | null
  /** screen-reader name of one note row ("Key D") */
  a11yOf?: (id: string) => string
  testID?: string
}

/**
 * The compact key field (Dada, 9 Nov 2026, part 2): the same one line as Style and Mood (the chosen note and a round "+"), a tap opens
 * the same bottom sheet with a search box and a scrollable list. One choice: a tap picks the note and the sheet leaves. Used for "Which
 * key do you play in?" (Prabhat Samgiita, Bhajan and Spiritual song chords), "Key of this tune" (Kiirtan chord cycle) and "Where does
 * Sa sit?" (piano notes). "Not sure" and "Same as previous tune" are rows at the top of the list. Holds no value: the caller passes it.
 * The rules of the list: lib/kirtan/keyPicker.ts. The rail, the rows and the sheet are TagPicker's own pieces.
 */
export function KeyPicker({ theme, label, explain, options, value, onChange, noneLabel = null, sameLabel, onSame, noteOf, a11yOf, testID }: Props) {
  const t = useT()
  const am = useAmTheme()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const keyboard = useKeyboardHeight(open)

  const railText = keyRailText(value, noneLabel)
  const close = () => {
    setOpen(false)
    setQuery("")
  }
  const rows = useMemo(() => keyRows({ options, query, allowNone: noneLabel !== null, allowSame: !!sameLabel && !!onSame }), [options, query, noneLabel, sameLabel, onSame])
  const choose = (next: string) => {
    onChange(next)
    close()
  }

  return (
    <View style={s.root} testID={testID}>
      <View style={s.head}>
        <Text style={[s.label, { color: theme.textHeading }]}>{label}</Text>
      </View>
      <Press
        accessibilityRole="button"
        accessibilityLabel={t("picker.open", { field: label })}
        accessibilityHint={railText ?? t("picker.none")}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        pressedScale={0.98}
        style={[s.rail, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <View style={s.railChips}>
          {value ? (
            <View style={[s.chip, s.chipOn, { backgroundColor: theme.brand, borderColor: theme.brand }]}>
              <Text numberOfLines={1} style={[s.chipText, { color: theme.onBrand }]}>
                {value}
              </Text>
            </View>
          ) : (
            <Text numberOfLines={1} style={[s.placeholder, { color: theme.textMuted }]}>
              {railText ?? t("picker.none")}
            </Text>
          )}
        </View>
        <View style={[s.plus, { backgroundColor: theme.brand }]}>
          <Plus size={18} color={theme.onBrand} />
        </View>
      </Press>

      <SpringSheet visible={open} onClose={close} title={label} theme={am}>
        <View style={[s.sheetBody, { paddingBottom: keyboard }]}>
          <Text style={[s.hint, { color: theme.textBody }]}>{explain}</Text>
          <View style={[s.search, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <Search size={18} color={theme.textMuted} />
            <TextInput
              value={query}
              onChangeText={(text) => setQuery(text.slice(0, 4))}
              placeholder={t("picker.search")}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t("picker.search")}
              returnKeyType="done"
              autoCorrect={false}
              autoCapitalize="characters"
              maxLength={4}
              style={[s.searchInput, { color: theme.textHeading }]}
            />
          </View>
          <ScrollView style={s.list} contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
            {rows.map((row) =>
              row.kind === "same" ? (
                <Row key="same" theme={theme} label={sameLabel ?? ""} on={false} plus onPress={() => {
                  onSame?.()
                  close()
                }} />
              ) : row.kind === "none" ? (
                <Row key="none" theme={theme} label={noneLabel ?? ""} on={value === ""} onPress={() => choose("")} />
              ) : (
                <Row key={row.id} theme={theme} label={row.label} on={value === row.id} note={noteOf?.(row.id) ?? undefined} a11yLabel={a11yOf?.(row.id)} onPress={() => choose(row.id)} />
              ),
            )}
            {!rows.length ? <Text style={[s.empty, { color: theme.textMuted }]}>{t("picker.empty")}</Text> : null}
          </ScrollView>
        </View>
      </SpringSheet>
    </View>
  )
}
