import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { splitWords } from "@/lib/songPage/chordChart"
import type { ScriptId } from "@/lib/songPage/scripts"
import { useVariantT } from "@/lib/songPageVariants/copy"

export const TEXT_SCALES = [0.9, 1, 1.2] as const
export type TextScaleIndex = 0 | 1 | 2

function lineFont(script: ScriptId, scale: number, weight: "bold" | "regular") {
  const size = Math.round(20 * scale)
  const lineHeight = Math.round(size * 1.4)
  if (script === "devanagari") return { fontFamily: weight === "bold" ? amFonts.devanagariBold : amFonts.devanagari, fontSize: size, lineHeight }
  if (script === "bengali") return { fontFamily: weight === "bold" ? amFonts.bengaliBold : amFonts.bengali, fontSize: size, lineHeight }
  return { fontFamily: weight === "bold" ? amFonts.bold : amFonts.regular, fontSize: size, lineHeight }
}

export type LyricLinesProps = {
  t: SpTheme
  lines: string[]
  script: ScriptId
  scale: number
  /** per line: the index of the earlier line it repeats, or null */
  repeats: Array<number | null>
  /** variant A: a translation under each line, one for one (null in the other variants) */
  pairs?: string[] | null
  /** what the translation under the lines is written in, for screen readers */
  /** real word meanings: a word is a button only when it has one */
  glossOf?: ((line: number, word: number) => string | null) | null
  selected: string | null
  onSelect: (key: string | null) => void
  /** the line numbers that start a stanza, with the label to draw above them (variant C) */
  hideRepeatMarks?: boolean
}

/**
 * The one lyrics block of the page. Each line on its own row, in the chosen script, at the chosen size; a line
 * that says an earlier line again is grey with a small mark. A word is tappable (never hoverable) only where the
 * song has a real meaning for it; otherwise the lines are plain text. Pairs put the translation under the line.
 */
export function LyricLines({ t, lines, script, scale, repeats, pairs, glossOf, selected, onSelect, hideRepeatMarks }: LyricLinesProps) {
  const tr = useVariantT()
  return (
    <View>
      {lines.map((line, li) => {
        const again = repeats[li] ?? null
        const color = again !== null ? t.ink500 : t.ink900
        const font = lineFont(script, scale, again !== null ? "regular" : "bold")
        const words = glossOf ? splitWords(line) : []
        const anyGloss = glossOf ? words.some((_, wi) => glossOf(li, wi)) : false
        return (
          <View key={li} style={[styles.line, pairs ? styles.linePair : null]}>
            {anyGloss ? (
              <View style={styles.wordRow}>
                {words.map((word, wi) => {
                  const key = `${li}-${wi}`
                  const has = Boolean(glossOf?.(li, wi))
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
                      <Text style={[font, { color: on ? "#FFFFFF" : color }, !on && { textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationColor: t.ink300 }]}>{word}</Text>
                    </Pressable>
                  )
                })}
              </View>
            ) : (
              <Text style={[font, { color }]}>{line}</Text>
            )}
            {again !== null && !hideRepeatMarks ? (
              <View style={styles.mark}>
                <PlayerIcon name="repeat" size={16} color={t.ink500} />
                <Text style={[styles.markText, { color: t.ink500 }]}>{again === 0 ? tr("songVariant.lyrics.asLine", { n: 1 }) : tr("songVariant.lyrics.refrain")}</Text>
              </View>
            ) : null}
            {pairs?.[li] ? <Text style={[styles.pair, { color: t.ink500, fontSize: Math.round(15 * Math.max(1, scale)), lineHeight: Math.round(22 * Math.max(1, scale)) }]}>{pairs[li]}</Text> : null}
          </View>
        )
      })}
    </View>
  )
}

/** The tray that opens under a tapped word with its meaning. Tap the word again, or the close button, to put it away. */
export function WordTray({ t, word, meaning, onClose, bottom }: { t: SpTheme; word: string; meaning: string; onClose: () => void; bottom: number }) {
  const tr = useVariantT()
  return (
    <View style={[styles.tray, { bottom, backgroundColor: t.white, borderColor: t.sand400 }]} accessibilityLiveRegion="polite">
      <View style={styles.trayText}>
        <Text style={[styles.trayWord, { color: t.ink900 }]}>{word}</Text>
        <Text style={[styles.trayMeaning, { color: t.ink800 }]}>{meaning || tr("songVariant.word.noMeaning")}</Text>
      </View>
      <SpPress onPress={onClose} accessibilityLabel={tr("songVariant.word.close")} style={styles.trayClose}>
        <SpIcon name="close" size={20} color={t.ink800} strokeWidth={2} />
      </SpPress>
    </View>
  )
}

/** Local state of a tapped word, shared by the variants: `key` is `line-word`. */
export function useWordSelection() {
  const [selected, setSelected] = useState<string | null>(null)
  return { selected, setSelected }
}

const styles = StyleSheet.create({
  line: { paddingVertical: 8 },
  linePair: { paddingVertical: 10 },
  wordRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  word: { marginRight: 6 },
  wordHit: { paddingHorizontal: 6, paddingVertical: 2, marginRight: 2, borderRadius: 10, minHeight: 44, justifyContent: "center" },
  mark: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  markText: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  pair: { fontFamily: amFonts.regular, marginTop: 2 },
  tray: { position: "absolute", left: 12, right: 12, borderRadius: 24, borderWidth: 1, paddingLeft: 20, paddingRight: 8, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8, zIndex: 40 },
  trayText: { flex: 1, gap: 2 },
  trayWord: { fontFamily: amFonts.display, fontSize: 20, lineHeight: 26 },
  trayMeaning: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22 },
  trayClose: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
})
