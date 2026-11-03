import { StyleSheet, Text, View } from "react-native"

import { GreenPanel } from "@/components/learn-v2/GreenPanel"
import { PressBox } from "@/components/learn-v2/PressBox"
import { PillButton } from "@/components/learn-v2/ui"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import type { LearnQuizQuestion, QuizResultView } from "@/lib/learn/quiz"

type ThemeProps = { theme: AmTheme }

/**
 * Four white answer cards. After a pick the right one turns forest green with
 * white text, a wrong pick gets a red outline (SCR-15).
 */
export function AnswerCards({
  theme,
  question,
  picked,
  onPick,
}: ThemeProps & { question: LearnQuizQuestion; picked: string | null; onPick: (optionId: string) => void }) {
  const answered = picked !== null
  return (
    <View style={styles.answers}>
      {question.options.map((option) => {
        const isRight = option.id === question.correctOptionId
        const isPicked = option.id === picked
        const showRight = answered && isRight
        const showWrong = answered && isPicked && !isRight
        return (
          <PressBox
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={option.text}
            accessibilityState={{ disabled: answered, selected: isPicked }}
            disabled={answered}
            onPress={() => onPick(option.id)}
            pressedScale={0.98}
            style={[
              styles.answer,
              {
                backgroundColor: showRight ? amColors.sage700 : theme.card,
                borderColor: showWrong ? amColors.danger : showRight ? amColors.sage700 : theme.line,
                borderWidth: showWrong ? 2 : 1,
              },
            ]}
          >
            <Text style={[styles.answerText, { color: showRight ? amColors.white : theme.textHeading }]}>
              {option.text}
            </Text>
          </PressBox>
        )
      })}
    </View>
  )
}

/** Result card: score, pass or retry message, Try again, Back to Learn. */
export function ResultCard({
  theme,
  view,
  passed,
  onAgain,
  onBack,
  extra,
}: ThemeProps & {
  view: QuizResultView
  passed: boolean
  onAgain: () => void
  onBack: () => void
  extra?: string
}) {
  return (
    <GreenPanel>
      <Text style={[amType.label, { color: amColors.gold300 }]}>{passed ? "Passed" : "Your result"}</Text>
      <Text style={[amType.display, { color: amColors.white }]}>{view.headline}</Text>
      <Text style={[amType.lead, { color: amColors.white }]}>{view.message}</Text>
      {extra ? <Text style={[amType.body, { color: "rgba(255,255,255,0.86)" }]}>{extra}</Text> : null}
      <View style={styles.buttons}>
        <PillButton theme={theme} label="Try again" onPress={onAgain} />
        <PillButton theme={theme} label="Back to Learn" onPress={onBack} variant="light" />
      </View>
    </GreenPanel>
  )
}

const styles = StyleSheet.create({
  answers: { gap: amGap.grid },
  answer: {
    minHeight: 56,
    borderRadius: amRadius.card,
    paddingHorizontal: amGap.padCard,
    paddingVertical: 14,
    justifyContent: "center",
  },
  answerText: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 23 },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: amGap.grid, marginTop: 6 },
})
