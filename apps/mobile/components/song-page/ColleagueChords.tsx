import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { SpChordTokens, type SpChordToken } from "@/components/song-v2/SpSections"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { pairsOfChart, softCaseLine } from "@/lib/psColleagues/chordPairs"
import { chartsDiffer, type ColleagueChart } from "@/lib/psColleagues/chords"
import { useColleagueT, type ColleagueT } from "@/lib/psColleagues/copy"
import { usePageT } from "@/lib/songPage/pageCopy"

import { TunePill } from "./TunePill"
import { Eyebrow } from "./ui"

function capoText(tc: ColleagueT, chart: ColleagueChart): string {
  if (chart.capo.kind === "fret") return tc("colleagues.chords.capo", { capo: chart.capo.fret })
  return tc(chart.capo.kind === "none" ? "colleagues.chords.capo.none" : "colleagues.chords.capo.unstated")
}

function sourceText(tc: ColleagueT, chart: ColleagueChart): string {
  return chart.source.kind === "pdf" ? tc("colleagues.chords.from.pdf", { file: chart.source.file }) : tc("colleagues.chords.from.docx")
}

/** The chord symbols of the document laid over its words as chord letters over words, the way the song's own chart is drawn. */
function useTokens(chart: ColleagueChart): SpChordToken[] {
  return useMemo(() => {
    const out: SpChordToken[] = []
    pairsOfChart(chart, softCaseLine).forEach((row, r) => {
      if (row.gapBefore) out.push({ key: `gap-${r}`, chord: "", word: "", swara: "", lineBreak: true })
      row.tokens.forEach((token, w) => {
        if (token.breakBefore) out.push({ key: `lb-${r}-${w}`, chord: "", word: "", swara: "", lineBreak: true })
        out.push({ key: `${r}-${w}`, chord: token.chord, word: token.word, swara: "" })
      })
      out.push({ key: `br-${r}`, chord: "", word: "", swara: "", lineBreak: true })
    })
    return out
  }, [chart])
}

/** One chord page: the same white card as the song's own, its source on top, its capo in the same small pill, then the chord letters over the words. */
function Page({ t, tc, chart }: { t: SpTheme; tc: ColleagueT; chart: ColleagueChart }) {
  const tr = usePageT()
  const tokens = useTokens(chart)
  const capo = capoText(tc, chart)
  return (
    <View style={[styles.card, { backgroundColor: t.white, borderColor: t.sand300 }]}>
      <View style={styles.head}>
        <Eyebrow t={t} style={styles.source}>
          {sourceText(tc, chart)}
        </Eyebrow>
        <TunePill t={t} text={capo} a11y={capo} />
      </View>
      {chart.hasWords ? null : <Text style={[styles.note, { color: t.ink500 }]}>{tc("colleagues.chords.wordsOnly.no")}</Text>}
      <View style={styles.block}>
        <Eyebrow t={t}>{tr("songChords.lines")}</Eyebrow>
        <SpChordTokens t={t} tokens={tokens} wordFont={amFonts.medium} />
      </View>
    </View>
  )
}

/**
 * THE COLLEAGUES' CHORDS: the chord pages of the colleagues' archives, under the song's own chords card, drawn the way that
 * card is (chord letters over the words, the same card and capo pill, the same wrapping). One card per source (the Word
 * documents; a chord-sheet PDF), each with its capo as that source writes it. When both exist and they disagree, both are
 * shown and one line says so; they are never merged. Pages without chord symbols are never passed in.
 */
export function ColleagueChords({ t, charts }: { t: SpTheme; charts: readonly ColleagueChart[] }) {
  const tc = useColleagueT()
  if (charts.length === 0) return null
  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={[styles.title, { color: t.ink900 }]}>
        {tc("colleagues.chords.title")}
      </Text>
      {chartsDiffer(charts) ? <Text style={[styles.note, { color: t.ink500 }]}>{tc("colleagues.chords.differ")}</Text> : null}
      {charts.map((chart) => (
        <Page key={chart.source.kind === "pdf" ? `pdf:${chart.source.file}` : "docx"} t={t} tc={tc} chart={chart} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  title: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  card: { borderRadius: 28, borderWidth: 1, padding: 16, gap: 16, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  source: { flex: 1, flexShrink: 1 },
  block: { gap: 8 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
