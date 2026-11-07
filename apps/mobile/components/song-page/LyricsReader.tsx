import { memo, useCallback, useEffect, useRef } from "react"
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import type { LyricBlock, LyricLine } from "@/lib/songPage/lyricStructure"
import { stanzaNumbers, shownStanza, type Span, type TranslationSplit } from "@/lib/songPage/readingStrip"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"
import type { ScriptId } from "@/lib/songPage/scripts"

import { lineFont } from "./lineFont"
import { useReading, useReadingStore } from "./readingState"

const INDENT_STEP = 16

function LineRow({ t, tr, line, block, inRun, script, scale }: { t: SpTheme; tr: PageT; line: LyricLine; block: LyricBlock; inRun: boolean; script: ScriptId; scale: number }) {
  // inside a refrain block the label says it; a lone repeated line gets its own small mark
  const again = line.repeatOf !== null
  const font = lineFont(script, scale, again ? "regular" : "bold")
  return (
    <View style={[styles.line, { marginLeft: line.indent * INDENT_STEP }]}>
      <Text style={[font, { color: again ? t.ink500 : t.ink900 }]}>{line.text}</Text>
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
  index: number
  number: number | null
  script: ScriptId
  scale: number
  /** the stanza has a translation the strip can show: it carries a label, lights up and can be tapped */
  followed: boolean
}

/**
 * One stanza. While the strip follows, the stanza under the reader's eye has an accent bar and an accent label;
 * a tap pins the strip to it (the response starts on pointer down, a soft tint), a second tap lets go.
 */
const Stanza = memo(function Stanza({ t, tr, block, index, number, script, scale, followed }: StanzaProps) {
  const store = useReadingStore()
  const reduce = useReducedMotion()
  const shown = useReading((s) => (followed ? shownStanza(s.mode, s.current, s.spans.length) : -1))
  const pinned = useReading((s) => (followed && s.mode.mode === "tap" ? s.mode.pinned : -1))
  const inView = useReading((s) => s.inView)
  const on = followed && inView && shown === index
  const bar = useSharedValue(0)
  const press = useSharedValue(0)
  useEffect(() => {
    bar.value = reduce ? (on ? 1 : 0) : withSpring(on ? 1 : 0, amSpring.default)
  }, [on, reduce, bar])
  const barStyle = useAnimatedStyle(() => ({ opacity: bar.value }))
  const tintStyle = useAnimatedStyle(() => ({ opacity: press.value }))
  const refrain = block.label === "refrain"
  const label = refrain ? (block.labelText ?? tr("songPage.lyrics.refrain")) : followed && number !== null ? tr("songPage.read.stanza", { n: number }) : null
  const body = (
    <>
      {label ? (
        <View style={styles.labelRow}>
          {refrain && followed ? <PlayerIcon name="repeat" size={14} color={on ? t.accentText : t.ink500} /> : null}
          <Text style={[styles.blockLabel, { color: on ? t.accentText : t.ink500 }]}>{label}</Text>
        </View>
      ) : null}
      {block.lines.map((line, li) => (
        <LineRow key={line.index} t={t} tr={tr} line={line} block={block} inRun={li > 0 && block.lines[li - 1]?.repeatOf !== null} script={script} scale={scale} />
      ))}
    </>
  )
  if (!followed) return <View>{body}</View>
  return (
    <Pressable
      onPressIn={() => {
        press.value = reduce ? 1 : withSpring(1, amSpring.default)
      }}
      onPressOut={() => {
        press.value = reduce ? 0 : withSpring(0, amSpring.default)
      }}
      onPress={() => store?.tap(index)}
      accessibilityRole="button"
      accessibilityLabel={pinned === index ? tr("songPage.read.unpin") : refrain ? tr("songPage.read.pinRefrain") : tr("songPage.read.pin", { n: number ?? index + 1 })}
      accessibilityState={{ selected: pinned === index }}
      style={styles.stanza}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: t.orange100 }, tintStyle]} />
      <Animated.View pointerEvents="none" style={[styles.bar, { backgroundColor: t.action }, barStyle]} />
      {body}
    </Pressable>
  )
})

/**
 * The lyrics of the Lyrics tab: clean and large, stanza by stanza, no translation under the lines. Reports where
 * each stanza is to the reading store, which decides (with the scroll position) which one the strip follows.
 */
export function LyricsReader({ t, blocks, script, scale, split }: { t: SpTheme; blocks: readonly LyricBlock[]; script: ScriptId; scale: number; split: TranslationSplit }) {
  const tr = usePageT()
  const store = useReadingStore()
  const spans = useRef<Span[]>([])
  const followed = split.kind === "stanzas" && split.items.length === blocks.length
  const numbers = stanzaNumbers(blocks)

  const onSpan = useCallback(
    (index: number, span: Span) => {
      const list = spans.current
      const before = list[index]
      if (before && before.top === span.top && before.height === span.height) return
      list[index] = span
      // report only once every stanza has been laid out
      if (list.length >= blocks.length && list.slice(0, blocks.length).every(Boolean)) store?.setSpans(list.slice(0, blocks.length))
    },
    [blocks.length, store],
  )
  // a different song or script: forget the old places
  useEffect(() => {
    spans.current = []
    return () => store?.setSpans([])
  }, [blocks, store])

  return (
    <View>
      {blocks.map((block, bi) => (
        <View
          key={bi}
          style={bi > 0 ? styles.blockGap : null}
          onLayout={(event: LayoutChangeEvent) => onSpan(bi, { top: event.nativeEvent.layout.y, height: event.nativeEvent.layout.height })}
        >
          <Stanza t={t} tr={tr} block={block} index={bi} number={numbers[bi] ?? null} script={script} scale={scale} followed={followed} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  blockGap: { marginTop: 16 },
  stanza: { paddingLeft: 16, paddingVertical: 8, borderRadius: 8 },
  tint: { borderRadius: 8 },
  bar: { position: "absolute", left: 0, top: 10, bottom: 10, width: 4, borderRadius: 2 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 4, paddingBottom: 2 },
  blockLabel: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase" },
  line: { paddingVertical: 6 },
  mark: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  markText: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
})
