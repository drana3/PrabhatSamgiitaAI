import { useMemo, useRef, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { EmptyCard } from "@/components/learn-v2/LearnBlocks"
import { LearnGate } from "@/components/learn-v2/LearnGate"
import { PressBox } from "@/components/learn-v2/PressBox"
import { OverlayScreen, Over, Pill, Track, toneOf, useToast } from "@/components/learn-v2/ui"
import { Reveal } from "@/components/today/motion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useT } from "@/lib/i18n"
import { SAMPLE_QUIZ, SAMPLE_QUIZ_PASS_MARK } from "@/lib/fixtures/learn"
import {
  QUIZ_LEVELS,
  buildWordQuiz,
  levelStatuses,
  scoreQuiz,
  type LearnQuizLevel,
  type LearnQuizQuestion,
} from "@/lib/learn/quiz"
import { quizFeedback } from "@/lib/learn/quizFeedback"
import { learnWordList, learnWordsAvailable } from "@/lib/learn/verified"
import { LEARN_ROUTES, parseNumberParam } from "@/lib/learn/routes"
import { wordsForSong } from "@/lib/learn/words"
import { useLearnStore } from "@/stores/learnStore"
import { href } from "@/utils/href"

/**
 * Quiz (prototype QUIZ, SCR-15). Level 1 is the three-question sample from the prototype
 * (pass mark 2); the real quiz has 10 questions and a pass mark of 7. ?level=1..3 picks the
 * level, ?song=3 asks about the words of that song. Level 2 and 3 have no question bank
 * yet (API-12) and say so.
 */
export default function LearnQuizScreen() {
  return learnWordsAvailable() ? <LearnQuiz /> : <LearnGate kind="quiz" />
}

function LearnQuiz() {
  const router = useRouter()
  const theme = useAmTheme()
  const t = useT()
  const params = useLocalSearchParams<{ level?: string; song?: string }>()
  const requested = parseNumberParam(params.level) ?? 1
  const level = (requested >= 1 && requested <= 3 ? requested : 1) as LearnQuizLevel
  const songNumber = parseNumberParam(params.song)
  const toast = useToast()

  const quizBest = useLearnStore((s) => s.quizBest)
  const recordQuiz = useLearnStore((s) => s.recordQuiz)
  const markPart = useLearnStore((s) => s.markPart)

  const status = levelStatuses(quizBest).find((entry) => entry.level === level)!
  const levelTitle = QUIZ_LEVELS.find((entry) => entry.level === level)?.title ?? ""

  const [attempt, setAttempt] = useState(1)
  const questions = useMemo<LearnQuizQuestion[]>(() => {
    if (level !== 1) return []
    if (songNumber !== undefined) {
      const own = buildWordQuiz(wordsForSong(learnWordList(), songNumber), { count: 3, seed: attempt * 7919 + songNumber })
      if (own.length > 0) return own
    }
    return SAMPLE_QUIZ
  }, [level, songNumber, attempt])

  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [finished, setFinished] = useState(false)
  const recorded = useRef(false)

  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href(LEARN_ROUTES.learn))
  }

  const restart = () => {
    setAttempt((value) => value + 1)
    setIndex(0)
    setPicked(null)
    setAnswers({})
    setFinished(false)
    recorded.current = false
  }

  const question = questions[index]
  const result = useMemo(() => scoreQuiz(questions, answers, SAMPLE_QUIZ_PASS_MARK), [questions, answers])
  const isLast = index >= questions.length - 1

  const onPick = (optionId: string) => {
    if (!question || picked !== null) return
    setPicked(optionId)
    setAnswers((current) => ({ ...current, [question.id]: optionId }))
  }

  const onNext = () => {
    if (picked === null) {
      toast.show(t("learn.quiz.chooseFirst"))
      return
    }
    if (!isLast) {
      setIndex((value) => value + 1)
      setPicked(null)
      return
    }
    if (!recorded.current) {
      recorded.current = true
      recordQuiz(level, { score: result.score, total: result.total, passed: result.passed })
      if (result.passed && songNumber !== undefined) markPart(`ps-${songNumber}`, "meaning")
    }
    setFinished(true)
  }

  const label =
    songNumber !== undefined
      ? t("learn.quiz.screenSong", { level, title: levelTitle, number: songNumber })
      : t("learn.quiz.screen", { level, title: levelTitle })

  return (
    <OverlayScreen theme={theme} onBack={back} label={label} overlay={toast.node}>
      {!status.open ? (
        <EmptyCard theme={theme} eyebrow={t("learn.quiz.locked")} title={t("learn.quiz.locked")} text={status.unlockRule} action={t("learn.quiz.backToLearn")} onAction={back} />
      ) : level !== 1 ? (
        <EmptyCard
          theme={theme}
          eyebrow={t("learn.quiz.levelEyebrow", { level })}
          title={t("learn.quiz.soonTitle")}
          text={t("learn.quiz.soonText")}
          action={t("learn.quiz.backToLearn")}
          onAction={back}
        />
      ) : finished ? (
        <Reveal index={0} style={styles.stack}>
          <View style={styles.result}>
            <Over color={amColors.gold300}>{t("learn.quiz.result")}</Over>
            <Text style={styles.resultNumber}>{t("learn.quiz.score", { score: result.score, total: result.total })}</Text>
            <Text style={styles.resultText}>
              {result.passed
                ? t("learn.quiz.passed")
                : t("learn.quiz.notYet")}
            </Text>
          </View>
          <View style={styles.buttons}>
            <Pill theme={theme} label={t("learn.quiz.tryAgain")} onPress={restart} />
            <Pill theme={theme} variant="sand" label={t("learn.quiz.backToLearn")} onPress={back} />
          </View>
        </Reveal>
      ) : question ? (
        <Reveal index={0} style={styles.stack}>
          <Track theme={theme} value={(index + (picked !== null ? 1 : 0)) / questions.length} />
          <Over color={theme.eyebrow} numeric>{t("learn.quiz.progress", { n: index + 1, total: questions.length })}</Over>
          <Text accessibilityRole="header" style={[styles.question, { color: theme.textHeading }]}>
            {question.prompt}
          </Text>
          <View style={styles.options}>
            {question.options.map((option) => (
              <Option
                key={option.id}
                theme={theme}
                label={option.text}
                state={
                  picked === null
                    ? "idle"
                    : option.id === question.correctOptionId
                      ? "ok"
                      : option.id === picked
                        ? "bad"
                        : "idle"
                }
                onPress={() => onPick(option.id)}
              />
            ))}
          </View>
          <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: theme.textBody }]}>
            {picked !== null ? quizFeedback(question, picked) : ""}
          </Text>
          <Pill theme={theme} style={styles.next} label={isLast ? t("learn.quiz.seeResult") : t("learn.quiz.next")} onPress={onNext} />
        </Reveal>
      ) : null}
    </OverlayScreen>
  )
}

/** `.card.cardbtn.qopt`: white row; right answer turns forest green, a wrong pick gets a 2px red border. */
function Option({
  theme,
  label,
  state,
  onPress,
}: {
  theme: AmTheme
  label: string
  state: "idle" | "ok" | "bad"
  onPress: () => void
}) {
  const tone = toneOf(theme)
  const ok = state === "ok"
  const bad = state === "bad"
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: ok || bad }}
      onPress={onPress}
      pressedScale={0.98}
      style={[
        styles.option,
        {
          backgroundColor: ok ? amColors.sage700 : theme.card,
          borderColor: ok ? "transparent" : bad ? amColors.danger : theme.line,
          borderWidth: bad ? 2 : 1,
        },
      ]}
    >
      <Text style={[styles.optionText, { color: ok ? amColors.white : theme.textHeading }]}>{label}</Text>
    </PressBox>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 20 },
  question: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 30, letterSpacing: -0.6, textTransform: "uppercase" },
  options: { gap: 10 },
  option: { minHeight: 76, justifyContent: "center", paddingVertical: 12, paddingLeft: 20, paddingRight: 16, borderRadius: 20, width: "100%" },
  optionText: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 22, letterSpacing: -0.19 },
  feedback: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20, minHeight: 20 },
  next: { alignSelf: "flex-start" },
  result: { backgroundColor: amColors.sage900, borderRadius: 30, padding: 24, gap: 10, overflow: "hidden" },
  resultNumber: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase", color: amColors.white, fontVariant: ["tabular-nums"] },
  resultText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 21.6, maxWidth: 252, color: "rgba(255,255,255,0.82)" },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
})
