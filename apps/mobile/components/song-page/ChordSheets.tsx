import { StyleSheet, Text, View } from "react-native"

import { CommunityChords } from "@/components/song-chords/CommunityChords"
import { SpKeyRow } from "@/components/song-v2/SpSections"
import { SpSheet } from "@/components/song-v2/SpSheet"
import { SpPill, SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { easierCapo } from "@/lib/songPage/chordsTab"
import { usePageT } from "@/lib/songPage/pageCopy"
import { capoName, guitarKeyNote, harmoniumKeyNote, keyLabel, uniqueChords } from "@/lib/songPage/spChords"
import { useSongPageStore } from "@/stores/songPageStore"

import type { PageUi } from "./state"
import type { SongPageModel } from "./useSongPageModel"

/** The capo (guitar) or the key (harmonium) with the arrows, and "Easier: capo 5" when another fret is easier. */
function CapoSheet({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const instrument = useSongPageStore((s) => s.instrument)
  const capo = useSongPageStore((s) => s.capo)
  const harmoniumKey = useSongPageStore((s) => s.harmoniumKey)
  const setCapo = useSongPageStore((s) => s.setCapo)
  const stepKey = useSongPageStore((s) => s.stepHarmoniumKey)
  const chart = model.chart
  const guitar = instrument === "guitar"
  const sounding = chart ? uniqueChords(chart.lines.flatMap((line) => line.placements.map((p) => p.chord))) : []
  const easier = guitar ? easierCapo(sounding, capo) : null
  const title = tr(guitar ? "songChords.sheet.capo" : "songChords.sheet.key")
  return (
    <SpSheet t={t} visible={ui.chordSheet === "capo"} onClose={() => ui.setChordSheet(null)} label={title}>
      <Text accessibilityRole="header" style={[styles.title, { color: t.ink900 }]}>
        {title}
      </Text>
      <View style={styles.pad}>
        {guitar ? (
          <SpKeyRow
            t={t}
            label={tr("songPage.chords.capo")}
            noteText={guitarKeyNote(sounding, capo)}
            value={capoName(capo)}
            onDown={() => setCapo(capo - 1)}
            onUp={() => setCapo(capo + 1)}
            downLabel={tr("songPage.chords.capo.lower")}
            upLabel={tr("songPage.chords.capo.raise")}
          />
        ) : (
          <SpKeyRow
            t={t}
            label={tr("songPage.chords.key")}
            noteText={harmoniumKeyNote(harmoniumKey)}
            value={keyLabel(harmoniumKey)}
            onDown={() => stepKey(-1)}
            onUp={() => stepKey(1)}
            downLabel={tr("songPage.chords.key.lower")}
            upLabel={tr("songPage.chords.key.raise")}
          />
        )}
        <Text style={[styles.explain, { color: t.ink500 }]}>{tr(guitar ? "hmGuide.sp.capoNote" : "hmGuide.sp.keyNote")}</Text>
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
        <View style={styles.done}>
          <SpPill t={t} variant="brand" label={tr("songChords.sheet.done")} onPress={() => ui.setChordSheet(null)} />
        </View>
      </View>
    </SpSheet>
  )
}

/** The charts members offered for this song: the same block the page showed under its chords, now behind one row. */
function MembersSheet({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const open = ui.chordSheet === "members"
  const song = model.song
  return (
    <SpSheet t={t} visible={open} onClose={() => ui.setChordSheet(null)} label={tr("songChords.members.title")}>
      <Text accessibilityRole="header" style={[styles.title, { color: t.ink900 }]}>
        {tr("songChords.members.title")}
      </Text>
      {open && song ? <CommunityChords t={t} songNumber={song.number} romanLines={model.sources.roman} cards /> : null}
      <View style={{ height: 24 }} />
    </SpSheet>
  )
}

export function ChordSheets({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  return (
    <>
      <CapoSheet t={t} model={model} ui={ui} />
      <MembersSheet t={t} model={model} ui={ui} />
    </>
  )
}

const styles = StyleSheet.create({
  title: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 30, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  pad: { paddingHorizontal: 20, gap: 12 },
  explain: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  hint: { minHeight: 44, borderRadius: 20, paddingHorizontal: 16, justifyContent: "center" },
  hintText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  done: { flexDirection: "row", paddingTop: 8, paddingBottom: 24 },
})
