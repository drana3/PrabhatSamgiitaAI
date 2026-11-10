import { useEffect, useMemo, useRef, useState } from "react"
import { Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { Check, Plus, Search } from "lucide-react-native"

import { SpringSheet } from "@/components/assistant-v2/SpringSheet"
import { FieldError, RequiredMark } from "@/components/kirtan/add/KindFields"
import { Press } from "@/components/songs-v2/Press"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { controlBorder } from "@/lib/controlColors"
import { useT } from "@/lib/i18n"
import { WORD_MAX } from "@/lib/kirtan/instruments"
import { addOwnTag, canAddOwn, chipsOf, filterOptions, fitRailChips, removeOwnTag, tagCount, TAGS_MAX, toggleTag, type TagProblem, type TagValue } from "@/lib/kirtan/tags"

export type TagOption = { id: string; label: string }

/** How many chips the one-line field shows before the rest become "+N". The rail is one line on a 360 pt phone. */

type Props = {
  theme: SongsTheme
  /** field name above the line, and the title of the sheet */
  label: string
  hint?: string | null
  required?: boolean
  invalid?: boolean
  errorText?: string | null
  disabled?: boolean
  /** the listed choices, in the order the sheet shows them */
  options: readonly TagOption[]
  /** label of a chosen id (older ids that are no longer offered still read) */
  labelOf: (id: string) => string
  value: TagValue
  onChange: (next: TagValue) => void
  /** one choice only (the main instrument, which mantra): ONE row with the chosen value and a Choose / Change button, no chips; a tap in the sheet picks it and closes it */
  single?: boolean
  max?: number
  /** the listed id a typed word IS, so "electronic " becomes Electronic */
  listedFor?: (word: string) => string | null
  /** the listed id a typed word is almost like ("electonic"): offered as "Did you mean" */
  similar?: (word: string) => string | null
  /** a short line under the "add your own" row (the team looks at new words) */
  ownNote?: string | null
  /**
   * Naming for a choice list that ends in "Something else" (Others): the row reads this instead of "Add your own", it is shown even before
   * anything is typed (a tap puts the cursor in the search box, where the name is written), and the box asks for the name.
   */
  otherLabel?: string | null
  searchPlaceholder?: string | null
  testID?: string
}

/**
 * The compact tag field (Dada, 9 Nov 2026): ONE line on the form, however many values are chosen. Tap it and a bottom sheet opens with a
 * search box and a scrollable list; chosen values are one line of chips plus a "+". Style and Mood use it; the single choices (the main
 * instrument, which mantra) show one row with the value and a Choose / Change button instead of chips (Dada, 9 Nov 2026).
 *
 * Inside the sheet one box does two jobs: it filters the list, and when what was typed is not on the list a row "Add “word”" turns it into
 * the person's own word. So there is no second input next to a group of chips (docs/layout-rules.md, "An input beside a group of tags").
 * All the rules (limits, own words, what counts as a listed word) live in lib/kirtan/tags.ts; this file only draws and calls them.
 * Holds no value: the caller passes it and takes the change. Motion is the sheet's own spring (assistant-v2/SpringSheet).
 */
export function TagPicker({ theme, label, hint, required, invalid, errorText, disabled, options, labelOf, value, onChange, single, max, listedFor, similar, ownNote, otherLabel, searchPlaceholder, testID }: Props) {
  const t = useT()
  const am = useAmTheme()
  const limit = single ? 1 : (max ?? TAGS_MAX)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [problem, setProblem] = useState<TagProblem>(null)
  const keyboard = useKeyboardHeight(open)
  const searchRef = useRef<InstanceType<typeof TextInput> | null>(null)

  const chips = chipsOf(value, labelOf)
  const { shown, more } = fitRailChips(chips)
  const summary = chips.length ? chips.map((c) => c.label).join(", ") : t("picker.none")

  const close = () => {
    setOpen(false)
    setQuery("")
    setProblem(null)
  }
  const change = (result: { value: TagValue; problem: TagProblem }, closeAfter = false) => {
    setProblem(result.problem)
    if (!result.problem) {
      onChange(result.value)
      if (closeAfter && single) close()
    }
  }
  const pick = (id: string) => {
    if (single) {
      // one choice: a tap picks it (a second tap on the same one clears it) and the sheet goes away
      const on = value.ids.includes(id)
      onChange(on ? { ids: [], own: [] } : { ids: [id], own: [] })
      close()
      return
    }
    change(toggleTag(value, id, limit))
  }
  const addOwn = (text: string) => {
    if (single) {
      const next = addOwnTag({ ids: [], own: [] }, text, { listedFor, max: 1 })
      change(next, true)
    } else change(addOwnTag(value, text, { listedFor, max: limit }))
    setQuery("")
  }

  const visible = useMemo(() => filterOptions(options, query), [options, query])
  const typed = query.trim()
  const addable = canAddOwn(typed, options) && !value.own.some((w) => w.toLowerCase() === typed.toLowerCase())
  const near = typed && similar ? similar(typed) : null
  const nearOption = near ? options.find((o) => o.id === near) : undefined
  const atLimit = tagCount(value) >= limit && !single

  return (
    <View style={s.root} testID={testID}>
      <View style={s.head}>
        <Text style={[s.label, { color: theme.textHeading }]}>{label}</Text>
        <RequiredMark theme={theme} required={!!required} invalid={invalid} />
      </View>
      {hint ? <Text style={[s.hint, { color: theme.textBody }]}>{hint}</Text> : null}
      <Press
        accessibilityRole="button"
        accessibilityLabel={t("picker.open", { field: label })}
        accessibilityHint={summary}
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        pressedScale={0.98}
        style={[s.rail, { backgroundColor: theme.card, borderColor: invalid ? amColors.danger : controlBorder(theme) }]}
      >
        {single ? (
          <>
            <Text numberOfLines={1} style={[chips.length ? s.value : s.placeholder, { color: chips.length ? theme.textHeading : theme.textMuted, flex: 1 }]}>
              {summary}
            </Text>
            <View style={[s.choose, { backgroundColor: theme.brand }]}>
              <Text style={[s.chooseText, { color: theme.onBrand }]}>{chips.length ? t("picker.change") : t("picker.choose")}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={s.railChips}>
              {shown.length ? (
                shown.map((c) => (
                  <View key={c.key} style={[s.chip, s.chipOn, { backgroundColor: theme.brand, borderColor: theme.brand }]}>
                    <Text numberOfLines={1} style={[s.chipText, { color: theme.onBrand }]}>
                      {c.label}
                    </Text>
                  </View>
                ))
              ) : (
                <Text numberOfLines={1} style={[s.placeholder, { color: theme.textMuted }]}>
                  {t("picker.none")}
                </Text>
              )}
              {more > 0 ? (
                <View style={[s.chip, { backgroundColor: theme.card, borderColor: theme.line }]}>
                  <Text style={[s.chipText, { color: theme.textHeading }]}>{`+${more}`}</Text>
                </View>
              ) : null}
            </View>
            <View style={[s.plus, { backgroundColor: theme.brand }]}>
              <Plus size={18} color={theme.onBrand} />
            </View>
          </>
        )}
      </Press>
      {errorText ? <FieldError theme={theme} text={errorText} /> : null}

      <SpringSheet visible={open} onClose={close} title={label} theme={am}>
        <View style={[s.sheetBody, { paddingBottom: keyboard }]}>
          <View style={[s.search, { backgroundColor: theme.card, borderColor: controlBorder(theme) }]}>
            <Search size={18} color={theme.textMuted} />
            <TextInput
              value={query}
              onChangeText={(text) => {
                setQuery(text.slice(0, WORD_MAX))
                setProblem(null)
              }}
              ref={searchRef}
              placeholder={searchPlaceholder ?? t("picker.search")}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t("picker.search")}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (addable && !visible.length) addOwn(typed)
              }}
              autoCorrect={false}
              maxLength={WORD_MAX}
              style={[s.searchInput, { color: theme.textHeading }]}
            />
          </View>
          <ScrollView style={s.list} contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
            {value.own.map((word) => (
              <Row key={`own-${word}`} theme={theme} label={word} on note={t("picker.team")} onPress={() => {
                if (single) {
                  onChange({ ids: [], own: [] })
                  close()
                } else onChange(removeOwnTag(value, word))
              }} a11yLabel={t("picker.remove", { word })} />
            ))}
            {visible.map((o) => (
              <Row key={o.id} theme={theme} label={o.label} on={value.ids.includes(o.id)} disabled={atLimit && !value.ids.includes(o.id)} onPress={() => pick(o.id)} />
            ))}
            {nearOption && !value.ids.includes(nearOption.id) ? (
              <Row theme={theme} label={t("picker.didYouMean", { word: nearOption.label })} on={false} onPress={() => pick(nearOption.id)} />
            ) : null}
            {addable ? <Row theme={theme} label={`${otherLabel ?? t("picker.addOwn")}: ${typed}`} on={false} plus note={ownNote ?? t("picker.team")} onPress={() => addOwn(typed)} /> : null}
            {!visible.length && !addable && !otherLabel ? <Text style={[s.empty, { color: theme.textMuted }]}>{t("picker.empty")}</Text> : null}
          </ScrollView>
          {/* "Something else" stays in view below the list, so nobody has to scroll to learn it exists */}
          {otherLabel && !addable && !value.own.length ? <Row theme={theme} label={otherLabel} on={false} plus note={ownNote ?? t("picker.team")} onPress={() => searchRef.current?.focus()} /> : null}
          {problem ? (
            <Text accessibilityLiveRegion="polite" style={[s.problem, { color: amColors.danger }]}>
              {problem === "full" ? t("picker.full", { max: limit }) : problem === "ownFull" ? t("picker.ownFull") : t("picker.short")}
            </Text>
          ) : null}
          {single ? null : (
            <View style={s.footer}>
              <Text style={[s.count, { color: theme.textBody }]}>{t("picker.chosen", { count: tagCount(value) })}</Text>
              <Press accessibilityRole="button" accessibilityLabel={t("picker.done")} onPress={close} pressedScale={0.95} style={[s.done, { backgroundColor: theme.brand }]}>
                <Text style={[s.doneText, { color: theme.onBrand }]}>{t("picker.done")}</Text>
              </Press>
            </View>
          )}
        </View>
      </SpringSheet>
    </View>
  )
}

export function Row({ theme, label, on, note, plus, disabled, onPress, a11yLabel }: { theme: SongsTheme; label: string; on: boolean; note?: string; plus?: boolean; disabled?: boolean; onPress: () => void; a11yLabel?: string }) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ selected: on, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      pressedScale={0.98}
      style={[s.row, { borderColor: on ? theme.brand : controlBorder(theme), backgroundColor: theme.card, opacity: disabled ? 0.45 : 1 }]}
    >
      <View style={s.rowText}>
        <Text style={[s.rowLabel, { color: theme.textHeading, fontFamily: on ? amFonts.bold : amFonts.semi }]}>{label}</Text>
        {note ? <Text style={[s.rowNote, { color: theme.textBody }]}>{note}</Text> : null}
      </View>
      <View style={[s.tick, on ? { backgroundColor: theme.brand, borderColor: theme.brand } : { borderColor: controlBorder(theme) }]}>{on ? <Check size={16} color={theme.onBrand} /> : plus ? <Plus size={16} color={theme.textHeading} /> : null}</View>
    </Press>
  )
}

/** The on-screen keyboard's height while the sheet is open, so the list stays above it (the sheet itself sits at the bottom). */
export function useKeyboardHeight(active: boolean): number {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    if (!active || Platform.OS === "web") {
      setHeight(0)
      return
    }
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => setHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [active])
  return height
}

const s = StyleSheet.create({
  root: { gap: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  rail: { minHeight: 56, borderRadius: 16, borderWidth: 1, paddingLeft: 12, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  railChips: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, overflow: "hidden" },
  placeholder: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  chip: { minHeight: 32, paddingHorizontal: 12, borderRadius: 70, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 1 },
  chipOn: {},
  chipText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  value: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22 },
  choose: { minHeight: 40, paddingHorizontal: 16, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  chooseText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  plus: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  sheetBody: { gap: 12, paddingHorizontal: 10 },
  search: { minHeight: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, minHeight: 48, fontFamily: amFonts.medium, fontSize: 16 },
  list: { maxHeight: 360 },
  listContent: { gap: 8, paddingBottom: 4 },
  row: { minHeight: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16, lineHeight: 22 },
  rowNote: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  tick: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  empty: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, paddingVertical: 12, textAlign: "center" },
  problem: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  count: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  done: { minHeight: 48, paddingHorizontal: 24, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  doneText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
})

/** The picker's own styles, shared with the key picker (same rail, same sheet, same rows). */
export const pickerStyles = s
