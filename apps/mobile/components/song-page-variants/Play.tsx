import { useCallback, useMemo } from "react"
import { Linking, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpChords, type SpChordToken } from "@/components/song-v2/SpSections"
import { SpPill } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { columnsInScript, layoutChart, type WordColumn } from "@/lib/songPage/chordChart"
import {
  capoHint,
  capoName,
  guitarKeyNote,
  harmoniumChord,
  harmoniumKeyNote,
  keyLabel,
  shapeCards,
  spBestCapo,
  spShape,
  strumNote,
  swaraAt,
  swaraRow,
  uniqueChords,
} from "@/lib/songPage/spChords"
import { useVariantT } from "@/lib/songPageVariants/copy"
import { useSongPageStore } from "@/stores/songPageStore"
import { href } from "@/utils/href"

import { DemoTag } from "./ui"
import type { SongVariantModel } from "./useSongVariantModel"

/** The honest state: nobody has added chords for this song. A PDF button only when the catalogue has a PDF. */
export function NoChords({ t, model }: { t: SpTheme; model: SongVariantModel }) {
  const tr = useVariantT()
  return (
    <View style={[styles.empty, { backgroundColor: t.white, borderColor: t.sand300 }]}>
      <View style={styles.emptyTop}>
        <View style={[styles.emptyIcon, { backgroundColor: t.sand300 }]}>
          <SpIcon name="listPlus" size={22} color={t.ink500} />
        </View>
        <View style={styles.emptyText}>
          <Text style={[styles.emptyTitle, { color: t.ink900 }]}>{tr("songVariant.play.noChords")}</Text>
          {model.notationUrl ? <Text style={[styles.emptySub, { color: t.ink500 }]}>{tr("songVariant.play.pdfNote")}</Text> : null}
        </View>
      </View>
      <View style={styles.emptyButtons}>
        <SpPill t={t} label={tr("songVariant.play.request")} onPress={model.sendNote} style={styles.btn} />
        {model.notationUrl ? (
          <SpPill t={t} variant="sand" label={tr("songVariant.play.notationPdf")} onPress={() => void Linking.openURL(model.notationUrl as string)} style={styles.btn} />
        ) : null}
      </View>
    </View>
  )
}

/**
 * Chords with the full controls (instrument, capo, key). Real songs never get here: no song has chord data
 * yet. Only the preview's demo songs do, and they carry the Demo content tag.
 */
export function ChordsDemo({ t, model }: { t: SpTheme; model: SongVariantModel }) {
  const router = useRouter()
  const { chart, lines, sources } = model
  const instrument = useSongPageStore((s) => s.instrument)
  const capo = useSongPageStore((s) => s.capo)
  const chordMode = useSongPageStore((s) => s.chordMode)
  const harmoniumKey = useSongPageStore((s) => s.harmoniumKey)
  const settings = useSongPageStore.getState
  const showChord = useCallback(
    (chord: string) => {
      if (instrument === "harmonium") return harmoniumChord(chord, chart?.baseKey, harmoniumKey)
      return chordMode === "shapes" ? spShape(chord, capo) : chord
    },
    [chart?.baseKey, instrument, chordMode, capo, harmoniumKey],
  )
  const tokens: SpChordToken[] = useMemo(() => {
    if (!chart) return []
    const laid = layoutChart(sources.roman, chart, showChord, true)
    const out: SpChordToken[] = []
    lines.primary.forEach((line, li) => {
      const base = laid[li] ?? []
      const columns: WordColumn[] = lines.primaryScript === "roman" ? base : (columnsInScript(base, line) ?? base)
      columns.forEach((column, wi) =>
        out.push({ key: `${li}-${wi}`, chord: column.chord ?? "", word: column.word, swara: instrument === "harmonium" ? swaraAt(li, wi) : "" }),
      )
      out.push({ key: `br-${li}`, chord: "", word: "", swara: "", lineBreak: true })
    })
    return out
  }, [chart, sources.roman, showChord, lines, instrument])
  if (!chart) return null
  const sounding = uniqueChords(chart.lines.flatMap((line) => line.placements.map((p) => p.chord)))
  const hint = capoHint(sounding, capo)
  return (
    <View>
      <DemoTag t={t} />
      <View style={{ height: 8 }} />
      <SpChords
        t={t}
        instrument={instrument}
        onInstrument={(next) => settings().setInstrument(next)}
        capo={capoName(capo)}
        capoNoteText={guitarKeyNote(sounding, capo)}
        onCapoDown={() => settings().setCapo(capo - 1)}
        onCapoUp={() => settings().setCapo(capo + 1)}
        capoHintText={hint.text}
        capoHintAction={hint.action}
        onCapoBest={() => settings().setCapo(spBestCapo(sounding))}
        cards={shapeCards(sounding, capo)}
        mode={chordMode}
        onMode={(next) => settings().setChordMode(next)}
        keyName={keyLabel(harmoniumKey)}
        keyNoteText={harmoniumKeyNote(harmoniumKey)}
        onKeyDown={() => settings().stepHarmoniumKey(-1)}
        onKeyUp={() => settings().stepHarmoniumKey(1)}
        swaras={swaraRow(harmoniumKey)}
        onHow={() => router.push(href("/harmonium-v2/chords"))}
        strum={strumNote(instrument, chart.strum)}
        tokens={tokens}
        script={lines.primaryScript}
      />
    </View>
  )
}

/** The Play page (B), the Play section (A) and the Play along sheet (C): the sing-along player, then chords or the honest empty state. */
export function PlayPanel({ t, model }: { t: SpTheme; model: SongVariantModel }) {
  const tr = useVariantT()
  return (
    <View style={styles.panel}>
      <View style={styles.singRow}>
        <SpPill t={t} icon="play" label={tr("songVariant.play.sing")} onPress={model.openKaraoke} />
      </View>
      {model.chart ? <ChordsDemo t={t} model={model} /> : <NoChords t={t} model={model} />}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { gap: 16, paddingBottom: 8 },
  singRow: { paddingHorizontal: 20 },
  empty: { marginHorizontal: 20, borderRadius: 30, borderWidth: 1, padding: 20, gap: 16 },
  emptyTop: { flexDirection: "row", gap: 14, alignItems: "center" },
  emptyIcon: { width: 44, height: 44, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  emptyText: { flex: 1, gap: 2 },
  emptyTitle: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 24 },
  emptySub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  emptyButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: { paddingHorizontal: 22 },
})
