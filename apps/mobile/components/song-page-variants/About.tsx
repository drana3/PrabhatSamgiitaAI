import { StyleSheet, Text, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AboutRow } from "@/lib/songPageVariants/aboutFacts"
import { formatDate, useLanguage } from "@/lib/i18n"
import { useVariantT } from "@/lib/songPageVariants/copy"

import { Eyebrow } from "./ui"
import type { SongVariantModel } from "./useSongVariantModel"

/** `17 September 1982`, in the app language. */
function dateText(date: { year: number; month: number; day: number }): string {
  return formatDate(new Date(date.year, date.month - 1, date.day), "long")
}

/**
 * "About this song": Credits and About merged, provable facts only (words and music, composition date, theme,
 * source category, whether there is an official recording, the source), then the photo credit. A row the data
 * does not have is not drawn.
 */
export function AboutBody({ t, model }: { t: SpTheme; model: SongVariantModel }) {
  const tr = useVariantT()
  useLanguage()
  const rows: Array<{ label: string; value: string }> = model.about.map((row: AboutRow) => {
    switch (row.id) {
      case "words":
        return { label: tr("songVariant.about.words"), value: row.value }
      case "composed":
        return { label: tr("songVariant.about.composed"), value: dateText(row.date) }
      case "theme":
        return { label: tr("songVariant.about.theme"), value: row.value }
      case "category":
        return { label: tr("songVariant.about.category"), value: row.value }
      case "recording":
        return { label: tr("songVariant.about.recording"), value: tr(row.kind === "official" ? "songVariant.about.recording.official" : "songVariant.about.recording.other") }
      case "source":
        return { label: tr("songVariant.about.source"), value: tr("songVariant.about.source.value") }
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
          {`${tr("songVariant.about.photo")}: ${tr("songVariant.about.photo.note", { credit: model.photo.credit.replace(/^Photo:\s*/i, "") })}`}
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
