import { StyleSheet, Text, View } from "react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { lyricLanguageName } from "@/lib/songPage/lyricLanguages"
import type { LyricBlock, LyricLine } from "@/lib/songPage/lyricStructure"
import { lyricsLayout } from "@/lib/songPage/pageSections"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"
import type { ScriptId } from "@/lib/songPage/scripts"

import { sourceLabel } from "./Commentary"
import { lineFont } from "./lineFont"
import type { PageUi } from "./state"
import { QuietNote } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/**
 * THE LYRICS TAB. Only the lyrics and the way the translation sits with them, nothing else: no title, no
 * controls (the tabs and the "Aa" options belong to the block around it, TextBlock.tsx). Dada is still choosing
 * the final layout of lyrics with translation, so this file is the one thing to swap: it takes the page model
 * and the page state and draws the tab body.
 */

const INDENT_STEP = 16

type LineRowProps = {
  t: SpTheme
  tr: PageT
  line: LyricLine
  block: LyricBlock
  /** the line before in the block repeats too: one mark for the run, not one per line */
  inRun: boolean
  script: ScriptId
  scale: number
  translation: string | null
}

function LineRow({ t, tr, line, block, inRun, script, scale, translation }: LineRowProps) {
  // inside a refrain block the label says it; a lone repeated line gets its own small mark
  const again = line.repeatOf !== null
  const color = again ? t.ink500 : t.ink900
  const font = lineFont(script, scale, again ? "regular" : "bold")
  return (
    <View style={[styles.line, translation ? styles.linePair : null, { marginLeft: line.indent * INDENT_STEP }]}>
      <Text style={[font, { color }]}>{line.text}</Text>
      {again && !block.label && !inRun ? (
        <View style={styles.mark}>
          <PlayerIcon name="repeat" size={16} color={t.ink500} />
          <Text style={[styles.markText, { color: t.ink500 }]}>{tr("songPage.lyrics.again")}</Text>
        </View>
      ) : null}
      {translation ? <Text style={[styles.pair, { color: t.ink500, fontSize: Math.round(15 * Math.max(1, scale)), lineHeight: Math.round(22 * Math.max(1, scale)) }]}>{translation}</Text> : null}
    </View>
  )
}

/** The lyrics as the text stores them: stanzas apart, a refrain labelled only when the data says so, lines in order. */
function LyricBlocks({ t, tr, model, ui, pairs }: { t: SpTheme; tr: PageT; model: SongPageModel; ui: PageUi; pairs: ReadonlyArray<{ meaning: string }> | null }) {
  return (
    <View>
      {model.structure.blocks.map((block, bi) => (
        <View key={bi} style={bi > 0 ? styles.blockGap : null}>
          {block.label ? (
            <Text style={[styles.blockLabel, { color: t.ink500 }]}>{block.labelText ?? tr("songPage.lyrics.refrain")}</Text>
          ) : null}
          {block.lines.map((line, li) => (
            <LineRow
              key={line.index}
              t={t}
              tr={tr}
              line={line}
              block={block}
              inRun={li > 0 && block.lines[li - 1]?.repeatOf !== null}
              script={model.lines.primaryScript}
              scale={ui.scale}
              translation={pairs?.[line.index]?.meaning ?? null}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

/** The whole translation of the song, alone, without the lyrics. */
function FullTranslation({ t, tr, model }: { t: SpTheme; tr: PageT; model: SongPageModel }) {
  const meaning = model.meaning
  const paragraphs = meaning.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return (
    <View style={[styles.full, { backgroundColor: t.white, borderColor: t.sand400 }]}>
      <Text style={[styles.fullHead, { color: t.ink500 }]}>
        {`${lyricLanguageName(meaning.language)}${meaning.status === "ready" ? ` · ${sourceLabel(tr, meaning.source)}` : ""}`}
      </Text>
      {meaning.status === "loading" ? (
        <Text style={[styles.fullText, { color: t.ink500 }]}>{tr("songPage.lyrics.expand.loading", { language: lyricLanguageName(meaning.wanted) })}</Text>
      ) : meaning.status === "none" ? (
        <Text style={[styles.fullText, { color: t.ink500 }]}>{tr("songPage.lyrics.expand.none")}</Text>
      ) : (
        paragraphs.map((p, i) => (
          <Text key={i} style={[styles.fullText, { color: t.ink900 }]}>{p}</Text>
        ))
      )}
    </View>
  )
}

/**
 * Roman or Sanskrit lines in the chosen script. The translation sits under each line only when it truly lines up
 * (`alignLines`) and the reader has it switched on; otherwise the lyrics come first, a small note says why, and a
 * button opens the whole translation.
 */
export function LyricsBody({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const layout = lyricsLayout(model.facts, ui.translationOn)
  const pairs = layout.kind === "pairs" && model.align.kind === "pairs" ? model.align.pairs : null
  const hasLines = layout.kind !== "empty"
  const expandLabel = layout.kind === "pairs" ? tr("songPage.lyrics.expand.full") : tr("songPage.lyrics.expand.show")
  if (!hasLines) return <QuietNote t={t}>{tr("songPage.lyrics.empty")}</QuietNote>
  return (
    <View>
      <View style={styles.body}>
        <LyricBlocks t={t} tr={tr} model={model} ui={ui} pairs={pairs} />
      </View>
      {layout.kind !== "plain" ? (
        <View style={styles.expand}>
          {layout.kind === "stacked" && layout.note ? <Text style={[styles.note, { color: t.ink500 }]}>{tr("songPage.lyrics.expand.note")}</Text> : null}
          <SpPress
            onPress={() => ui.setTranslationOpen(!ui.translationOpen)}
            accessibilityLabel={ui.translationOpen ? tr("songPage.lyrics.expand.hide") : expandLabel}
            accessibilityState={{ selected: ui.translationOpen }}
            style={[styles.expandBtn, { backgroundColor: t.white, borderColor: t.sand400 }]}
          >
            <Text style={[styles.expandText, { color: t.ink900 }]}>{ui.translationOpen ? tr("songPage.lyrics.expand.hide") : expandLabel}</Text>
            <View style={ui.translationOpen ? styles.flip : null}>
              <SpIcon name="chevDown" size={20} color={t.ink500} strokeWidth={2} />
            </View>
          </SpPress>
          {ui.translationOpen ? <FullTranslation t={t} tr={tr} model={model} /> : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20 },
  blockGap: { marginTop: 24 },
  blockLabel: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase", paddingTop: 4, paddingBottom: 2 },
  line: { paddingVertical: 6 },
  linePair: { paddingVertical: 10 },
  mark: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  markText: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  pair: { fontFamily: amFonts.regular, marginTop: 2 },
  expand: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  expandBtn: { minHeight: 50, borderRadius: 9999, borderWidth: 1, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  expandText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  flip: { transform: [{ rotate: "180deg" }] },
  full: { borderRadius: 24, borderWidth: 1, padding: 20, gap: 10 },
  fullHead: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase" },
  fullText: { fontFamily: amFonts.regular, fontSize: 17, lineHeight: 26 },
})
