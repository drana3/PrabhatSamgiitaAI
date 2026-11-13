import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { SpChordTokens, type SpChordToken } from "@/components/song-v2/SpSections"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { alignChart } from "@/lib/psColleagues/chordAlign"
import { pairsOfChart, softCaseLine } from "@/lib/psColleagues/chordPairs"
import type { ColleagueChart } from "@/lib/psColleagues/chords"
import { useColleagueT, type ColleagueT } from "@/lib/psColleagues/copy"
import { columnsInScript } from "@/lib/songPage/chordChart"
import { usePageT } from "@/lib/songPage/pageCopy"

import { ChordScriptSwitch, type ChordScript } from "./ChordVersions"
import { TunePill } from "./TunePill"
import { Eyebrow } from "./ui"

function capoText(tc: ColleagueT, chart: ColleagueChart): string {
  if (chart.capo.kind === "fret") return tc("colleagues.chords.capo", { capo: chart.capo.fret })
  return tc(chart.capo.kind === "none" ? "colleagues.chords.capo.none" : "colleagues.chords.capo.unstated")
}

function sourceText(tc: ColleagueT, chart: ColleagueChart): string {
  return chart.source.kind === "pdf" ? tc("colleagues.chords.from.pdf", { file: chart.source.file }) : tc("colleagues.chords.from.docx")
}

/** The id the version switch gives a colleague's page. */
export function colleagueVersionId(chart: ColleagueChart): string {
  return chart.source.kind === "pdf" ? `pdf:${chart.source.file}` : "docx"
}

const lineBreak = (key: string): SpChordToken => ({ key, chord: "", word: "", swara: "", lineBreak: true })

/** The document's own rows (no song text to lay them over, or no honest way to): chord letters over its words, as the page wrote them. */
function useOwnTokens(chart: ColleagueChart): SpChordToken[] {
  return useMemo(() => {
    const out: SpChordToken[] = []
    pairsOfChart(chart, softCaseLine).forEach((row, r) => {
      if (row.gapBefore) out.push(lineBreak(`gap-${r}`))
      row.tokens.forEach((token, w) => {
        if (token.breakBefore) out.push(lineBreak(`lb-${r}-${w}`))
        out.push({ key: `${r}-${w}`, chord: token.chord, word: token.word, swara: "" })
      })
      out.push(lineBreak(`br-${r}`))
    })
    return out
  }, [chart])
}

/**
 * The colleague's chords on the lines of the song itself: every chord symbol over the word of the song's own text it
 * stood over in the document, in the script chosen (the symbols stay Latin). Null when the document cannot be laid
 * over the song without guessing (see lib/psColleagues/chordAlign): the card then shows the document's own rows.
 */
function useAlignedTokens(chart: ColleagueChart, roman: readonly string[], devanagari: readonly string[], script: ChordScript): SpChordToken[] | null {
  return useMemo(() => {
    const result = alignChart(chart, roman)
    if (result.kind !== "aligned") return null
    const out: SpChordToken[] = []
    result.apart.forEach((chords, r) => {
      chords.forEach((chord, c) => out.push({ key: `ap-${r}-${c}`, chord, word: "", swara: "" }))
      out.push(lineBreak(`apb-${r}`))
    })
    result.columns.forEach((base, li) => {
      const other = script === "devanagari" ? devanagari[li] : undefined
      const columns = other ? (columnsInScript(base, other) ?? base) : base
      columns.forEach((column, wi) => out.push({ key: `${li}-${wi}`, chord: column.chord ?? "", word: column.word, swara: "" }))
      out.push(lineBreak(`br-${li}`))
    })
    return out
  }, [chart, roman, devanagari, script])
}

/**
 * ONE COLLEAGUE'S CHORD PAGE as a version of the Chords tab: the same white card as the song's own, its source and its
 * capo on top, then the chord letters over the lines of the song's text (Roman or Devanagari, the reader's choice) in
 * the same type and the same wrapping. A page that cannot be laid over the lines honestly is a neat separate list in
 * the same type, with one line saying so. Nothing is changed in the document's chords or words.
 */
export function ColleagueVersion({
  t,
  chart,
  roman,
  devanagari,
  script,
  onScript,
  differs,
}: {
  t: SpTheme
  chart: ColleagueChart
  roman: readonly string[]
  devanagari: readonly string[]
  script: ChordScript
  onScript: (script: ChordScript) => void
  /** both a Word page and a PDF exist and they disagree */
  differs: boolean
}) {
  const tc = useColleagueT()
  const tr = usePageT()
  const aligned = useAlignedTokens(chart, roman, devanagari, script)
  const own = useOwnTokens(chart)
  const capo = capoText(tc, chart)
  const hasDevanagari = devanagari.length > 0
  const apart = aligned === null
  const wordFont = !apart && script === "devanagari" ? amFonts.devanagari : amFonts.medium
  return (
    <View style={[styles.card, { backgroundColor: t.white, borderColor: t.sand300 }]}>
      <View style={styles.head}>
        <Eyebrow t={t} style={styles.source}>
          {sourceText(tc, chart)}
        </Eyebrow>
        <TunePill t={t} text={capo} a11y={capo} />
      </View>
      {differs ? <Text style={[styles.note, { color: t.ink500 }]}>{tc("colleagues.chords.differ")}</Text> : null}
      <View style={styles.block}>
        <View style={styles.linesHead}>
          <Eyebrow t={t} style={styles.linesTitle}>
            {apart ? tr("songChords.apart.title") : tr("songChords.lines")}
          </Eyebrow>
          {!apart && hasDevanagari ? <ChordScriptSwitch t={t} value={script} onChange={onScript} /> : null}
        </View>
        {apart ? <Text style={[styles.note, { color: t.ink500 }]}>{chart.hasWords ? tr("songChords.apart.note") : tc("colleagues.chords.wordsOnly.no")}</Text> : null}
        <SpChordTokens t={t} tokens={aligned ?? own} wordFont={wordFont} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, borderWidth: 1, padding: 16, gap: 16, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  source: { flex: 1, flexShrink: 1 },
  block: { gap: 8 },
  linesHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  linesTitle: { flexShrink: 1 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
