import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { lyricLanguage } from "@/lib/songPage/lyricLanguages"
import { buildWordGrid, type GridLine, type GridWord, type WordGrid } from "@/lib/songPage/blockTabs"
import { splitWords } from "@/lib/songPage/chordChart"
import { requestKey } from "@/lib/songPage/honest"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"

import { lineFont } from "./lineFont"
import type { PageUi } from "./state"
import { DemoTag } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/**
 * THE WORD BY WORD PAGE (board 4, variant 1: interlinear). The words of the song as text: each word over its
 * meaning, wrapping from line to line like a printed interlinear. Tapping a word lights the same word everywhere
 * in the song and says how often it is sung. Meanings come only from real word data; with none, the real words
 * are still there with their real counts, and the tab says so plainly (never an invented meaning).
 */

function EmptyBar({ t, tr, model, ui }: { t: SpTheme; tr: PageT; model: SongPageModel; ui: PageUi }) {
  const sp = useT()
  const key = model.song ? requestKey("words", model.song.number) : ""
  const requested = ui.requested.includes(key)
  return (
    <View style={[styles.empty, { borderColor: t.ink500 }]}>
      <Text style={[styles.emptyText, { color: t.ink500 }]}>{tr("songPage.words.none")}</Text>
      {requested ? (
        <Text style={[styles.request, { color: t.ink500 }]}>{sp("sp.requested")}</Text>
      ) : (
        <SpPress onPress={() => ui.request(key)} accessibilityLabel={tr("songPage.words.request.a11y")} style={styles.requestHit}>
          <Text style={[styles.request, { color: t.orange700 }]}>{tr("songPage.words.request")}</Text>
        </SpPress>
      )}
    </View>
  )
}

function InfoCard({ t, tr, model, ui, grid }: { t: SpTheme; tr: PageT; model: SongPageModel; ui: PageUi; grid: WordGrid }) {
  const key = ui.selected
  const word = key ? findWord(model, grid, key) : null
  return (
    <View style={[styles.info, { backgroundColor: t.white }]} accessibilityLiveRegion="polite">
      {key && word ? (
        <View style={styles.infoText}>
          <Text style={[styles.infoWord, { color: t.ink900 }]}>
            {word.text}
            {word.gloss ? <Text style={{ color: t.accentText }}>{` · ${word.gloss}`}</Text> : null}
          </Text>
          <Text style={[styles.infoSub, { color: t.ink800 }]}>{tr("songPage.words.times", { count: grid.counts[key] ?? 0 })}</Text>
        </View>
      ) : (
        <Text style={[styles.infoHint, { color: t.ink500 }]}>{tr("songPage.words.tap")}</Text>
      )}
    </View>
  )
}

function findWord(model: SongPageModel, grid: WordGrid, key: string): { text: string; gloss: string | null } | null {
  for (const line of grid.lines) {
    if (line.kind !== "words") continue
    const hit = line.words.find((w) => w.key === key)
    if (hit) return { text: hit.label, gloss: model.glossOf(hit.line, hit.index) }
  }
  return null
}

function WordCell({ t, word, gloss, lit, script, scale, onPress }: { t: SpTheme; word: GridWord; gloss: string | null; lit: boolean; script: SongPageModel["lines"]["primaryScript"]; scale: number; onPress: () => void }) {
  const font = lineFont(script, scale, "bold", 17)
  return (
    <SpPress
      onPress={onPress}
      accessibilityLabel={gloss ? `${word.label}. ${gloss}` : word.label}
      accessibilityState={{ selected: lit }}
      pressedScale={0.96}
      style={[styles.cell, lit && { backgroundColor: t.orange100 }]}
    >
      <Text style={[font, { color: t.ink900 }]}>{word.label}</Text>
      <View style={[styles.glossRule, { borderTopColor: t.sand400 }, !gloss && styles.glossRuleEmpty]}>
        <Text style={[styles.gloss, { color: gloss ? t.accentText : t.ink500, opacity: gloss ? 1 : 0.55 }]} numberOfLines={2}>
          {gloss ?? "·"}
        </Text>
      </View>
    </SpPress>
  )
}

function GridRow({ t, tr, row, model, ui, lit }: { t: SpTheme; tr: PageT; row: GridLine; model: SongPageModel; ui: PageUi; lit: string | null }) {
  if (row.kind === "again") {
    return (
      <View style={styles.again}>
        <PlayerIcon name="repeat" size={14} color={t.ink500} />
        <Text style={[styles.againText, { color: t.ink500 }]} numberOfLines={2}>{`${tr("songPage.lyrics.again")}: ${row.text}`}</Text>
      </View>
    )
  }
  return (
    <View style={styles.line}>
      <Text style={[styles.lineNo, { color: t.ink500 }]}>{row.number}</Text>
      <View style={styles.words}>
        {row.words.map((word) => (
          <WordCell
            key={`${word.line}-${word.index}`}
            t={t}
            word={word}
            gloss={model.glossOf(word.line, word.index)}
            lit={lit === word.key}
            script={model.lines.primaryScript}
            scale={ui.scale}
            onPress={() => ui.setSelected(lit === word.key ? null : word.key)}
          />
        ))}
      </View>
    </View>
  )
}

/** The small line under the switch that names the language of the meanings; the choice itself is behind the round "Aa" button. */
function LanguageNote({ t, tr, model }: { t: SpTheme; tr: PageT; model: SongPageModel }) {
  const codes = model.wordLanguages
  if (!codes.length) return null
  const code = codes.includes(model.wordLanguage) ? model.wordLanguage : (codes[0] as string)
  const language = lyricLanguage(code)?.native ?? code.toUpperCase()
  return (
    <View style={styles.language}>
      <Text style={[styles.languageText, { color: t.ink500 }]}>{tr("songWords.language.now", { language })}</Text>
    </View>
  )
}

export function WordByWordBody({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const grid = useMemo(() => buildWordGrid(model.structure, splitWords), [model.structure])
  if (!grid.lines.length) return null
  return (
    <View>
      <LanguageNote t={t} tr={tr} model={model} />
      {model.glosses ? (model.demo ? <DemoTag t={t} /> : null) : <EmptyBar t={t} tr={tr} model={model} ui={ui} />}
      <InfoCard t={t} tr={tr} model={model} ui={ui} grid={grid} />
      <View>
        {grid.lines.map((row) => (
          <GridRow key={row.line} t={t} tr={tr} row={row} model={model} ui={ui} lit={ui.selected} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  language: { paddingHorizontal: 20, paddingBottom: 12 },
  languageText: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
  empty: { marginHorizontal: 20, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderWidth: 1.5, borderStyle: "dashed", borderRadius: 18, paddingLeft: 16, paddingRight: 4, minHeight: 52 },
  emptyText: { flex: 1, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22, paddingVertical: 12 },
  requestHit: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  request: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20, paddingRight: 12 },
  info: { marginHorizontal: 20, marginBottom: 18, minHeight: 62, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, justifyContent: "center" },
  infoText: { gap: 0 },
  infoWord: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  infoSub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  infoHint: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20 },
  line: { flexDirection: "row", gap: 6, paddingLeft: 16, paddingRight: 20, paddingBottom: 18 },
  lineNo: { width: 22, textAlign: "right", fontFamily: amFonts.semi, fontSize: 12, lineHeight: 20, paddingTop: 10 },
  words: { flex: 1, flexDirection: "row", flexWrap: "wrap", columnGap: 4, rowGap: 6 },
  cell: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 5, borderRadius: 10, alignItems: "flex-start" },
  glossRule: { alignSelf: "stretch", marginTop: 3, paddingTop: 3, borderTopWidth: 1, maxWidth: 130 },
  glossRuleEmpty: { borderStyle: "dashed" },
  gloss: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  again: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 44, paddingRight: 20, paddingBottom: 18 },
  againText: { flex: 1, fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
