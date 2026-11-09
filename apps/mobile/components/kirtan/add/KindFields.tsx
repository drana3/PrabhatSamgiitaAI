import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FlatList, Platform, StyleSheet, Text, TextInput, View } from "react-native"
import { Check } from "lucide-react-native"

import { SheetModal } from "@/components/common/SheetModal"
import { PICKER_INSET, PickerSearch } from "@/components/learn-v2/SongPicker"
import { PressBox } from "@/components/learn-v2/PressBox"
import { KPress } from "@/components/kirtan/KPress"
import { OwnWord, TAG_INPUT_GAP, type OwnWordSuggestion } from "@/components/kirtan/add/OwnWord"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { protoFor, type AmProto } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { kindHasLanguage, kindRequiresLanguage } from "@/lib/kirtan/kind"
import { NEW_WORDS_PER_WEEK } from "@/lib/kirtan/instruments"
import { cleanLanguageOther, LANGUAGE_OTHER_MAX, languageLabel, listedLanguageFor, OTHER_LANGUAGE, searchLanguages, similarLanguage, type LanguageChoice } from "@/lib/kirtan/languages"
import { DANCES, type DanceId, type RecordingKind } from "@/lib/kirtan/types"

/**
 * The fields that depend on the type of recording, used by the add form, the rows of the bulk queue and the playlist
 * flow: the REQUIRED marker, the searchable language picker (with "Other: name it"), the dance choice.
 * They hold no state of their own beyond the picker's search; the caller passes the value and takes the change.
 * Rules: lib/kirtan/uploadForm.ts missingKindFields.
 */

/** The "Required" pill (or the quiet "Optional" text). Both are words, never colour alone. */
export function RequiredMark({ theme, required, invalid }: { theme: SongsTheme; required: boolean; invalid?: boolean }) {
  const t = useT()
  if (!required) return <Text style={[styles.optional, { color: theme.textMuted }]}>{t("rec.optional")}</Text>
  return (
    <View style={[styles.requiredPill, { backgroundColor: invalid ? amColors.danger : theme.peach }]}>
      <Text style={[styles.requiredText, { color: invalid ? "#FFFFFF" : theme.accent }]}>{t("rec.required")}</Text>
    </View>
  )
}

/** The inline error line under a field. */
export function FieldError({ theme, text }: { theme: SongsTheme; text: string | null }) {
  if (!text) return null
  return (
    <Text style={[styles.error, { color: theme.dangerText }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      {text}
    </Text>
  )
}

/* ------------------------------------------------------------------ language */

export type LanguageValue = { language: string | null; languageOther: string }

/** The language of a recording: the label row (with Required or Optional) and the box that opens the picker. */
export function LanguageField({ theme, kind, value, onOpen, invalid, errorText, disabled }: { theme: SongsTheme; kind: RecordingKind; value: LanguageValue; onOpen: () => void; invalid?: boolean; errorText?: string | null; disabled?: boolean }) {
  const t = useT()
  if (!kindHasLanguage(kind)) return null
  const required = kindRequiresLanguage(kind)
  const label = value.language ? languageLabel(value.language, value.languageOther) : ""
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.language.label")}</Text>
        <RequiredMark theme={theme} required={required} invalid={invalid} />
      </View>
      <KPress
        accessibilityRole="button"
        accessibilityLabel={label ? t("rec.lang.chosenA11y", { language: label }) : required ? t("rec.required.a11y", { field: t("rec.lang.choose") }) : t("rec.lang.choose")}
        accessibilityState={{ disabled: !!disabled }}
        onPress={() => !disabled && onOpen()}
        pressedScale={0.99}
        style={[styles.box, { backgroundColor: theme.card, borderColor: invalid ? amColors.danger : theme.line }]}
      >
        <Text style={[styles.boxText, { color: label ? theme.textHeading : theme.textBody }]} numberOfLines={1}>
          {label || t("rec.lang.none")}
        </Text>
        <View style={[styles.boxButton, { backgroundColor: theme.peach }]}>
          <Text style={[styles.boxButtonText, { color: theme.accent }]}>{label ? t("ugc.add.change") : t("rec.lang.choose")}</Text>
        </View>
      </KPress>
      <FieldError theme={theme} text={errorText ?? null} />
    </View>
  )
}

/** A Dance music's dance: Tandava or Kaoshiki, two large choices. Always required. */
export function DanceField({ theme, value, onChange, invalid, errorText, disabled }: { theme: SongsTheme; value: DanceId | null; onChange: (dance: DanceId) => void; invalid?: boolean; errorText?: string | null; disabled?: boolean }) {
  const t = useT()
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.dance.label")}</Text>
        <RequiredMark theme={theme} required invalid={invalid} />
      </View>
      <DanceChoices theme={theme} value={value} onChange={onChange} invalid={invalid} disabled={disabled} large />
      {errorText ? <FieldError theme={theme} text={errorText} /> : <Text style={[styles.hint, { color: theme.textBody }]}>{t("rec.dance.hint")}</Text>}
    </View>
  )
}

/** The dances as a row of round choices; the dance list is lib/kirtan/types.ts DANCES (one growable constant). */
export function DanceChoices({ theme, value, onChange, invalid, disabled, large }: { theme: SongsTheme; value: DanceId | null; onChange: (dance: DanceId) => void; invalid?: boolean; disabled?: boolean; large?: boolean }) {
  const t = useT()
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {DANCES.map((dance) => {
        const on = value === dance
        const name = (t as (key: string) => string)(`rec.dance.${dance}`)
        return (
          <KPress
            key={dance}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: !!disabled }}
            accessibilityLabel={name}
            onActivate={() => !disabled && onChange(dance)}
            pressedScale={0.96}
            outerStyle={large ? styles.chipOuterLarge : undefined}
            style={[styles.chip, large && styles.chipLarge, { backgroundColor: on ? theme.ink900 : theme.card, borderColor: on ? theme.ink900 : invalid ? amColors.danger : theme.line }]}
          >
            <Text style={[styles.chipText, { color: on ? theme.onInk : theme.textHeading }]}>{name}</Text>
          </KPress>
        )
      })}
    </View>
  )
}

/* ------------------------------------------------------------------ the picker */

/**
 * The language picker: a sheet with a search field and every language of the catalog, then "Add a language".
 * Tapping a language picks it and closes; "Add a language" asks for the name in words (up to 80 characters). A name that IS a
 * listed language becomes its code, a name almost like one is offered it ("Did you mean ..."), any other goes to the team's queue
 * of new words (docs/kiirtan-recording-info.md, "Add your own"; at most NEW_WORDS_PER_WEEK new words a person a week).
 * `allowClear` adds "No language" at the top (languages that are optional).
 */
export function LanguagePicker({ visible, value, allowClear, title, onPick, onClose }: { visible: boolean; value: LanguageValue; allowClear: boolean; title?: string; onPick: (value: LanguageValue) => void; onClose: () => void }) {
  const t = useT()
  const p = protoFor(useAmTheme())
  const theme = useSongsTheme()
  const searchRef = useRef<TextInput | null>(null)
  const [query, setQuery] = useState("")
  const [naming, setNaming] = useState(false)
  const [otherName, setOtherName] = useState("")

  useEffect(() => {
    if (!visible) return
    setQuery("")
    setNaming(value.language === OTHER_LANGUAGE)
    setOtherName(value.language === OTHER_LANGUAGE ? value.languageOther : "")
  }, [visible, value.language, value.languageOther])

  const results = useMemo(() => searchLanguages(query), [query])
  const pick = useCallback((choice: LanguageChoice) => onPick({ language: choice.code, languageOther: "" }), [onPick])
  const renderItem = useCallback(({ item }: { item: LanguageChoice }) => <LanguageRow p={p} choice={item} chosen={item.code === value.language} onChoose={pick} />, [p, value.language, pick])
  const otherClean = cleanLanguageOther(otherName)
  const listedName = naming ? listedLanguageFor(otherName) : null
  const nearName = naming && !listedName ? similarLanguage(otherName) : null
  const suggestedCode = listedName ?? nearName
  const suggestion: OwnWordSuggestion | null = suggestedCode
    ? { question: nearName ? t("rec.lang.didYouMean", { name: languageLabel(suggestedCode) }) : undefined, actionLabel: t("rec.lang.useListed", { name: languageLabel(suggestedCode) }), onUse: () => onPick({ language: suggestedCode, languageOther: "" }) }
    : null
  // what "Done" sends: a listed language as its code, any other name as "other" with the name
  const submitName = () => {
    if (listedName) onPick({ language: listedName, languageOther: "" })
    else if (otherClean) onPick({ language: OTHER_LANGUAGE, languageOther: otherClean })
  }

  const header = (
    <>
      {allowClear ? (
        <PressBox accessibilityRole="button" accessibilityLabel={t("rec.lang.clear")} accessibilityState={{ selected: !value.language }} onPress={() => onPick({ language: null, languageOther: "" })} pressedScale={0.99} style={[styles.row, { borderBottomColor: p.sand300 }]}>
          <Text style={[styles.rowText, { color: p.ink500 }]}>{t("rec.lang.clear")}</Text>
          {!value.language ? <Check size={22} color={p.orange700} strokeWidth={2.4} /> : null}
        </PressBox>
      ) : null}
    </>
  )
  const footer = (
    <PressBox accessibilityRole="button" accessibilityLabel={t("rec.lang.other")} accessibilityState={{ selected: value.language === OTHER_LANGUAGE }} onPress={() => setNaming(true)} pressedScale={0.99} style={[styles.row, { borderBottomColor: p.sand300 }]}>
      <Text style={[styles.rowText, { color: p.ink800 }]}>{t("rec.lang.other")}</Text>
      {value.language === OTHER_LANGUAGE ? <Check size={22} color={p.orange700} strokeWidth={2.4} /> : null}
    </PressBox>
  )

  return (
    <SheetModal visible={visible} title={naming ? t("rec.lang.otherLabel") : (title ?? t("rec.lang.title"))} closeLabel={t("ugc.add.close")} onClose={onClose}>
      {naming ? (
        <View style={styles.nameBody}>
          <OwnWord
            theme={theme}
            value={otherName}
            onChange={setOtherName}
            placeholder={t("rec.lang.otherPlaceholder")}
            maxLength={LANGUAGE_OTHER_MAX}
            note={t("rec.lang.newNote", { count: NEW_WORDS_PER_WEEK })}
            suggestion={suggestion}
            autoFocus
            onSubmit={submitName}
          />
          <KPress
            accessibilityRole="button"
            accessibilityLabel={t("ugc.add.change")}
            accessibilityState={{ disabled: !otherClean }}
            onPress={submitName}
            pressedScale={0.98}
            style={[styles.done, { backgroundColor: amColors.orange700, opacity: otherClean ? 1 : 0.4 }]}
          >
            <Text style={styles.doneText}>{t("common.done")}</Text>
          </KPress>
          <PressBox accessibilityRole="button" accessibilityLabel={t("rec.lang.title")} onPress={() => setNaming(false)} pressedScale={0.97} style={styles.back}>
            <Text style={[styles.rowText, { color: p.orange700 }]}>{t("rec.lang.title")}</Text>
          </PressBox>
        </View>
      ) : (
        <>
          <View style={styles.searchRow}>
            <PickerSearch p={p} value={query} onChangeText={setQuery} inputRef={searchRef} placeholder={t("rec.lang.search")} />
          </View>
          <FlatList
            data={results}
            extraData={value.language}
            keyExtractor={(choice) => choice.code}
            renderItem={renderItem}
            ListHeaderComponent={query ? null : header}
            ListFooterComponent={footer}
            ListEmptyComponent={
              <View style={styles.state}>
                <Text style={[styles.stateText, { color: p.ink500 }]}>{t("rec.lang.noMatch", { query: query.trim() })}</Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            initialNumToRender={16}
            removeClippedSubviews={Platform.OS === "android"}
            style={styles.list}
          />
        </>
      )}
    </SheetModal>
  )
}

const LanguageRow = memo(function LanguageRow({ p, choice, chosen, onChoose }: { p: AmProto; choice: LanguageChoice; chosen: boolean; onChoose: (choice: LanguageChoice) => void }) {
  const t = useT()
  return (
    <PressBox accessibilityRole="button" accessibilityLabel={t("rec.lang.rowA11y", { language: choice.label })} accessibilityState={{ selected: chosen }} onPress={() => onChoose(choice)} pressedScale={0.99} style={[styles.row, { borderBottomColor: p.sand300 }]}>
      <Text style={[styles.rowText, { color: p.ink800 }]} numberOfLines={1}>
        {choice.label}
      </Text>
      {choice.label !== choice.english ? (
        <Text style={[styles.rowEnglish, { color: p.ink500 }]} numberOfLines={1}>
          {choice.english}
        </Text>
      ) : null}
      {chosen ? <Check size={22} color={p.orange700} strokeWidth={2.4} /> : null}
    </PressBox>
  )
})

const styles = StyleSheet.create({
  field: { gap: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  optional: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  requiredPill: { height: 24, paddingHorizontal: 10, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  requiredText: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4, textTransform: "uppercase" },
  error: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  box: { minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingLeft: 16, paddingRight: 8, paddingVertical: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 8 },
  boxText: { flexGrow: 1, flexShrink: 1, flexBasis: 170, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20 },
  boxButton: { height: 40, paddingHorizontal: 16, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  boxButtonText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipOuterLarge: { flexGrow: 1, flexBasis: "45%" },
  chip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 70, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  chipLarge: { minHeight: 56, borderRadius: 24 },
  chipText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  searchRow: { height: 56, paddingHorizontal: PICKER_INSET, flexDirection: "row", marginBottom: 8 },
  count: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  list: { flex: 1 },
  row: { minHeight: 56, paddingHorizontal: PICKER_INSET, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flexShrink: 1, fontFamily: amFonts.bold, fontSize: 16, lineHeight: 21, letterSpacing: -0.16 },
  rowEnglish: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  state: { alignItems: "center", paddingTop: 48, paddingHorizontal: 24 },
  stateText: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21, textAlign: "center" },
  nameBody: { paddingHorizontal: PICKER_INSET, gap: TAG_INPUT_GAP, paddingTop: 8 },
  done: { height: 56, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  doneText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, color: "#FFFFFF" },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
})
