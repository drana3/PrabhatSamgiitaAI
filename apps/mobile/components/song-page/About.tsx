import { StyleSheet, Text, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AboutRow } from "@/lib/songPage/aboutFacts"
import { formatDate, useLanguage } from "@/lib/i18n"
import { usePageT } from "@/lib/songPage/pageCopy"

import { Eyebrow, SectionTitle } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/** `17 September 1982`, in the app language. */
function dateText(date: { year: number; month: number; day: number }): string {
  return formatDate(new Date(date.year, date.month - 1, date.day), "long")
}

/**
 * "About this song": Credits and About merged, provable facts only (words and music, composition date, theme,
 * source category, whether there is an official recording, the source), then the photo credit. A row the data
 * does not have is not drawn.
 */
export function AboutSection({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const tr = usePageT()
  if (!model.about.length && !model.photo) return null
  return (
    <View>
      <SectionTitle t={t}>{tr("songPage.about.title")}</SectionTitle>
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
  body: { paddingHorizontal: 20 },
  row: { paddingVertical: 14, gap: 4 },
  value: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 26 },
  photo: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingTop: 12, paddingBottom: 4 },
})
