import { Pressable, StyleSheet, Text, View } from "react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpEmptyNote } from "@/components/song-v2/SpHonest"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { splitWords } from "@/lib/songPage/chordChart"
import { requestKey } from "@/lib/songPage/honest"
import { lyricLanguageName } from "@/lib/songPage/lyricLanguages"
import type { LyricBlock, LyricLine } from "@/lib/songPage/lyricStructure"
import { lyricsLayout } from "@/lib/songPage/pageSections"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"
import type { ScriptId } from "@/lib/songPage/scripts"

import { sourceLabel } from "./Meaning"
import { scriptName } from "./Sheets"
import { TEXT_SCALES, type PageUi, type TextScaleIndex } from "./state"
import { QuietNote, SectionTitle, Segmented, ToolPill, type SegItem } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

const INDENT_STEP = 16

function lineFont(script: ScriptId, scale: number, weight: "bold" | "regular") {
  const size = Math.round(20 * scale)
  const lineHeight = Math.round(size * 1.4)
  if (script === "devanagari") return { fontFamily: weight === "bold" ? amFonts.devanagariBold : amFonts.devanagari, fontSize: size, lineHeight }
  if (script === "bengali") return { fontFamily: weight === "bold" ? amFonts.bengaliBold : amFonts.bengali, fontSize: size, lineHeight }
  return { fontFamily: weight === "bold" ? amFonts.bold : amFonts.regular, fontSize: size, lineHeight }
}

/**
 * The compact toolbar under the lyrics header: how to show the lyrics (lines or word by word), the script, the
 * translation language (the one chooser of the page) and the text size. Every control is at least 44 high.
 */
function LyricsToolbar({ t, model, ui, tr }: { t: SpTheme; model: SongPageModel; ui: PageUi; tr: PageT }) {
  const views: Array<SegItem<"lines" | "words">> = [
    { id: "lines", label: tr("songPage.lyrics.view.lines") },
    { id: "words", label: tr("songPage.lyrics.view.words") },
  ]
  const sizes: Array<SegItem<"0" | "1" | "2">> = [
    { id: "0", label: "A", fontSize: 14, a11y: tr("songPage.lyrics.size.small") },
    { id: "1", label: "A", fontSize: 18, a11y: tr("songPage.lyrics.size.medium") },
    { id: "2", label: "A", fontSize: 22, a11y: tr("songPage.lyrics.size.large") },
  ]
  const script = scriptName(tr, model.lines.primaryScript)
  const language = lyricLanguageName(model.meaning.wanted)
  return (
    <View style={styles.toolbar}>
      <View style={styles.toolRow}>
        <Segmented t={t} items={views} value={ui.view} onChange={(id) => ui.setView(id)} label={tr("songPage.lyrics.view.a11y")} />
        <ToolPill t={t} value={script} a11y={tr("songPage.script.a11y", { script })} onPress={() => ui.setSheet("script")} />
      </View>
      <View style={styles.toolRow}>
        <ToolPill t={t} value={language} a11y={tr("songPage.lyrics.language.a11y", { language })} onPress={() => ui.setSheet("language")} />
        <Segmented
          t={t}
          items={sizes}
          value={String(ui.scaleIndex) as "0" | "1" | "2"}
          onChange={(id) => ui.setScaleIndex(Number(id) as TextScaleIndex)}
          label={tr("songPage.lyrics.size.a11y")}
        />
      </View>
    </View>
  )
}

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
  /** word meanings: a word is a button only where the song has a real one */
  glossOf: ((line: number, word: number) => string | null) | null
  selected: string | null
  onSelect: (key: string | null) => void
}

function LineRow({ t, tr, line, block, inRun, script, scale, translation, glossOf, selected, onSelect }: LineRowProps) {
  // inside a refrain block the label says it; a lone repeated line gets its own small mark
  const again = line.repeatOf !== null
  const color = again ? t.ink500 : t.ink900
  const font = lineFont(script, scale, again ? "regular" : "bold")
  const words = glossOf ? splitWords(line.text) : []
  const anyGloss = glossOf ? words.some((_, wi) => glossOf(line.index, wi)) : false
  return (
    <View style={[styles.line, translation ? styles.linePair : null, { marginLeft: line.indent * INDENT_STEP }]}>
      {anyGloss ? (
        <View style={styles.wordRow}>
          {words.map((word, wi) => {
            const key = `${line.index}-${wi}`
            const has = Boolean(glossOf?.(line.index, wi))
            const on = selected === key
            if (!has) return <Text key={key} style={[font, { color }, styles.word]}>{word}</Text>
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={word}
                accessibilityState={{ selected: on }}
                onPress={() => onSelect(on ? null : key)}
                style={[styles.wordHit, on && { backgroundColor: t.action }]}
              >
                <Text style={[font, { color: on ? t.onAction : color }, !on && { textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationColor: t.ink300 }]}>{word}</Text>
              </Pressable>
            )
          })}
        </View>
      ) : (
        <Text style={[font, { color }]}>{line.text}</Text>
      )}
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
function LyricBlocks({ t, tr, model, ui, pairs, words }: { t: SpTheme; tr: PageT; model: SongPageModel; ui: PageUi; pairs: ReadonlyArray<{ meaning: string }> | null; words: boolean }) {
  const glossOf = words && model.glosses ? model.glossOf : null
  return (
    <View style={styles.blocks}>
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
              glossOf={glossOf}
              selected={ui.selected}
              onSelect={ui.setSelected}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

/** The meaning of the tapped word, in the page (never floating), only for a word that has a real one. */
function WordCard({ t, tr, model, ui }: { t: SpTheme; tr: PageT; model: SongPageModel; ui: PageUi }) {
  if (!ui.selected) return null
  const [l = "", w = ""] = ui.selected.split("-")
  const word = splitWords(model.lines.primary[Number(l)] ?? "")[Number(w)] ?? ""
  const meaning = model.glossOf(Number(l), Number(w))
  return (
    <View style={[styles.wordCard, { backgroundColor: t.white, borderColor: t.sand400 }]} accessibilityLiveRegion="polite">
      <View style={styles.wordCardText}>
        <Text style={[styles.wordCardWord, { color: t.ink900 }]}>{word}</Text>
        <Text style={[styles.wordCardMeaning, { color: t.ink800 }]}>{meaning || tr("songPage.words.missing")}</Text>
      </View>
      <SpPress onPress={() => ui.setSelected(null)} accessibilityLabel={tr("songPage.sheet.close")} style={styles.wordCardClose}>
        <SpIcon name="close" size={20} color={t.ink800} strokeWidth={2} />
      </SpPress>
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
 * Section 1 of the page. Roman or Sanskrit lines in the chosen script. The translation sits under each line only
 * when it truly lines up (`alignLines`); otherwise the lyrics come first, a small note says why, and a button opens
 * the whole translation. "Word by word" shows real word meanings or says plainly that there are none.
 */
export function LyricsSection({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const layout = lyricsLayout(model.facts)
  const pairs = layout.kind === "pairs" && model.align.kind === "pairs" ? model.align.pairs : null
  const wordsAsked = ui.view === "words"
  const hasLines = layout.kind !== "empty"
  const expandLabel = layout.kind === "pairs" ? tr("songPage.lyrics.expand.full") : tr("songPage.lyrics.expand.show")
  const key = model.song ? requestKey("words", model.song.number) : ""
  return (
    <View>
      <SectionTitle t={t}>{tr("songPage.tab.lyrics")}</SectionTitle>
      {hasLines ? <LyricsToolbar t={t} model={model} ui={ui} tr={tr} /> : null}
      {!hasLines ? (
        <QuietNote t={t}>{tr("songPage.lyrics.empty")}</QuietNote>
      ) : wordsAsked && !model.glosses ? (
        <View style={styles.wordsNone}>
          <SpEmptyNote
            t={t}
            text={tr("songPage.words.none")}
            requested={ui.requested.includes(key)}
            onRequest={() => ui.request(key)}
            requestLabel={tr("songPage.words.request")}
          />
        </View>
      ) : (
        <View style={styles.body}>
          {wordsAsked ? <WordCard t={t} tr={tr} model={model} ui={ui} /> : null}
          <LyricBlocks t={t} tr={tr} model={model} ui={ui} pairs={wordsAsked ? null : pairs} words={wordsAsked} />
        </View>
      )}
      {hasLines && !wordsAsked && layout.kind !== "plain" ? (
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

export { TEXT_SCALES }

const styles = StyleSheet.create({
  toolbar: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  toolRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  body: { paddingHorizontal: 20 },
  blocks: {},
  blockGap: { marginTop: 24 },
  blockLabel: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase", paddingTop: 4, paddingBottom: 2 },
  line: { paddingVertical: 6 },
  linePair: { paddingVertical: 10 },
  wordRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  word: { marginRight: 6 },
  wordHit: { paddingHorizontal: 6, paddingVertical: 2, marginRight: 2, borderRadius: 10, minHeight: 44, justifyContent: "center" },
  mark: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  markText: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  pair: { fontFamily: amFonts.regular, marginTop: 2 },
  wordsNone: { paddingTop: 4 },
  wordCard: { borderRadius: 24, borderWidth: 1, paddingLeft: 20, paddingRight: 8, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  wordCardText: { flex: 1, gap: 2 },
  wordCardWord: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 26 },
  wordCardMeaning: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22 },
  wordCardClose: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  expand: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  expandBtn: { minHeight: 50, borderRadius: 9999, borderWidth: 1, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  expandText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  flip: { transform: [{ rotate: "180deg" }] },
  full: { borderRadius: 24, borderWidth: 1, padding: 20, gap: 10 },
  fullHead: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase" },
  fullText: { fontFamily: amFonts.regular, fontSize: 17, lineHeight: 26 },
})
