import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { chartsDiffer, type ColleagueChart } from "@/lib/psColleagues/chords"
import { useColleagueT, type ColleagueT } from "@/lib/psColleagues/copy"

import { Eyebrow } from "./ui"

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, Menlo, Consolas, monospace" }) as string

function capoText(tc: ColleagueT, chart: ColleagueChart): string {
  if (chart.capo.kind === "fret") return tc("colleagues.chords.capo", { capo: chart.capo.fret })
  return tc(chart.capo.kind === "none" ? "colleagues.chords.capo.none" : "colleagues.chords.capo.unstated")
}

function sourceText(tc: ColleagueT, chart: ColleagueChart): string {
  return chart.source.kind === "pdf" ? tc("colleagues.chords.from.pdf", { file: chart.source.file }) : tc("colleagues.chords.from.docx")
}

/** One chord page exactly as the document has it: monospace, spaces kept, chord symbols over the words, scrolling sideways. */
function Page({ t, tc, chart, scale }: { t: SpTheme; tc: ColleagueT; chart: ColleagueChart; scale: number }) {
  const size = Math.round(12 * scale)
  const lineHeight = Math.round(size * 1.5)
  const chordSet = new Set(chart.chordLines)
  return (
    <View style={[styles.card, { backgroundColor: t.white, borderColor: t.sand300 }]}>
      <Eyebrow t={t}>{sourceText(tc, chart)}</Eyebrow>
      <Text style={[styles.capo, { color: t.ink900 }]}>{capoText(tc, chart)}</Text>
      {chart.hasWords ? null : <Text style={[styles.note, { color: t.ink500 }]}>{tc("colleagues.chords.wordsOnly.no")}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel={tc("colleagues.chords.page.a11y")} style={styles.pageScroll}>
        <Text selectable style={[styles.page, { fontSize: size, lineHeight, color: t.ink900 }]}>
          {chart.lines.map((line, i) => (
            <Text key={i} style={chordSet.has(i) ? { color: t.accentText, fontFamily: MONO, fontWeight: "700" } : undefined}>
              {`${line}${i < chart.lines.length - 1 ? "\n" : ""}`}
            </Text>
          ))}
        </Text>
      </ScrollView>
    </View>
  )
}

/**
 * THE COLLEAGUES' CHORDS: the chord pages of the colleagues' archives, under the song's own chords card. One card per
 * source (the Word documents; a chord-sheet PDF), each with its capo as that source writes it. When both exist and they
 * disagree, both are shown and one line says so; they are never merged. Pages without chord symbols are never passed in.
 */
export function ColleagueChords({ t, charts, scale }: { t: SpTheme; charts: readonly ColleagueChart[]; scale: number }) {
  const tc = useColleagueT()
  if (charts.length === 0) return null
  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={[styles.title, { color: t.ink900 }]}>
        {tc("colleagues.chords.title")}
      </Text>
      {chartsDiffer(charts) ? <Text style={[styles.note, { color: t.ink500 }]}>{tc("colleagues.chords.differ")}</Text> : null}
      {charts.map((chart) => (
        <Page key={chart.source.kind === "pdf" ? `pdf:${chart.source.file}` : "docx"} t={t} tc={tc} chart={chart} scale={scale} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  title: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  card: { borderRadius: 28, borderWidth: 1, padding: 16, gap: 8, overflow: "hidden" },
  capo: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  pageScroll: { marginHorizontal: -4 },
  page: { fontFamily: MONO, paddingHorizontal: 4, paddingVertical: 4, flexShrink: 0 },
})
