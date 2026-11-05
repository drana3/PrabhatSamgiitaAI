import { StyleSheet, Text, View } from "react-native"

import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import { SpSheet } from "@/components/song-v2/SpSheet"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { lyricLanguageName, lyricLanguageTitle } from "@/lib/songPage/lyricLanguages"
import type { MeaningSource } from "@/lib/songPage/meaningInfo"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"

import { Eyebrow, SectionTitle } from "./ui"
import type { MeaningLanguageRow, MeaningState } from "./useSongPageModel"

export function sourceLabel(tr: PageT, source: MeaningSource): string {
  return source === "official" ? tr("songPage.meaning.official") : source === "reviewed" ? tr("songPage.meaning.reviewed") : tr("songPage.meaning.machine")
}

/**
 * "Meaning in English · official translation". One language at a time, the one chosen in the lyrics toolbar (there
 * is no second chooser here). It says what the text is (official, checked by an editor, or machine-assisted) and,
 * when the language asked for is missing, that English is shown instead.
 */
function MeaningHeader({ t, meaning }: { t: SpTheme; meaning: MeaningState }) {
  const tr = usePageT()
  const name = lyricLanguageName(meaning.status === "none" && meaning.wanted ? meaning.wanted : meaning.language)
  const wantedName = lyricLanguageName(meaning.wanted)
  // the sentence has the language in it; split it there so the name can be bold in any language
  const [lead = "", tail = ""] = tr("songPage.meaning.in", { language: "\u0001" }).split("\u0001")
  return (
    <View style={styles.header}>
      <Text style={[styles.headerLine, { color: t.ink800 }]}>
        <Text>{lead}</Text>
        <Text style={{ fontFamily: amFonts.bold, color: t.ink900 }}>{name}</Text>
        {tail ? <Text>{tail}</Text> : null}
        {meaning.status === "ready" ? <Text style={{ color: t.ink500 }}>{` · ${sourceLabel(tr, meaning.source)}`}</Text> : null}
      </Text>
      {meaning.fellBack ? (
        <Text style={[styles.headerNote, { color: t.ink500 }]}>{tr("songPage.meaning.unavailable", { language: wantedName })}</Text>
      ) : meaning.status === "none" && meaning.wanted !== "en" ? (
        <Text style={[styles.headerNote, { color: t.ink500 }]}>{tr("songPage.meaning.unavailableNone", { language: wantedName })}</Text>
      ) : null}
    </View>
  )
}

/** Section 2: the central idea when the data has one, the translation as paragraphs, and where it comes from. */
export function MeaningSection({ t, meaning }: { t: SpTheme; meaning: MeaningState }) {
  const tr = usePageT()
  const paragraphs = meaning.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return (
    <View>
      <SectionTitle t={t}>{tr("songPage.tab.meaning")}</SectionTitle>
      <MeaningHeader t={t} meaning={meaning} />
      <View style={styles.page}>
        {meaning.central ? (
          <View style={[styles.central, { backgroundColor: t.dark ? t.sand100 : t.sage200 }]}>
            <Text style={[styles.centralLabel, { color: t.dark ? t.ink500 : t.sage800 }]}>
              {`${tr("songPage.meaning.centralIdea")} · ${meaning.source === "official" ? tr("songPage.meaning.officialTag") : tr("songPage.meaning.machineTag")}`}
            </Text>
            <Text style={[styles.centralText, { color: t.dark ? t.ink900 : t.sage900 }]}>{meaning.central}</Text>
          </View>
        ) : null}
        <Eyebrow t={t} style={styles.eyebrow}>{tr("songPage.meaning.translation")}</Eyebrow>
        {meaning.status === "loading" ? (
          <Text style={[styles.body, { color: t.ink500 }]}>{tr("songPage.meaning.loading", { language: lyricLanguageName(meaning.wanted) })}</Text>
        ) : meaning.status === "none" ? (
          <Text style={[styles.body, { color: t.ink500 }]}>{tr("songPage.meaning.none")}</Text>
        ) : (
          paragraphs.map((p, i) => (
            <Text key={i} style={[styles.body, { color: t.ink900 }]}>{p}</Text>
          ))
        )}
        {meaning.status === "ready" ? <Text style={[styles.source, { color: t.ink500 }]}>{tr("songPage.meaning.source")}</Text> : null}
      </View>
    </View>
  )
}

/** The translation language sheet: Official, in the catalogue, machine-assisted; one language at a time. */
export function MeaningLanguageSheet({
  t,
  visible,
  onClose,
  rows,
  selected,
  onPick,
}: {
  t: SpTheme
  visible: boolean
  onClose: () => void
  rows: MeaningLanguageRow[]
  selected: string
  onPick: (code: string) => void
}) {
  const tr = usePageT()
  const groups: Array<{ key: string; title: string; note?: string; rows: MeaningLanguageRow[] }> = [
    { key: "official", title: tr("songPage.meaning.sheet.official"), rows: rows.filter((r) => r.source === "official") },
    { key: "reviewed", title: tr("songPage.meaning.sheet.hasText"), rows: rows.filter((r) => r.source === "reviewed") },
    { key: "machine", title: tr("songPage.meaning.sheet.machine"), note: tr("songPage.meaning.sheet.machineNote"), rows: rows.filter((r) => r.source === "machine") },
  ].filter((g) => g.rows.length > 0)
  return (
    <SpSheet t={t} visible={visible} onClose={onClose} label={tr("songPage.meaning.sheet.title")}>
      <Text style={[styles.sheetTitle, { color: t.ink900 }]}>{tr("songPage.meaning.sheet.title")}</Text>
      {groups.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text style={[styles.groupTitle, { color: t.ink800 }]}>{group.title}</Text>
          {group.note ? <Text style={[styles.groupNote, { color: t.ink500 }]}>{group.note}</Text> : null}
          {group.rows.map((row) => {
            const on = row.language.code === selected
            return (
              <SpPress
                key={row.language.code}
                onPress={() => {
                  onPick(row.language.code)
                  onClose()
                }}
                accessibilityLabel={lyricLanguageTitle(row.language.code)}
                accessibilityState={{ selected: on }}
                style={styles.langRow}
              >
                <Text style={[styles.langName, { color: t.ink900 }]}>{lyricLanguageTitle(row.language.code)}</Text>
                {on ? <SpIcon name="check" size={22} color={t.orange500} strokeWidth={2.4} /> : null}
              </SpPress>
            )
          })}
        </View>
      ))}
      <View style={{ height: 8 }} />
    </SpSheet>
  )
}

const styles = StyleSheet.create({
  header: { gap: 2, paddingHorizontal: 20, paddingBottom: 12 },
  headerLine: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  headerNote: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  page: { paddingBottom: 8 },
  central: { marginHorizontal: 20, borderRadius: 24, padding: 20, gap: 8 },
  centralLabel: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase" },
  centralText: { fontFamily: amFonts.semi, fontSize: 18, lineHeight: 26 },
  eyebrow: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10 },
  body: { fontFamily: amFonts.regular, fontSize: 18, lineHeight: 28, paddingHorizontal: 20, paddingBottom: 14 },
  source: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingHorizontal: 20, paddingTop: 6 },
  sheetTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 28, paddingHorizontal: 24, paddingBottom: 8 },
  group: { paddingTop: 12 },
  groupTitle: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", paddingHorizontal: 24 },
  groupNote: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingHorizontal: 24, paddingTop: 2 },
  langRow: { minHeight: 52, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  langName: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
})
