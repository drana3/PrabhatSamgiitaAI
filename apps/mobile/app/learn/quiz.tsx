import { useMemo, useRef, useState } from "react"
import { ScrollView, StyleSheet, Text } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { EmptyBlock } from "@/components/learn-v2/LearnBlocks"
import { AnswerCards, ResultCard } from "@/components/learn-v2/QuizParts"
import { PillButton, ProgressBar, SubHeader } from "@/components/learn-v2/ui"
import { Reveal } from "@/components/today/motion"
import { amGap } from "@/constants/tokens/amSpacing"
import { amType } from "@/constants/tokens/amTypography"
import { SAMPLE_LEARN_WORDS } from "@/data/learnWords"
import { useAmTheme } from "@/hooks/useAmTheme"
import {
  QUIZ_LEVELS,
  answerFeedback,
  buildWordQuiz,
  levelStatuses,
  resultMessage,
  scoreQuiz,
  type LearnQuizLevel,
} from "@/lib/learn/quiz"
import { LEARN_ROUTES, parseNumberParam } from "@/lib/learn/routes"
import { pickDeck, songNumbersFromIds, wordsForSong } from "@/lib/learn/words"
import { useLearnStore } from "@/stores/learnStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

/**
 * Quiz (spec SCR-15): progress bar, "Question 2 of 10", the question, four answer
 * cards, one line of feedback, Next question or See result, then the result card.
 * Pass mark 7 of 10. ?level=1..3 picks the level, ?song=3 limits level 1 to the
 * words of one song, and a pass then marks the meaning part of that song's path.
 * Level 2 and 3 have no question bank yet (API-12) and say so.
 */
export default function LearnQuizScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const params = useLocalSearchParams<{ level?: string; song?: string }>()
  const requested = parseNumberParam(params.level) ?? 1
  const level = (requested >= 1 && requested <= 3 ? requested : 1) as LearnQuizLevel
  const songNumber = parseNumberParam(params.song)

  const quizBest = useLearnStore((s) => s.quizBest)
  const songs = useLearnStore((s) => s.songs)
  const recordQuiz = useLearnStore((s) => s.recordQuiz)
  const markPart = useLearnStore((s) => s.markPart)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)

  const status = levelStatuses(quizBest).find((entry) => entry.level === level)!
  const levelTitle = QUIZ_LEVELS.find((entry) => entry.level === level)?.title ?? ""

  const [attempt, setAttempt] = useState(1)
  const questions = useMemo(() => {
    if (level !== 1) return []
    const words =
      songNumber !== undefined
        ? wordsForSong(SAMPLE_LEARN_WORDS, songNumber)
        : pickDeck(SAMPLE_LEARN_WORDS, [...songs.map((s) => s.number), ...songNumbersFromIds(savedSongIds)])
    // a song with too few words borrows from the whole starter deck so the quiz can run
    const pool = songNumber !== undefined && words.length < 4 ? SAMPLE_LEARN_WORDS : words
    return buildWordQuiz(pool, { seed: attempt * 7919 + (songNumber ?? 0) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const result = useMemo(() => scoreQuiz(questions, answers), [questions, answers])
  const isLast = index >= questions.length - 1

  const onPick = (optionId: string) => {
    if (!question || picked !== null) return
    setPicked(optionId)
    setAnswers((current) => ({ ...current, [question.id]: optionId }))
  }

  const onNext = () => {
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

  const header = (
    <SubHeader
      theme={theme}
      title={`Level ${level} · ${levelTitle}${songNumber !== undefined ? ` · PS ${songNumber}` : ""}`}
      onBack={back}
    />
  )

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: amGap.gutter }]}
      >
        {header}

        {!status.open ? (
          <EmptyBlock theme={theme} title="Locked" text={status.unlockRule} actionLabel="Back to Learn" onAction={back} />
        ) : level !== 1 ? (
          <EmptyBlock
            theme={theme}
            title="Questions are on the way"
            text="This level needs its question bank, which arrives with the next content update."
            actionLabel="Back to Learn"
            onAction={back}
          />
        ) : questions.length === 0 ? (
          <EmptyBlock
            theme={theme}
            title="Not enough words yet"
            text="The quiz needs at least four different words. Practise some word cards first."
            actionLabel="Back to Learn"
            onAction={back}
          />
        ) : finished ? (
          <Reveal index={0}>
            <ResultCard
              theme={theme}
              view={resultMessage(result)}
              passed={result.passed}
              onAgain={restart}
              onBack={back}
              extra={
                result.passed && songNumber !== undefined
                  ? `Step 2 of PS ${songNumber} is done.`
                  : level === 1 && result.passed
                    ? "Level 2 is open."
                    : undefined
              }
            />
          </Reveal>
        ) : question ? (
          <Reveal index={0} style={styles.stack}>
            <ProgressBar
              value={(index + (picked !== null ? 1 : 0)) / questions.length}
              trackColor={theme.line}
              fillColor={theme.brand}
            />
            <Text style={[amType.label, { color: theme.eyebrow }]}>
              Question {index + 1} of {questions.length}
            </Text>
            <Text style={[amType.title, { color: theme.textHeading }]} accessibilityRole="header">
              {question.prompt}
            </Text>
            <AnswerCards theme={theme} question={question} picked={picked} onPick={onPick} />
            <Text
              accessibilityLiveRegion="polite"
              style={[amType.body, { color: theme.textBody, minHeight: 44 }]}
            >
              {picked !== null ? answerFeedback(question, picked) : ""}
            </Text>
            {picked !== null ? (
              <PillButton
                theme={theme}
                label={isLast ? "See result" : "Next question"}
                onPress={onNext}
                style={styles.next}
              />
            ) : null}
          </Reveal>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: amGap.block, paddingBottom: 140 },
  stack: { gap: amGap.block },
  next: { alignSelf: "flex-start" },
})
