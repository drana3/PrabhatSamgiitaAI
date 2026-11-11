import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { DoneCard, FlashCard, GradeButtons, QueueCounters, ReviewStyleBar } from "@/components/learn-v2/CardsParts"
import { EmptyCard } from "@/components/learn-v2/LearnBlocks"
import { ScopeLine } from "@/components/learn-v2/ScopeLine"
import { ReviewStyleSheet } from "@/components/learn-v2/ReviewStyleSheet"
import { LearnGate } from "@/components/learn-v2/LearnGate"
import { OverlayScreen, Over, Pill, Track } from "@/components/learn-v2/ui"
import { Reveal } from "@/components/today/motion"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useLearnHydrated } from "@/hooks/useLearnHydrated"
import { useStudyScope } from "@/hooks/useStudyScope"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { learnWordList, learnWordsAvailable } from "@/lib/learn/verified"
import { mockCounts, mockIntervals, mockIsReview, mockKind, type MockGrades } from "@/lib/learn/mockupCards"
import { songWordsComplete } from "@/lib/learn/progress"
import { LEARN_ROUTES, parseNumberParam } from "@/lib/learn/routes"
import {
  advanceQueue,
  buildDailyQueue,
  newCard,
  previewIntervals,
  queueCounts,
  queueKind,
  REVIEW_STYLES,
  type Grade,
} from "@/lib/learn/srs"
import { deckLine, emptyKind, partialLine } from "@/lib/learn/scopeText"
import { songFactsFor } from "@/lib/learn/songQuiz"
import { quizNotNeeded } from "@/lib/learn/songStatus"
import { wordsForSong } from "@/lib/learn/words"
import { useLearnStore } from "@/stores/learnStore"
import { href } from "@/utils/href"

/**
 * Word cards, Anki style (prototype FLASHCARDS, SCR-22). Full screen over Learn or the
 * song path. With ?song=3 the deck is the words of that song, and answering every card
 * once marks the words step of that song's path done.
 */
export default function WordCardsScreen() {
  return learnWordsAvailable() ? <WordCards /> : <LearnGate kind="words" />
}

function WordCards() {
  const router = useRouter()
  const theme = useAmTheme()
  const t = useT()
  const params = useLocalSearchParams<{ song?: string }>()
  const songNumber = parseNumberParam(params.song)
  const hydrated = useLearnHydrated()

  const cards = useLearnStore((s) => s.cards)
  const reviewStyle = useLearnStore((s) => s.reviewStyle)
  const grade = useLearnStore((s) => s.grade)
  const markPart = useLearnStore((s) => s.markPart)
  const setReviewStyle = useLearnStore((s) => s.setReviewStyle)
  // without a song of its own the deck is "what to study" (the same choice the quiz uses); the preview keeps its ten cards
  const study = useStudyScope()
  const deck = useMemo(
    () =>
      songNumber !== undefined
        ? wordsForSong(learnWordList(), songNumber).slice(0, MOCKUP_DATA ? 10 : undefined)
        : study.words.slice(0, MOCKUP_DATA ? 10 : undefined),
    [songNumber, study.words],
  )
  const scopeEmpty = songNumber === undefined ? emptyKind(study.summary) : null
  const changeScope = () => router.push(href(LEARN_ROUTES.scope))
  const wordById = useMemo(() => new Map(deck.map((word) => [word.id, word])), [deck])

  const [queue, setQueue] = useState<string[] | null>(null)
  const [total, setTotal] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [round, setRound] = useState(0)
  // preview only: how each card was answered this session (the prototype's `fgr`)
  const [mockGrades, setMockGrades] = useState<MockGrades>({})

  useEffect(() => {
    if (!hydrated) return
    const stamp = Date.now()
    const ids = deck.map((word) => word.id)
    // "Study again" goes through the whole deck once more, due or not
    // the preview shows the deck in song order, like the prototype
    const built = MOCKUP_DATA || round > 0 ? ids : buildDailyQueue(ids, useLearnStore.getState().cards, stamp)
    if (MOCKUP_DATA) setMockGrades({})
    setNow(stamp)
    setQueue(built)
    setTotal(built.length)
    setFlipped(false)
  }, [hydrated, deck, round])

  const headId = queue?.[0]
  const head = headId ? wordById.get(headId) : undefined
  const headCard = headId ? (cards[headId] ?? newCard(headId, now)) : null

  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href(LEARN_ROUTES.learn))
  }

  const onGrade = (value: Grade) => {
    if (!queue || !headId) return
    grade(headId, value)
    if (MOCKUP_DATA) setMockGrades((prev) => ({ ...prev, [headId]: value }))
    setQueue(advanceQueue(queue, value))
    setFlipped(false)
    if (songNumber !== undefined) {
      const latest = useLearnStore.getState().cards
      if (songWordsComplete(deck.map((word) => word.id), latest)) {
        markPart(`ps-${songNumber}`, "words")
        // too few words for a quiz: Words alone make the song Learned, so mark the Quiz step with it
        if (quizNotNeeded(songFactsFor(learnWordList(), songNumber, null))) markPart(`ps-${songNumber}`, "meaning")
      }
    }
  }

  const styleName = REVIEW_STYLES.find((option) => option.key === reviewStyle)?.name ?? ""
  const remaining = queue?.length ?? 0
  const fraction = total === 0 ? 1 : 1 - remaining / total
  const live = Boolean(head && headCard)
  const deckIds = useMemo(() => deck.map((word) => word.id), [deck])
  const headKind = !headId ? null : MOCKUP_DATA ? mockKind(headId, deckIds, mockGrades) : headCard ? queueKind(headCard) : null
  const counts = !queue ? null : MOCKUP_DATA ? mockCounts(queue, deckIds, mockGrades) : queueCounts(queue, cards, now)
  const intervals =
    headId && headCard
      ? MOCKUP_DATA
        ? mockIntervals(reviewStyle, mockIsReview(deckIds.indexOf(headId), deckIds.length), headKind === "learning")
        : previewIntervals(headCard, reviewStyle)
      : null

  return (
    <OverlayScreen
      theme={theme}
      onBack={back}
      label={songNumber !== undefined ? t("learn.cards.screenSong", { number: songNumber }) : t("learn.cards.screen")}
      right={
        queue && counts && headCard !== undefined ? (
          <QueueCounters theme={theme} counts={counts} active={headKind} />
        ) : null
      }
      overlay={
        <ReviewStyleSheet
          theme={theme}
          visible={sheetOpen}
          value={reviewStyle}
          onSelect={setReviewStyle}
          onClose={() => setSheetOpen(false)}
        />
      }
    >
      {queue === null ? (
        <Over color={theme.eyebrow}>{t("learn.cards.loading")}</Over>
      ) : scopeEmpty ? (
        <>
          <ScopeLine theme={theme} deck={deckLine(study.summary)} note={partialLine(study.summary)} onChange={changeScope} />
          <EmptyCard
            theme={theme}
            eyebrow={t("learn.scope.empty.eyebrow")}
            title={scopeEmpty === "none" ? t("learn.scope.empty.none.title") : t("learn.scope.empty.title")}
            text={scopeEmpty === "none" ? t("learn.scope.empty.none.text") : t("learn.scope.empty.text")}
            action={t("learn.scope.empty.action")}
            onAction={changeScope}
          />
        </>
      ) : (
        <>
          {songNumber === undefined ? (
            <ScopeLine theme={theme} deck={deckLine(study.summary)} note={partialLine(study.summary)} onChange={changeScope} />
          ) : null}
          <Reveal index={0}>
            <Track theme={theme} value={fraction} />
          </Reveal>
          <Reveal index={1}>
            <ReviewStyleBar theme={theme} name={styleName} onPress={() => setSheetOpen(true)} />
          </Reveal>
          {live && head && headCard ? (
            <Reveal index={2} style={styles.stack}>
              <FlashCard word={head} kindLabel={t(`learn.cards.kind.${headKind ?? "new"}`)} flipped={flipped} onShow={() => setFlipped(true)} />
              {flipped && intervals ? (
                <GradeButtons theme={theme} intervals={intervals} onGrade={onGrade} />
              ) : (
                <Pill theme={theme} full height={56} label={t("learn.cards.showAnswer")} onPress={() => setFlipped(true)} />
              )}
              <Text style={[styles.note, { color: theme.textBody }]}>
                {t("learn.cards.hint")}
              </Text>
            </Reveal>
          ) : (
            <Reveal index={2} style={styles.stack}>
              <DoneCard
                theme={theme}
                text={
                  total === 0 ? t("learn.cards.none") : t("learn.cards.answered", { count: total })
                }
                onAgain={() => setRound((value) => value + 1)}
                onBack={back}
              />
            </Reveal>
          )}
        </>
      )}
    </OverlayScreen>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 20 },
  note: { fontFamily: "Roboto_500Medium", fontSize: 13, lineHeight: 18, textAlign: "center" },
})
