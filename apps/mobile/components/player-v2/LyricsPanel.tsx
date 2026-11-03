import { memo, useEffect, useReducer, useRef } from "react"
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native"
import { BlurView } from "expo-blur"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"

import { amRadius, amSpace } from "@/constants/tokens/amSpacing"
import { amFontSize, amFonts, amType } from "@/constants/tokens/amTypography"
import { lyricOpacity, playerColors, playerSize } from "@/components/player-v2/playerTokens"
import {
  autoScrollReduce,
  lineState,
  scrollOffsetForLine,
  wordState,
  type LineState,
  type LyricLine,
} from "@/lib/playerV2/lyricsSync"

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
  /** Notes under the lyrics, such as "Word meanings are not available yet". */
  note?: string | null
}

const FADE_MS = 200

/**
 * Karaoke panel (spec SCR-12 item 3): the sung line is bright, the sung word
 * is gold, finished lines dim, coming lines are faint. It follows the song by
 * itself; touching it pauses that until the line changes.
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
  note,
}: Props) {
  const reduce = useReducedMotion()
  const scroll = useRef<ScrollView>(null)
  const tops = useRef<number[]>([])
  const panelHeight = useRef(0)
  const [auto, dispatch] = useReducer(autoScrollReduce, { paused: false, lineAtPause: -1 })

  useEffect(() => {
    dispatch({ type: "line", line: activeLine })
  }, [activeLine])

  useEffect(() => {
    if (auto.paused || activeLine < 0) return
    const top = tops.current[activeLine]
    if (top == null) return
    scroll.current?.scrollTo({
      y: scrollOffsetForLine(top, panelHeight.current),
      animated: !reduce,
    })
  }, [activeLine, auto.paused, reduce])

  return (
    <View
      style={styles.panel}
      onLayout={(e) => {
        panelHeight.current = e.nativeEvent.layout.height
      }}
    >
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      {lines.length ? (
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
              reduce={reduce}
              onLayoutTop={(y) => {
                tops.current[index] = y
              }}
              onPress={() => onSeekToLine(index)}
            />
          ))}
          {note ? <Text style={styles.note}>{note}</Text> : null}
        </ScrollView>
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
  reduce: boolean
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
  reduce,
  onLayoutTop,
  onPress,
}: RowProps) {
  const opacity = useSharedValue<number>(lyricOpacity[state])
  useEffect(() => {
    opacity.value = withTiming(lyricOpacity[state], { duration: reduce ? 0 : FADE_MS })
  }, [state, reduce, opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

  const hasGloss = showGloss && line.words.some((w) => w.gloss)
  const scriptFont = devanagari ? null : { fontFamily: amFonts.bold }

  return (
    <Animated.View style={style} onLayout={(e) => onLayoutTop(e.nativeEvent.layout.y)}>
      <Pressable
        onPressIn={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${line.text}. Go to this line`}
        style={styles.row}
      >
        {hasGloss ? (
          <View style={styles.wordWrap}>
            {line.words.map((word, w) => (
              <View key={`${w}-${word.text}`} style={styles.wordCol}>
                <Text style={[styles.word, scriptFont, { color: wordColor(wordState(w, activeWord, state === "current")) }]}>
                  {word.text}
                </Text>
                <Text style={styles.gloss} numberOfLines={1}>
                  {word.gloss ?? ""}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.word, scriptFont, styles.inline]}>
            {line.words.map((word, w) => (
              <Text key={`${w}-${word.text}`} style={{ color: wordColor(wordState(w, activeWord, state === "current")) }}>
                {word.text}
                {w < line.words.length - 1 ? " " : ""}
              </Text>
            ))}
          </Text>
        )}
        {showTranslation && line.translation ? (
          <Text style={styles.translation}>{line.translation}</Text>
        ) : null}
      </Pressable>
    </Animated.View>
  )
})

function wordColor(state: "sung" | "current" | "coming"): string {
  if (state === "current") return playerColors.gold
  return state === "sung" ? playerColors.text : playerColors.textSoft
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    borderRadius: amRadius.panel,
    borderWidth: 1,
    borderColor: playerColors.glassEdge,
    overflow: "hidden",
  },
  tint: { backgroundColor: playerColors.glass },
  content: { padding: amSpace.s4, paddingBottom: amSpace.s16, gap: amSpace.s2 },
  row: { paddingVertical: amSpace.s2, minHeight: 44, gap: amSpace.s1 },
  inline: { flexShrink: 1 },
  word: {
    fontFamily: amFonts.regular,
    fontSize: amFontSize.heading,
    lineHeight: Math.round(amFontSize.heading * 1.25),
    color: playerColors.text,
  },
  wordWrap: { flexDirection: "row", flexWrap: "wrap", columnGap: amSpace.s2 },
  wordCol: { alignItems: "flex-start" },
  gloss: {
    fontFamily: amFonts.regular,
    fontSize: playerSize.gloss,
    lineHeight: 14,
    color: playerColors.textFaint,
  },
  translation: { ...amType.body, fontSize: amFontSize.label, lineHeight: 18, color: playerColors.textSoft },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: amSpace.s6 },
  emptyText: { ...amType.body, color: playerColors.textSoft, textAlign: "center" },
  note: { ...amType.body, fontSize: amFontSize.label, color: playerColors.textFaint, paddingTop: amSpace.s4 },
})
