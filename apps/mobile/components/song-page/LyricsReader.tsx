import { memo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import type { LyricBlock, LyricLine } from "@/lib/songPage/lyricStructure"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"
import type { ScriptId } from "@/lib/songPage/scripts"

import { lineFont } from "./lineFont"

const INDENT_STEP = 16

function LineRow({ t, tr, line, block, inRun, script, scale, under }: { t: SpTheme; tr: PageT; line: LyricLine; block: LyricBlock; inRun: boolean; script: ScriptId; scale: number; under: string | null }) {
  // inside a refrain block the label says it; a lone repeated line gets its own small mark
  const again = line.repeatOf !== null
  const font = lineFont(script, scale, again ? "regular" : "bold")
  return (
    <View style={[styles.line, { marginLeft: line.indent * INDENT_STEP }]}>
      <Text style={[font, { color: again ? t.ink500 : t.ink900 }]}>{line.text}</Text>
      {under ? <Text style={[styles.under, { color: t.ink800, fontSize: Math.round(16 * scale), lineHeight: Math.round(16 * scale * 1.4) }]}>{under}</Text> : null}
      {again && !block.label && !inRun ? (
        <View style={styles.mark}>
          <PlayerIcon name="repeat" size={16} color={t.ink500} />
          <Text style={[styles.markText, { color: t.ink500 }]}>{tr("songPage.lyrics.again")}</Text>
        </View>
      ) : null}
    </View>
  )
}

type StanzaProps = {
  t: SpTheme
  tr: PageT
  block: LyricBlock
  script: ScriptId
  scale: number
  /** the translation text under each lyric line, by line index (null: none chosen) */
  under: Readonly<Record<number, string>> | null
}

/** One stanza: a refrain says so, the lines follow, and a chosen translation sits under its line. */
const Stanza = memo(function Stanza({ t, tr, block, script, scale, under }: StanzaProps) {
  const refrain = block.label === "refrain"
  const label = refrain ? (block.labelText ?? tr("songPage.lyrics.refrain")) : null
  return (
    <View>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.blockLabel, { color: t.ink500 }]}>{label}</Text>
        </View>
      ) : null}
      {block.lines.map((line, li) => (
        <LineRow
          key={line.index}
          t={t}
          tr={tr}
          line={line}
          block={block}
          inRun={li > 0 && block.lines[li - 1]?.repeatOf !== null}
          script={script}
          scale={scale}
          under={under?.[line.index] ?? null}
        />
      ))}
    </View>
  )
})

/** The lyrics: clean and large, stanza by stanza. A translation is drawn under the lines only when the reader chose one. */
export function LyricsReader({ t, blocks, script, scale, under }: { t: SpTheme; blocks: readonly LyricBlock[]; script: ScriptId; scale: number; under: Readonly<Record<number, string>> | null }) {
  const tr = usePageT()
  return (
    <View>
      {blocks.map((block, bi) => (
        <View key={bi} style={bi > 0 ? styles.blockGap : null}>
          <Stanza t={t} tr={tr} block={block} script={script} scale={scale} under={under} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  blockGap: { marginTop: 16 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 4, paddingBottom: 2 },
  blockLabel: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase" },
  line: { paddingVertical: 6 },
  under: { fontFamily: amFonts.regular, marginTop: 2 },
  mark: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  markText: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
})
