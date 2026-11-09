import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { SpChordTokens, type SpChordToken } from "@/components/song-v2/SpSections"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { chartOf, type ChordInstrument } from "@/lib/songChords/types"
import { layoutChart, type ChordChart } from "@/lib/songPage/chordChart"
import { harmoniumChord, spShape } from "@/lib/songPage/spChords"

/**
 * A chart as letters over the lyrics, drawn by the song page's own pieces (`layoutChart` and `SpChordTokens`), so what
 * a member previews is what the song page will show. `shapesCapo` turns the sounding chords of a guitar chart back
 * into the shapes (the capo the author played with); a harmonium or piano chart is shown in its own key (Sa).
 */
export function chartTokens(input: { romanLines: readonly string[]; chart: ChordChart; instrument: ChordInstrument; capo: number; harmoniumKey?: string }): SpChordToken[] {
  const { romanLines, chart, instrument, capo } = input
  const show = (chord: string) => (instrument !== "guitar" ? harmoniumChord(chord, chart.baseKey, input.harmoniumKey ?? chart.baseKey ?? "C") : spShape(chord, capo))
  const laid = layoutChart([...romanLines], chart, show, true)
  const out: SpChordToken[] = []
  laid.forEach((columns, li) => {
    columns.forEach((column, wi) => out.push({ key: `${li}-${wi}`, chord: column.chord ?? "", word: column.word, swara: "" }))
    out.push({ key: `br-${li}`, chord: "", word: "", swara: "", lineBreak: true })
  })
  return out
}

export function ChartPreview({
  t,
  romanLines,
  proposal,
  capo,
  harmoniumKey,
  caption,
}: {
  t: SpTheme
  romanLines: readonly string[]
  proposal: { baseKey: string; strum: string | null; lines: Array<{ placements: Array<{ word: number; chord: string }> }>; instrument: ChordInstrument }
  capo: number
  harmoniumKey?: string
  caption?: string
}) {
  const tokens = useMemo(
    () => chartTokens({ romanLines, chart: chartOf({ ...proposal, status: "published" }), instrument: proposal.instrument, capo, harmoniumKey }),
    [romanLines, proposal, capo, harmoniumKey],
  )
  return (
    <View style={s.root}>
      {caption ? <Text style={[s.caption, { color: t.ink500 }]}>{caption}</Text> : null}
      {proposal.instrument === "guitar" && proposal.strum ? <Text style={[s.caption, { color: t.ink500 }]}>{proposal.strum}</Text> : null}
      <SpChordTokens t={t} tokens={tokens} />
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 8 },
  caption: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
