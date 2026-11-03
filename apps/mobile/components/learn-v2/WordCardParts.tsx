import { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { PressBox } from "@/components/learn-v2/PressBox"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import { amGap, amRadius } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import type { Grade, QueueCounts, QueueKind } from "@/lib/learn/srs"
import type { LearnWord } from "@/lib/learn/words"

const SOFT_WHITE = "rgba(255, 255, 255, 0.78)"

/** `New 6 / Learning 2 / Due 2`; the counter of the card on screen is underlined. */
export function QueueCounters({
  theme,
  counts,
  active,
}: {
  theme: AmTheme
  counts: QueueCounts
  active: QueueKind | null
}) {
  const cells: ReadonlyArray<{ kind: QueueKind; label: string; value: number }> = [
    { kind: "new", label: "New", value: counts.newCount },
    { kind: "learning", label: "Learning", value: counts.learningCount },
    { kind: "due", label: "Due", value: counts.dueCount },
  ]
  return (
    <View style={styles.counters} accessibilityRole="summary">
      {cells.map((cell) => (
        <View
          key={cell.kind}
          accessibilityLabel={`${cell.label} ${cell.value}`}
          style={[styles.counter, active === cell.kind && { borderBottomColor: theme.brand }]}
        >
          <Text style={[styles.counterValue, { color: theme.textHeading }]}>{cell.value}</Text>
          <Text style={[styles.counterLabel, { color: theme.textBody }]}>{cell.label}</Text>
        </View>
      ))}
    </View>
  )
}

/**
 * The card: green face (sage-700), white word, Devanagari in soft white, meaning in
 * gold. Show answer turns it over with a spring that starts from where it is.
 * With reduced motion the faces cross-fade.
 */
export function FlipCard({ word, flipped }: { word: LearnWord; flipped: boolean }) {
  const reduce = useReducedMotion()
  const turn = useSharedValue(flipped ? 1 : 0)
  const enter = useSharedValue(0)

  useEffect(() => {
    turn.value = reduce ? withTiming(flipped ? 1 : 0, { duration: 150 }) : withSpring(flipped ? 1 : 0, amSpring.default)
  }, [flipped, reduce, turn])

  useEffect(() => {
    turn.value = 0
    enter.value = 0
    enter.value = reduce ? withTiming(1, { duration: 150 }) : withSpring(1, amSpring.default)
  }, [word.id, reduce, turn, enter])

  const frame = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: reduce ? 0 : (1 - enter.value) * 16 }],
  }))
  const front = useAnimatedStyle(() => ({
    opacity: reduce ? 1 - turn.value : turn.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: reduce ? "0deg" : `${turn.value * 180}deg` }],
  }))
  const back = useAnimatedStyle(() => ({
    opacity: reduce ? turn.value : turn.value >= 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: reduce ? "0deg" : `${turn.value * 180 + 180}deg` }],
  }))

  return (
    <Animated.View style={[styles.cardFrame, frame]}>
      <Animated.View style={[styles.face, front]} pointerEvents="none">
        <Text style={[amType.label, { color: amColors.gold300 }]}>From PS {word.songNumber}</Text>
        <Text style={[styles.word, { fontSize: 45, lineHeight: 46 }]} accessibilityRole="header">
          {word.roman}
        </Text>
        <Text style={[styles.devanagari, { color: SOFT_WHITE }]}>{word.devanagari}</Text>
      </Animated.View>
      <Animated.View style={[styles.face, back]} pointerEvents="none">
        <Text style={[amType.label, { color: amColors.gold300 }]}>
          {word.roman} · {word.devanagari}
        </Text>
        <Text style={styles.meaning}>{word.meaning}</Text>
        <Text style={[amType.body, { color: SOFT_WHITE, fontStyle: "italic" }]}>{word.example}</Text>
      </Animated.View>
    </Animated.View>
  )
}

const GRADE_COPY: Record<Grade, string> = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" }

/** Four grade buttons, each with the next interval under its name. 56px high. */
export function GradeButtons({
  theme,
  intervals,
  onGrade,
}: {
  theme: AmTheme
  intervals: Record<Grade, string>
  onGrade: (grade: Grade) => void
}) {
  const order: Grade[] = ["again", "hard", "good", "easy"]
  return (
    <View style={styles.grades}>
      {order.map((grade) => {
        const palette = gradePalette(theme, grade)
        return (
          <PressBox
            key={grade}
            accessibilityRole="button"
            accessibilityLabel={`${GRADE_COPY[grade]}, next in ${intervals[grade].replace("<", "less than ")}`}
            onPress={() => onGrade(grade)}
            pressedScale={0.95}
            outerStyle={styles.gradeOuter}
            style={[styles.grade, { backgroundColor: palette.bg, borderColor: palette.border }]}
          >
            <Text style={[styles.gradeName, { color: palette.text }]}>{GRADE_COPY[grade]}</Text>
            <Text style={[styles.gradeInterval, { color: palette.text }]}>{intervals[grade]}</Text>
          </PressBox>
        )
      })}
    </View>
  )
}

function gradePalette(theme: AmTheme, grade: Grade) {
  switch (grade) {
    case "again":
      return { bg: theme.card, border: amColors.danger, text: amColors.danger }
    case "hard":
      return { bg: theme.card, border: theme.line, text: theme.textHeading }
    case "good":
      return { bg: theme.brand, border: theme.brand, text: theme.onBrand }
    case "easy":
    default:
      return { bg: amColors.sage700, border: amColors.sage700, text: amColors.white }
  }
}

const styles = StyleSheet.create({
  counters: { flexDirection: "row", gap: amGap.block, alignItems: "flex-end" },
  counter: {
    minHeight: 44,
    paddingHorizontal: 4,
    justifyContent: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  counterValue: { fontFamily: amFonts.display, fontSize: 20, lineHeight: 24 },
  counterLabel: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  cardFrame: { minHeight: 280 },
  face: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: amColors.sage700,
    borderRadius: amRadius.panel,
    padding: amGap.padPanel,
    justifyContent: "center",
    gap: amGap.grid,
    backfaceVisibility: "hidden",
  },
  word: {
    fontFamily: amFonts.display,
    color: amColors.white,
    textTransform: "uppercase",
    letterSpacing: -0.9,
  },
  devanagari: { fontFamily: amFonts.devanagari, fontSize: 20, lineHeight: 30 },
  meaning: {
    fontFamily: amFonts.display,
    fontSize: 30,
    lineHeight: 32,
    color: amColors.gold300,
    textTransform: "uppercase",
    letterSpacing: -0.6,
  },
  grades: { flexDirection: "row", gap: 8 },
  gradeOuter: { flex: 1 },
  grade: {
    minHeight: 56,
    borderRadius: amRadius.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  gradeName: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 18 },
  gradeInterval: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 16 },
})
