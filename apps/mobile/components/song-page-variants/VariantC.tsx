import { useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { lyricLanguageName } from "@/lib/songPage/lyricLanguages"
import { useVariantT } from "@/lib/songPageVariants/copy"
import { variantLayout } from "@/lib/songPageVariants/layout"
import { splitStanzas } from "@/lib/songPageVariants/stanzas"

import { Actions, ThumbHero, songTitle } from "./Hero"
import { LyricsBlock, LyricsToolbar, WordOverlay } from "./LyricsBlock"
import { MeaningBlock, MeaningHeader } from "./Meaning"
import { PageSheets } from "./Sheets"
import { Shell } from "./Shell"
import { usePageUi } from "./state"
import { ChevronRow, QuietNote } from "./ui"
import type { SongVariantModel } from "./useSongVariantModel"

/** C "Stanzas + sheets": the lyrics as stanza cards with a fold for the meaning; Play, Words, Watch and About are rows that open sheets. */
export function VariantC({ t, model }: { t: SpTheme; model: SongVariantModel }) {
  const tr = useVariantT()
  const ui = usePageUi()
  const layout = useMemo(() => variantLayout("c", model.facts), [model.facts])
  const stanzas = useMemo(() => splitStanzas(model.lines.primary), [model.lines.primary])
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const [single, setSingle] = useState(false)
  const folds = layout.meaning === "stanza-folds"
  const allOpen = stanzas.length > 0 && stanzas.every((_, i) => open[i])
  const language = lyricLanguageName(model.meaning.language)
  const pairsOf = (from: number, to: number) => (model.align.kind === "pairs" ? model.align.pairs.slice(from, to + 1).map((p) => p.meaning).join("\n") : "")

  const videoCount = model.videos.length
  const playSub = model.chart ? tr("songVariant.play.rowChords") : model.notationUrl ? tr("songVariant.play.rowNonePdf") : tr("songVariant.play.rowNone")
  const watchSub = videoCount ? tr("songVariant.watch.count", { count: videoCount }) : tr("songVariant.watch.none")
  const wordsSub = !model.glosses ? tr("songVariant.lyrics.noWords") : ui.wordsOn ? tr("songVariant.row.wordsOn") : tr("songVariant.row.wordsOff")

  return (
    <Shell
      t={t}
      model={model}
      title={songTitle(model)}
      top="plain"
      heroHeight={0}
      hero={
        <>
          <ThumbHero t={t} model={model} />
          <Actions t={t} model={model} />
        </>
      }
      onMore={() => model.setSheet("actions")}
      overlay={<WordOverlay t={t} model={model} ui={ui} bottom={96} />}
      sheets={<PageSheets t={t} model={model} ui={ui} />}
    >
      <LyricsToolbar t={t} model={model} ui={ui} wordsChip={false} />
      {layout.meaning !== "none" ? <MeaningHeader t={t} meaning={model.meaning} onChange={() => ui.setSheet("meaning")} /> : null}
      {!model.lines.primary.length ? <QuietNote t={t}>{tr("songVariant.lyrics.empty")}</QuietNote> : null}
      <View style={styles.stanzas}>
        {stanzas.map((s, i) => (
          <View key={i} style={[styles.card, { backgroundColor: t.white, borderColor: t.sand300 }]}>
            <Text style={[styles.label, { color: t.ink500 }]}>{tr("songVariant.stanza", { n: i + 1 })}</Text>
            <View style={styles.lines}>
              <LyricsBlock t={t} model={model} ui={ui} from={s.from} to={s.to} />
            </View>
            {folds ? (
              <>
                <SpPress
                  onPress={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                  accessibilityLabel={tr("songVariant.meaning.fold", { language })}
                  accessibilityState={{ selected: Boolean(open[i]) }}
                  style={[styles.fold, { borderTopColor: t.sand300 }]}
                >
                  <Text style={[styles.foldText, { color: t.ink800 }]}>{tr("songVariant.meaning.fold", { language })}</Text>
                  <SpIcon name={open[i] ? "minus" : "plus"} size={20} color={t.ink800} strokeWidth={2} />
                </SpPress>
                {open[i] ? <Text style={[styles.meaning, { color: t.ink900 }]}>{pairsOf(s.from, s.to)}</Text> : null}
              </>
            ) : null}
          </View>
        ))}
      </View>
      {folds ? (
        <SpPress
          onPress={() => setOpen(allOpen ? {} : Object.fromEntries(stanzas.map((_, i) => [i, true])))}
          accessibilityLabel={allOpen ? tr("songVariant.meaning.collapseAll") : tr("songVariant.meaning.expandAll")}
          style={styles.expandAll}
        >
          <Text style={[styles.expandText, { color: t.accentText }]}>{allOpen ? tr("songVariant.meaning.collapseAll") : tr("songVariant.meaning.expandAll")}</Text>
        </SpPress>
      ) : null}
      {layout.meaning === "stanza-single" ? (
        <View style={[styles.card, styles.singleCard, { backgroundColor: t.white, borderColor: t.sand300 }]}>
          <SpPress
            onPress={() => setSingle(!single)}
            accessibilityLabel={tr("songVariant.meaning.fold", { language })}
            accessibilityState={{ selected: single }}
            style={styles.foldPlain}
          >
            <Text style={[styles.foldText, { color: t.ink800 }]}>{tr("songVariant.meaning.fold", { language })}</Text>
            <SpIcon name={single ? "minus" : "plus"} size={20} color={t.ink800} strokeWidth={2} />
          </SpPress>
          {single ? <MeaningBlock t={t} meaning={model.meaning} note={tr("songVariant.meaning.stackedNote")} /> : null}
        </View>
      ) : null}

      <View style={styles.rows}>
        <ChevronRow t={t} title={tr("songVariant.play.title")} subtitle={playSub} onPress={() => ui.setSheet("play")} />
        <ChevronRow
          t={t}
          title={tr("songVariant.row.words")}
          subtitle={wordsSub}
          onPress={model.glosses ? () => { ui.setWordsOn(!ui.wordsOn) } : undefined}
        />
        <ChevronRow t={t} title={tr("songVariant.row.watch")} subtitle={watchSub} onPress={() => ui.setSheet("watch")} />
        <ChevronRow t={t} title={tr("songVariant.row.about")} onPress={() => ui.setSheet("about")} last />
      </View>
    </Shell>
  )
}

const styles = StyleSheet.create({
  stanzas: { gap: 12, paddingHorizontal: 20 },
  card: { borderRadius: 28, borderWidth: 1, overflow: "hidden" },
  singleCard: { marginHorizontal: 20, marginTop: 12, padding: 16 },
  label: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", paddingHorizontal: 20, paddingTop: 16 },
  lines: { paddingTop: 4, paddingBottom: 8 },
  fold: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth },
  foldPlain: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 4 },
  foldText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  meaning: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 24, paddingHorizontal: 20, paddingBottom: 16 },
  expandAll: { minHeight: 44, justifyContent: "center", paddingHorizontal: 20, alignSelf: "flex-start", marginTop: 4 },
  expandText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  rows: { marginTop: 24 },
})
