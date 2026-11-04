import { memo, useEffect, useReducer, useRef, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { BlurView } from "expo-blur"
import { LinearGradient } from "expo-linear-gradient"
import { useReducedMotion } from "react-native-reanimated"

import { karaokeColors, playerColors, playerSize } from "@/components/player-v2/playerTokens"
import { amFonts } from "@/constants/tokens/amTypography"
import { autoScrollReduce, lineState, wordState, type LineState, type LyricLine } from "@/lib/playerV2/lyricsSync"

type Props = {
  lines: LyricLine[]
  devanagari: boolean
  activeLine: number
  activeWord: number
  showGloss: boolean
  showTranslation: boolean
  onSeekToLine: (index: number) => void
  /** Shown instead of lyrics when there are none. */
  emptyText: string
}

/** The prototype puts the sung line at 24% of the panel height (`_syncLyr`). */
const SUNG_LINE_SHARE = 0.24
/** .kscroll mask: transparent to opaque over the first 8% and the last 12%. */
const FADE_TOP = 0.08
const FADE_BOTTOM = 0.12
/** The panel's own colour (forest at 78% over the dark end of the photograph), so the edges melt into it. */
const PANEL_FADE_COLOR = "rgba(34, 42, 28, 1)"

/**
 * Karaoke panel (prototype .lpanel.kar). Every word sits over its short English
 * gloss and wraps like text; the translation of a line follows it. Words of the
 * sung line are white, the word being sung is gold, finished lines dim and coming
 * lines are faint. It follows the song by itself; touching it pauses that until
 * the line changes. Tapping a word seeks to the start of its line.
 */
export function LyricsPanel({
  lines,
  devanagari,
  activeLine,
  activeWord,
  showGloss,
  showTranslation,
  onSeekToLine,
  emptyText,
}: Props) {
  const reduce = useReducedMotion()
  const scroll = useRef<ScrollView>(null)
  const tops = useRef<number[]>([])
  const [viewport, setViewport] = useState(0)
  const [auto, dispatch] = useReducer(autoScrollReduce, { paused: false, lineAtPause: -1 })
  const firstScroll = useRef(true)

  useEffect(() => {
    dispatch({ type: "line", line: activeLine })
  }, [activeLine])

  useEffect(() => {
    if (auto.paused || activeLine < 0 || viewport <= 0) return
    const top = tops.current[activeLine]
    if (top == null) return
    const y = Math.max(0, top - viewport * SUNG_LINE_SHARE)
    scroll.current?.scrollTo({ y, animated: !reduce && !firstScroll.current })
    firstScroll.current = false
  }, [activeLine, auto.paused, reduce, viewport, lines])

  return (
    <View style={styles.panel}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      {lines.length ? (
        <View
          style={styles.scrollWrap}
          onLayout={(e) => {
            setViewport(e.nativeEvent.layout.height)
          }}
        >
          <ScrollView
            ref={scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            onScrollBeginDrag={() => dispatch({ type: "touch", line: activeLine })}
            onTouchStart={() => dispatch({ type: "touch", line: activeLine })}
          >
            {lines.map((line, index) => (
              <LyricRow
                key={`${index}-${line.text}`}
                line={line}
                state={lineState(index, activeLine)}
                activeWord={index === activeLine ? activeWord : -1}
                devanagari={devanagari}
                showGloss={showGloss}
                showTranslation={showTranslation}
                onLayoutTop={(y) => {
                  tops.current[index] = y
                }}
                onPress={() => onSeekToLine(index)}
              />
            ))}
          </ScrollView>
          <LinearGradient
            pointerEvents="none"
            colors={[PANEL_FADE_COLOR, playerColors.maskClear]}
            style={[styles.fade, { top: 0, height: viewport * FADE_TOP }]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[playerColors.maskClear, PANEL_FADE_COLOR]}
            style={[styles.fade, { bottom: 0, height: viewport * FADE_BOTTOM }]}
          />
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      )}
    </View>
  )
}

type RowProps = {
  line: LyricLine
  state: LineState
  activeWord: number
  devanagari: boolean
  showGloss: boolean
  showTranslation: boolean
  onLayoutTop: (y: number) => void
  onPress: () => void
}

const LyricRow = memo(function LyricRow({
  line,
  state,
  activeWord,
  devanagari,
  showGloss,
  showTranslation,
  onLayoutTop,
  onPress,
}: RowProps) {
  const translation = showTranslation ? line.translation : undefined
  const wordFont = devanagari ? amFonts.devanagariBold : amFonts.bold
  return (
    <View onLayout={(e) => onLayoutTop(e.nativeEvent.layout.y)}>
      <View style={styles.words}>
        {line.words.map((word, w) => {
          const color = wordColor(state, wordState(w, activeWord, state === "current"))
          return (
            <Pressable
              key={`${w}-${word.text}`}
              accessibilityRole="button"
              accessibilityLabel={`${word.text}${word.gloss && showGloss ? `, ${word.gloss}` : ""}. Go to this line`}
              onPress={onPress}
              style={styles.word}
            >
              <Text style={[styles.kt, { fontFamily: wordFont, color }]}>{word.text}</Text>
              {showGloss && word.gloss ? <Text style={[styles.kg, { color }]}>{word.gloss}</Text> : null}
            </Pressable>
          )
        })}
      </View>
      {translation ? (
        <Text style={[styles.translation, { color: translationColor(state) }]}>{translation}</Text>
      ) : (
        <View style={styles.noTranslation} />
      )}
    </View>
  )
})

function wordColor(line: LineState, word: "sung" | "current" | "coming"): string {
  if (line === "done") return karaokeColors.word.past
  if (line === "coming") return karaokeColors.word.coming
  if (word === "current") return karaokeColors.word.now
  return word === "sung" ? karaokeColors.word.sung : karaokeColors.word.onLine
}

function translationColor(line: LineState): string {
  if (line === "done") return karaokeColors.translation.past
  return line === "current" ? karaokeColors.translation.onLine : karaokeColors.translation.coming
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    marginTop: playerSize.panelMarginTop,
    marginHorizontal: 10,
    borderRadius: playerSize.panelRadius,
    borderWidth: 1,
    borderColor: playerColors.panelEdge,
    overflow: "hidden",
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  tint: { backgroundColor: playerColors.panelFill },
  scrollWrap: { flex: 1, minHeight: 0 },
  fade: { position: "absolute", left: 0, right: 0 },
  content: { paddingTop: 8, paddingBottom: 40 },
  words: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
  word: { alignItems: "flex-start", marginRight: 10, marginBottom: 2 },
  kt: { fontSize: 23, lineHeight: 30, letterSpacing: -0.23 },
  kg: { fontFamily: amFonts.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.22, opacity: 0.9 },
  translation: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingBottom: 12 },
  noTranslation: { height: 8 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 23, color: playerColors.textSoft, textAlign: "center" },
})
