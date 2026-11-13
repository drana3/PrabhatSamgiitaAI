import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { allCollections } from "@/data/collections"
import { useColleagueDateLines } from "@/hooks/useColleagueData"
import { PS_ALL } from "@/lib/psCollections/data"
import type { AboutRow } from "@/lib/songPage/aboutFacts"
import { collectionsOfSong, colleagueDateRow, type SongCollection } from "@/lib/songPage/infoFacts"
import { formatDate, useLanguage } from "@/lib/i18n"
import { href } from "@/utils/href"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"

import { Eyebrow, SectionTitle } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/** `17 September 1982`, in the app language. */
function dateText(date: { year: number; month: number; day: number }): string {
  return formatDate(new Date(date.year, date.month - 1, date.day), "long")
}

/** The explanation of the song in plain words: drawn only when a reviewed one exists, never an empty slot (see songContent.explanationIsUsable). */
export function Explanation({ t, tr, model }: { t: SpTheme; tr: PageT; model: SongPageModel }) {
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
export function CentralIdea({ t, tr, model }: { t: SpTheme; tr: PageT; model: SongPageModel }) {
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

/** The small photo credit line; the song page puts it at the very end of the Info tab. */
export function PhotoCredit({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const tr = usePageT()
  if (!model.photo) return null
  return (
    <Text style={[styles.photo, { color: t.ink500 }]}>
      {`${tr("songPage.about.photo")}: ${tr("songPage.about.photo.note", { credit: model.photo.credit.replace(/^Photo:\s*/i, "") })}`}
    </Text>
  )
}

type InfoRow = { label: string; value?: string; note?: string; chips?: SongCollection[] }

/** A collection as a round chip that opens its list. */
function CollectionChip({ t, tr, item }: { t: SpTheme; tr: PageT; item: SongCollection }) {
  const router = useRouter()
  return (
    <SpPress
      onPress={() => router.push(href(item.href))}
      accessibilityRole="link"
      accessibilityLabel={tr("songInfo.collection.a11y", { name: item.label })}
      pressedScale={0.96}
      style={[styles.chip, { backgroundColor: t.sand100, borderColor: t.sand400 }]}
    >
      <Text style={[styles.chipText, { color: t.ink900 }]}>{item.label}</Text>
    </SpPress>
  )
}

export function AboutBody({ t, model, withPhoto = true }: { t: SpTheme; model: SongPageModel; withPhoto?: boolean }) {
  const tr = usePageT()
  const language = useLanguage()
  const number = model.song?.number
  const dateLines = useColleagueDateLines(number)
  const collections = useMemo(() => (number === undefined ? [] : collectionsOfSong(number, PS_ALL, allCollections)), [number])
  const rows: InfoRow[] = model.about.map((row: AboutRow): InfoRow => {
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
  // where and when it was written, as the colleagues' documents say (only when they say more than the date, or the date is missing or differs), and the collections: right after the composition date
  const official = model.about.find((r): r is Extract<AboutRow, { id: "composed" }> => r.id === "composed")?.date ?? null
  const extra: InfoRow[] = []
  const written = colleagueDateRow(dateLines, language, official)
  if (written) extra.push({ label: tr("songInfo.datePlace"), value: written.text, note: tr("songInfo.datePlace.source") })
  if (collections.length) extra.push({ label: tr("songInfo.collections"), chips: collections })
  const at = Math.max(0, model.about.findIndex((r) => r.id === "composed")) + 1
  rows.splice(at, 0, ...extra)
  return (
    <View style={styles.body}>
      {rows.map((row, i) => (
        <View key={row.label} style={[styles.row, { borderTopColor: t.sand400, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth }]}>
          <Eyebrow t={{ ...t, ink800: t.ink500 }}>{row.label}</Eyebrow>
          {row.value ? <Text style={[styles.value, { color: t.ink900 }]}>{row.value}</Text> : null}
          {row.note ? <Text style={[styles.note, { color: t.ink500 }]}>{row.note}</Text> : null}
          {row.chips ? (
            <View style={styles.chips}>
              {row.chips.map((c) => (
                <CollectionChip key={c.key} t={t} tr={tr} item={c} />
              ))}
            </View>
          ) : null}
        </View>
      ))}
      {withPhoto ? <PhotoCredit t={t} model={model} /> : null}
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
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 4 },
  chip: { minHeight: 44, borderRadius: 9999, borderWidth: 1, paddingHorizontal: 16, justifyContent: "center" },
  chipText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  photo: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingTop: 12, paddingBottom: 4 },
})
