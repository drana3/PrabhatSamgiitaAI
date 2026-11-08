import { StyleSheet, Text, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AboutRow } from "@/lib/songPage/aboutFacts"
import { formatDate, useLanguage } from "@/lib/i18n"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"

import { Eyebrow, SectionTitle } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/** `17 September 1982`, in the app language. */
function dateText(date: { year: number; month: number; day: number }): string {
  return formatDate(new Date(date.year, date.month - 1, date.day), "long")
}

/** The explanation of the song in plain words: drawn only when a reviewed one exists, never an empty slot (see songContent.explanationIsUsable). */
function Explanation({ t, tr, model }: { t: SpTheme; tr: PageT; model: SongPageModel }) {
  const e = model.explanation
  if (!e) return null
  return (
    <View style={styles.explain}>
      <Eyebrow t={t}>{tr("songPage.commentary.plain")}</Eyebrow>
      <Text style={[styles.plain, { color: t.ink900 }]}>{e.summary}</Text>
      {e.keyPoints.map((point, i) => (
        <Text key={i} style={[styles.point, { color: t.ink900 }]}>{`•  ${point}`}</Text>
      ))}
      {e.keyTerms.map((term) => (
        <Text key={term.term} style={[styles.point, { color: t.ink800 }]}>
          <Text style={{ fontFamily: amFonts.bold, color: t.ink900 }}>{term.term}</Text>
          {` · ${term.meaning}`}
        </Text>
      ))}
    </View>
  )
}

/** The central idea of the song, when the data has one (the official English text's, or a machine-assisted one in another language, and it says so). */
function CentralIdea({ t, tr, model }: { t: SpTheme; tr: PageT; model: SongPageModel }) {
  const central = model.meaning.central
  if (!central) return null
  return (
    <View style={[styles.central, { backgroundColor: t.dark ? t.sand100 : t.sage200 }]}>
      <Text style={[styles.centralLabel, { color: t.dark ? t.ink500 : t.sage800 }]}>
        {`${tr("songPage.about.centralIdea")} · ${model.meaning.source === "official" ? tr("songPage.meaning.officialTag") : tr("songPage.meaning.machineTag")}`}
      </Text>
      <Text style={[styles.centralText, { color: t.dark ? t.ink900 : t.sage900 }]}>{central}</Text>
    </View>
  )
}

/**
 * "Song information", the last section: the central idea when there is one, the explanation in plain words only when
 * one was written, then provable facts only (words and music, composition date, theme, source category, whether there
 * is an official recording, the source), then the photo credit. A row the data does not have is not drawn.
 */
export function AboutSection({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const tr = usePageT()
  if (!model.about.length && !model.photo && !model.meaning.central && !model.explanation) return null
  return (
    <View>
      <SectionTitle t={t}>{tr("songPage.about.title")}</SectionTitle>
      <View style={styles.body}>
        <CentralIdea t={t} tr={tr} model={model} />
        <Explanation t={t} tr={tr} model={model} />
      </View>
      <AboutBody t={t} model={model} />
    </View>
  )
}

export function AboutBody({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const tr = usePageT()
  useLanguage()
  const rows: Array<{ label: string; value: string }> = model.about.map((row: AboutRow) => {
    switch (row.id) {
      case "words":
        return { label: tr("songPage.about.words"), value: row.value }
      case "composed":
        return { label: tr("songPage.about.composed"), value: dateText(row.date) }
      case "theme":
        return { label: tr("songPage.about.theme"), value: row.value }
      case "category":
        return { label: tr("songPage.about.category"), value: row.value }
      case "recording":
        return { label: tr("songPage.about.recording"), value: tr(row.kind === "official" ? "songPage.about.recording.official" : "songPage.about.recording.other") }
      case "source":
        return { label: tr("songPage.about.source"), value: tr("songPage.about.source.value") }
    }
  })
  return (
    <View style={styles.body}>
      {rows.map((row, i) => (
        <View key={row.label} style={[styles.row, { borderTopColor: t.sand400, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth }]}>
          <Eyebrow t={{ ...t, ink800: t.ink500 }}>{row.label}</Eyebrow>
          <Text style={[styles.value, { color: t.ink900 }]}>{row.value}</Text>
        </View>
      ))}
      {model.photo ? (
        <Text style={[styles.photo, { color: t.ink500 }]}>
          {`${tr("songPage.about.photo")}: ${tr("songPage.about.photo.note", { credit: model.photo.credit.replace(/^Photo:\s*/i, "") })}`}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  central: { borderRadius: 20, padding: 18, gap: 8, marginBottom: 16 },
  centralLabel: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase" },
  centralText: { fontFamily: amFonts.semi, fontSize: 18, lineHeight: 26 },
  explain: { gap: 8, marginBottom: 16 },
  plain: { fontFamily: amFonts.regular, fontSize: 17, lineHeight: 27 },
  point: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 24 },
  body: { paddingHorizontal: 20 },
  row: { paddingVertical: 14, gap: 4 },
  value: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 26 },
  photo: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingTop: 12, paddingBottom: 4 },
})
