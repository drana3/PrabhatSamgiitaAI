import { useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { Check, Search } from "lucide-react-native"

import { BottomSheet } from "@/components/song-v2/BottomSheet"
import { Pill } from "@/components/song-v2/common"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amFontSize, amType } from "@/constants/tokens/amTypography"
import { localeOptions } from "@/constants/languages"
import { SCRIPT_LABEL, type ScriptChoice, type ScriptId } from "@/lib/songPage/scripts"
import {
  COVERAGE_HINT,
  COVERAGE_TITLE,
  groupLanguages,
  MAX_TRANSLATIONS,
  type Coverage,
} from "@/lib/songPage/translations"

/**
 * Script and translation sheet (SCR-25). Script: the scripts the song has,
 * plus Both. Translations: a search field over all languages, rows grouped by
 * coverage, up to two picked (a third drops the oldest). The sheet changes only
 * what is shown; it never touches playback.
 */
export function ScriptTranslationSheet({
  theme,
  visible,
  onClose,
  scripts,
  script,
  onScript,
  selected,
  coverage,
  onToggleLanguage,
}: {
  theme: AmTheme
  visible: boolean
  onClose: () => void
  scripts: ScriptId[]
  script: ScriptChoice
  onScript: (choice: ScriptChoice) => void
  selected: string[]
  coverage: Record<string, Coverage>
  onToggleLanguage: (code: string) => void
}) {
  const [query, setQuery] = useState("")
  const groups = useMemo(() => groupLanguages(coverage, query), [coverage, query])
  const choices: ScriptChoice[] = scripts.length > 1 && scripts.includes("roman") ? [...scripts, "both"] : scripts

  return (
    <BottomSheet theme={theme} visible={visible} onClose={onClose} title="Script and translation" heightRatio={0.86}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[amType.label, { color: theme.eyebrow }]}>Script</Text>
        <View style={styles.row}>
          {choices.map((choice) => (
            <Pill
              key={choice}
              theme={theme}
              label={SCRIPT_LABEL[choice]}
              selected={script === choice}
              tone={script === choice ? "brand" : "card"}
              onPress={() => onScript(choice)}
            />
          ))}
        </View>

        <Text
          style={[amType.label, styles.gap, { color: theme.eyebrow }]}
        >{`Translations · pick up to ${MAX_TRANSLATIONS}`}</Text>
        <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <Search size={20} color={theme.textBody} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${localeOptions.length} languages`}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel="Search languages"
            autoCorrect={false}
            style={[styles.input, { color: theme.textHeading }]}
          />
        </View>

        {groups.length === 0 ? (
          <Text style={[amType.body, { color: theme.textBody }]}>No language matches that search.</Text>
        ) : (
          groups.map((group) => (
            <View key={group.coverage} style={styles.group}>
              <Text style={[styles.groupTitle, { color: theme.textHeading }]}>{COVERAGE_TITLE[group.coverage]}</Text>
              <Text style={[amType.body, { color: theme.textMuted }]}>{COVERAGE_HINT[group.coverage]}</Text>
              {group.rows.map(({ option }) => {
                const on = selected.includes(option.code)
                return (
                  <Pressable
                    key={option.code}
                    onPress={() => onToggleLanguage(option.code)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${option.label}, ${option.nativeLabel}`}
                    style={[
                      styles.language,
                      { backgroundColor: theme.card, borderColor: on ? theme.brand : theme.line },
                    ]}
                  >
                    <View style={styles.names}>
                      <Text style={[styles.langName, { color: theme.textHeading }]}>{option.label}</Text>
                      {option.nativeLabel !== option.label ? (
                        <Text style={[amType.body, { color: theme.textBody }]}>{option.nativeLabel}</Text>
                      ) : null}
                    </View>
                    {on ? <Check size={22} color={theme.brand} /> : null}
                  </Pressable>
                )
              })}
            </View>
          ))
        )}
        <Text style={[amType.body, { color: theme.textMuted }]}>
          Full has lines and word meanings. Lines only has each line translated. Meaning only has one text for the whole
          song. For the others the meaning is translated by machine and can be wrong.
        </Text>
      </ScrollView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: amGap.gutter, paddingBottom: amSpace.s8, gap: amSpace.s3 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: amSpace.s2 },
  gap: { marginTop: amSpace.s3 },
  search: {
    minHeight: amTouchTarget,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    paddingHorizontal: amSpace.s4,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s2,
  },
  input: { flex: 1, fontFamily: amFonts.regular, fontSize: amFontSize.body, minHeight: amTouchTarget },
  group: { gap: amSpace.s2 },
  groupTitle: { fontFamily: amFonts.bold, fontSize: amFontSize.lead, marginTop: amSpace.s2 },
  language: {
    minHeight: amTouchTarget,
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingHorizontal: amSpace.s4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  names: { flex: 1, gap: 2 },
  langName: { fontFamily: amFonts.semi, fontSize: amFontSize.body },
})
