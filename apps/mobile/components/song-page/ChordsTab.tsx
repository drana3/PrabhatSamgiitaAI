import { useCallback, useMemo, useRef, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { SpEmptyNote } from "@/components/song-v2/SpHonest"
import { ChordBox, SpChordTokens, type SpChordToken } from "@/components/song-v2/SpSections"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useColleagueCharts } from "@/hooks/useColleagueData"
import { useCommunityChords } from "@/hooks/useCommunityChords"
import { usePianoSheets } from "@/hooks/usePianoSheets"
import { columnsInScript, layoutChart, type WordColumn } from "@/lib/songPage/chordChart"
import { capoBadgeKey, easierCapo, membersRowKey, pianoRowKey, soundsInKey } from "@/lib/songPage/chordsTab"
import { requestKey } from "@/lib/songPage/honest"
import type { ScriptId } from "@/lib/songPage/scripts"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"
import { harmoniumChord, keyLabel, shapeCards, spShape, strumNote, swaraAt, swaraRow, uniqueChords } from "@/lib/songPage/spChords"
import { pianoEditHref, pianoHref } from "@/lib/pianoNotes/links"
import { useSongPageStore } from "@/stores/songPageStore"
import { href } from "@/utils/href"

import { ColleagueChords } from "./ColleagueChords"
import { SheetRow } from "./Rows"
import type { PageUi } from "./state"
import { TunePill } from "./TunePill"
import { DemoTag, Eyebrow, Segmented } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/** The scripts the chord letters can sit over here: Roman always, Devanagari when the song has a Devanagari text. */
type ChordScript = Extract<ScriptId, "roman" | "devanagari">

/**
 * The letters of the chart laid over the lyric words. The script is this tab's own choice (Roman until the reader picks
 * Devanagari with the small switch here), never the Lyrics tab's: a line whose Devanagari text has another number of
 * words than the Roman one stays Roman (no guessing).
 */
function useChordTokens(model: SongPageModel, script: ChordScript): SpChordToken[] {
  const { chart, sources } = model
  const instrument = useSongPageStore((s) => s.instrument)
  const capo = useSongPageStore((s) => s.capo)
  const harmoniumKey = useSongPageStore((s) => s.harmoniumKey)
  return useMemo(() => {
    if (!chart) return []
    // the letters over the lyrics are the shapes you play (with the capo on), the one reading that needs no explaining
    const showChord = (chord: string) => (instrument === "harmonium" ? harmoniumChord(chord, chart.baseKey, harmoniumKey) : spShape(chord, capo))
    const laid = layoutChart(sources.roman, chart, showChord, true)
    const out: SpChordToken[] = []
    laid.forEach((base, li) => {
      const other = script === "devanagari" ? sources.devanagari[li] : undefined
      const columns: WordColumn[] = other ? (columnsInScript(base, other) ?? base) : base
      columns.forEach((column, wi) =>
        out.push({ key: `${li}-${wi}`, chord: column.chord ?? "", word: column.word, swara: instrument === "harmonium" ? swaraAt(li, wi) : "" }),
      )
      out.push({ key: `br-${li}`, chord: "", word: "", swara: "", lineBreak: true })
    })
    return out
  }, [chart, sources.roman, sources.devanagari, script, instrument, capo, harmoniumKey])
}

/**
 * THE CHORDS CARD: everything about playing the song in one white card. Guitar or Harmonium on top; then the heading
 * "Shapes to play" with ONE small pill at its right that says what the song sounds in and where the capo sits ("C · No
 * capo": a tap opens the sheet with the arrows; it was two big badges on a row of their own until 11 November 2026);
 * "Easier: capo 5" when another fret gives easier shapes; the row of shapes; the chord letters over the words.
 */
function ChordsCard({ t, tr, model, ui }: { t: SpTheme; tr: PageT; model: SongPageModel; ui: PageUi }) {
  const chart = model.chart
  const [script, setScript] = useState<ChordScript>("roman")
  const tokens = useChordTokens(model, script)
  const hasDevanagari = model.sources.devanagari.length > 0
  const instrument = useSongPageStore((s) => s.instrument)
  const capo = useSongPageStore((s) => s.capo)
  const harmoniumKey = useSongPageStore((s) => s.harmoniumKey)
  const setInstrument = useSongPageStore((s) => s.setInstrument)
  const setCapo = useSongPageStore((s) => s.setCapo)
  if (!chart) return null
  const sounding = uniqueChords(chart.lines.flatMap((line) => line.placements.map((p) => p.chord)))
  const guitar = instrument === "guitar"
  const key = soundsInKey(chart.baseKey, sounding)
  const easier = guitar ? easierCapo(sounding, capo) : null
  const open = () => ui.setChordSheet("capo")
  const capoText = tr(capoBadgeKey(capo), { capo })
  const soundsText = key ? tr("songChords.sounds", { key }) : null
  const saText = tr("songChords.sa", { key: keyLabel(harmoniumKey) })
  const pillText = guitar ? `${key ?? "?"} · ${capoText}` : saText
  const pillSpoken = guitar ? [soundsText, capoText].filter(Boolean).join(", ") : saText
  const wordFont = script === "devanagari" ? amFonts.devanagari : amFonts.medium
  return (
    <View style={[styles.card, { backgroundColor: t.white, borderColor: t.sand300 }]}>
      <Segmented
        t={t}
        equal
        label={tr("songPage.chords.title")}
        value={instrument}
        onChange={setInstrument}
        items={[
          { id: "guitar", label: tr("songPage.chords.instrument.guitar") },
          { id: "harmonium", label: tr("songPage.chords.instrument.harmonium") },
        ]}
      />
      <View style={styles.block}>
        <View style={styles.shapesHead}>
          <Eyebrow t={t}>{tr("songChords.shapes")}</Eyebrow>
          <TunePill t={t} text={pillText} a11y={tr("songChords.badge.a11y", { text: pillSpoken })} onPress={open} />
        </View>
        <Text style={[styles.strum, { color: t.ink500 }]}>{tr(guitar ? "hmGuide.sp.guitar" : "hmGuide.sp.harmonium")}</Text>
        {easier !== null ? (
          <SpPress
            onPress={() => setCapo(easier)}
            accessibilityLabel={tr("songChords.easier.a11y", { capo: easier })}
            pressedScale={0.98}
            style={[styles.hint, { backgroundColor: t.dark ? t.sand100 : t.sage200 }]}
          >
            <Text style={[styles.hintText, { color: t.dark ? t.ink900 : t.sage900 }]}>{tr("songChords.easier", { capo: easier })}</Text>
          </SpPress>
        ) : null}
        {guitar ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shapes} style={styles.shapesScroll}>
            {shapeCards(sounding, capo).map((card, i) => (
              <ChordBox key={`${card.name}-${i}`} t={t} card={card} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.swaras}>
            {swaraRow(harmoniumKey).map((w) => (
              <View key={w.s} style={[styles.swara, { backgroundColor: t.sand100 }]}>
                <Text style={[styles.swaraB, { color: t.ink800 }]}>{w.s}</Text>
                <Text style={[styles.swaraS, { color: t.accentText }]}>{w.n}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.block}>
        <View style={styles.linesHead}>
          <Eyebrow t={t} style={styles.linesTitle}>
            {tr("songChords.lines")}
          </Eyebrow>
          {hasDevanagari ? (
            <Segmented
              t={t}
              compact
              items={[
                { id: "roman", label: tr("songChords.script.roman") },
                { id: "devanagari", label: tr("songChords.script.devanagari") },
              ]}
              value={script}
              onChange={setScript}
              label={tr("songChords.script.a11y")}
            />
          ) : null}
        </View>
        <Text style={[styles.strum, { color: t.ink500 }]}>{strumNote(instrument, chart.strum)}</Text>
        <SpChordTokens t={t} tokens={tokens} wordFont={wordFont} />
      </View>
    </View>
  )
}

/** The two rows under the card: charts members offered (opens a sheet) and the piano notes (opens their page). */
function MoreRows({ t, tr, model, ui }: { t: SpTheme; tr: PageT; model: SongPageModel; ui: PageUi }) {
  const router = useRouter()
  const number = model.song?.number ?? null
  const community = useCommunityChords(number)
  const piano = usePianoSheets(number === null ? null : { kind: "song", number })
  // coming back from "Add notes" shows the new version
  const first = useRef(true)
  const reload = piano.reload
  useFocusEffect(
    useCallback(() => {
      if (!first.current) void reload()
      first.current = false
    }, [reload]),
  )
  if (number === null || !model.song) return null
  const members = community.items.length
  const pianoCount = piano.state.items.length
  const target = { kind: "song", number } as const
  const title = model.song.title
  return (
    <View style={[styles.rows, { backgroundColor: t.white, borderColor: t.sand300 }]}>
      <SheetRow
        t={t}
        title={tr(membersRowKey(members), { count: members })}
        detail={members > 0 ? undefined : tr("songChords.members.add")}
        onPress={() => ui.setChordSheet("members")}
      />
      <SheetRow
        t={t}
        last
        title={tr(pianoRowKey(pianoCount), { count: pianoCount })}
        detail={pianoCount > 0 ? undefined : tr("songChords.piano.add")}
        onPress={() => router.push(href(pianoCount > 0 ? pianoHref(target, title) : pianoEditHref({ target, title })))}
      />
    </View>
  )
}

/** Tab 3, Chords: the card (or the honest "no chords yet" with a request) and the two rows. */
export function ChordsTab({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const key = model.song ? requestKey("chords", model.song.number) : ""
  // the chord pages of the colleagues' archives (only those with chord symbols), under the song's own card
  const colleagueCharts = useColleagueCharts(model.song?.number)
  return (
    <View style={styles.tab}>
      {model.chart ? <DemoTag t={t} /> : null}
      {model.chart ? (
        <View style={styles.pad}>
          <ChordsCard t={t} tr={tr} model={model} ui={ui} />
        </View>
      ) : colleagueCharts.length > 0 ? null : (
        <SpEmptyNote
          t={t}
          text={model.notationUrl ? `${tr("songPage.chords.none")} ${tr("songPage.chords.pdfNote")}` : tr("songPage.chords.none")}
          requested={ui.requested.includes(key)}
          onRequest={() => {
            ui.request(key)
            model.sendNote()
          }}
          requestLabel={tr("songPage.chords.request")}
          link={model.notationUrl ? { label: tr("songPage.chords.notationPdf"), url: model.notationUrl } : null}
        />
      )}
      {colleagueCharts.length > 0 ? (
        <View style={styles.pad}>
          <ColleagueChords t={t} charts={colleagueCharts} />
        </View>
      ) : null}
      <View style={styles.pad}>
        <MoreRows t={t} tr={tr} model={model} ui={ui} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  tab: { gap: 16, paddingTop: 8 },
  pad: { paddingHorizontal: 20 },
  card: { borderRadius: 28, borderWidth: 1, padding: 16, gap: 16 },
  shapesHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  linesHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  linesTitle: { flexShrink: 1 },
  hint: { minHeight: 36, alignSelf: "flex-start", borderRadius: 18, paddingHorizontal: 14, justifyContent: "center" },
  hintText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18 },
  block: { gap: 8 },
  shapesScroll: { marginHorizontal: -16 },
  shapes: { paddingHorizontal: 16, gap: 8 },
  swaras: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swara: { minWidth: 44, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8, alignItems: "center" },
  swaraB: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  swaraS: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16 },
  strum: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  rows: { borderRadius: 28, borderWidth: 1, overflow: "hidden" },
})
