import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { chartTokens } from "@/components/song-chords/ChartPreview"
import { SpChordTokens, SpKeyRow } from "@/components/song-v2/SpSections"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { chartOf, type ChordProposal } from "@/lib/songChords/types"
import { clampCapo } from "@/lib/songPage/chords"
import { SP_NOTES, capoName, guitarKeyNote, harmoniumKeyNote, keyLabel, keyPitch, uniqueChords } from "@/lib/songPage/spChords"

/**
 * The pieces of a community chart that the Prabhat Samgiita song page and the page of a recording share: who the chart
 * was based on, where the author played it, and the chart itself (letters over the words, with a capo or Sa control that
 * starts where the author played). A chart is any `ChartLike`: a song's `ChordProposal`, or a chart of a recording.
 */
export type ChartLike = Pick<ChordProposal, "id" | "instrument" | "baseKey" | "capo" | "strum" | "lines" | "status"> & { basedOn?: ChordProposal["basedOn"] }

function nextNote(key: string, direction: 1 | -1): string {
  return SP_NOTES[(keyPitch(key) + direction + 12) % 12]
}

/** "Based on a chart by <name>", a link to the original when it is on the page, plain words when it is not (deleted, or another tab). */
export function ChartCreditLine({ t, chart, onOpenOriginal }: { t: SpTheme; chart: Pick<ChartLike, "basedOn">; onOpenOriginal?: (id: string) => void }) {
  const tr = useT()
  if (!chart.basedOn) return null
  const credit = chart.basedOn.name ? tr("chordSong.basedOn", { name: chart.basedOn.name }) : tr("chordSong.basedOn.anonymous")
  const originalId = chart.basedOn.id
  return originalId && onOpenOriginal ? (
    <SpPress accessibilityLabel={`${credit}. ${tr("chordSong.basedOn.a11y")}`} onPress={() => onOpenOriginal(originalId)} style={s.link}>
      <Text style={[s.linkText, { color: t.accentText }]}>{credit}</Text>
    </SpPress>
  ) : (
    <Text style={[s.note, { color: t.ink500 }]}>{credit}</Text>
  )
}

/** "Guitar, capo 2, key D" / "Harmonium, Sa C": where the author played the chart. */
export function ChartMeta({ t, chart }: { t: SpTheme; chart: Pick<ChartLike, "instrument" | "capo" | "baseKey"> }) {
  const tr = useT()
  return (
    <Text style={[s.note, { color: t.ink500 }]}>
      {chart.instrument === "guitar"
        ? chart.capo > 0
          ? tr("chordOffer.meta.guitar", { capo: chart.capo, key: keyLabel(chart.baseKey) })
          : tr("chordOffer.meta.guitarNoCapo", { key: keyLabel(chart.baseKey) })
        : chart.instrument === "piano"
          ? tr("chordOffer.meta.piano", { key: keyLabel(chart.baseKey) })
          : tr("chordOffer.meta.harmonium", { key: keyLabel(chart.baseKey) })}
    </Text>
  )
}

/**
 * The chart itself under the song page's own pieces: the capo (guitar) or Sa (harmonium) control, which starts where the
 * author played and which the reader moves for themselves, the strum pattern, and the letters over the words.
 * `romanLines` are the words the chart's word numbers refer to.
 */
export function ChartBody({ t, chart, romanLines, wordFont }: { t: SpTheme; chart: ChartLike; romanLines: readonly string[]; wordFont?: string }) {
  const tr = useT()
  const [capo, setCapo] = useState(chart.capo)
  const [sa, setSa] = useState(chart.baseKey)
  useEffect(() => {
    setCapo(chart.capo)
    setSa(chart.baseKey)
  }, [chart.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const tokens = useMemo(
    () => (romanLines.length ? chartTokens({ romanLines, chart: chartOf(chart), instrument: chart.instrument, capo, harmoniumKey: sa }) : []),
    [chart, romanLines, capo, sa],
  )
  const sounding = uniqueChords(chart.lines.flatMap((l) => l.placements.map((p) => p.chord)))
  const guitar = chart.instrument === "guitar"

  return (
    <>
      <View style={s.pad}>
        {guitar ? (
          <SpKeyRow
            t={t}
            label={tr("chordSong.capo.label")}
            noteText={guitarKeyNote(sounding, capo)}
            value={capoName(capo)}
            onDown={() => setCapo((c) => clampCapo(c - 1))}
            onUp={() => setCapo((c) => clampCapo(c + 1))}
            downLabel={tr("chordOffer.capo.lower")}
            upLabel={tr("chordOffer.capo.raise")}
          />
        ) : (
          <SpKeyRow
            t={t}
            label={chart.instrument === "piano" ? tr("chordSong.key.label") : tr("chordOffer.key.harmonium.label")}
            noteText={chart.instrument === "piano" ? tr("chordSong.key.note", { key: keyLabel(sa) }) : harmoniumKeyNote(sa)}
            value={keyLabel(sa)}
            onDown={() => setSa((k) => nextNote(k, -1))}
            onUp={() => setSa((k) => nextNote(k, 1))}
            downLabel={tr("chordOffer.capo.lower")}
            upLabel={tr("chordOffer.capo.raise")}
          />
        )}
        <Text style={[s.note, { color: t.ink500 }]}>{guitar ? tr("chordSong.capoShown", { capo: chart.capo }) : tr(chart.instrument === "piano" ? "chordSong.keyShown.piano" : "chordSong.keyShown", { key: keyLabel(chart.baseKey) })}</Text>
      </View>
      {tokens.length ? (
        <View style={s.pad}>
          {guitar && chart.strum ? <Text style={[s.note, { color: t.ink500 }]}>{chart.strum}</Text> : null}
          <SpChordTokens t={t} tokens={tokens} wordFont={wordFont} />
        </View>
      ) : null}
    </>
  )
}

const s = StyleSheet.create({
  pad: { paddingHorizontal: 20, gap: 8 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  linkText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20 },
})
