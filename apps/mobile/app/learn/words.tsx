import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { DoneCard, FlashCard, GradeButtons, QueueCounters, ReviewStyleBar } from "@/components/learn-v2/CardsParts"
import { ReviewStyleSheet } from "@/components/learn-v2/ReviewStyleSheet"
import { OverlayScreen, Over, Pill, Track } from "@/components/learn-v2/ui"
import { Reveal } from "@/components/today/motion"
import { SAMPLE_LEARN_WORDS } from "@/data/learnWords"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useLearnHydrated } from "@/hooks/useLearnHydrated"
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
import { sessionDeck, songNumbersFromIds, wordsForSong } from "@/lib/learn/words"
import { useLearnStore } from "@/stores/learnStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

const KIND_LABEL = { new: "New card", learning: "Learning card", due: "Review card" } as const

/**
 * Word cards, Anki style (prototype FLASHCARDS, SCR-22). Full screen over Learn or the
 * song path. With ?song=3 the deck is the words of that song, and answering every card
 * once marks the words step of that song's path done.
 */
export default function WordCardsScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const params = useLocalSearchParams<{ song?: string }>()
  const songNumber = parseNumberParam(params.song)
  const hydrated = useLearnHydrated()

  const cards = useLearnStore((s) => s.cards)
  const songs = useLearnStore((s) => s.songs)
  const reviewStyle = useLearnStore((s) => s.reviewStyle)
  const grade = useLearnStore((s) => s.grade)
  const markPart = useLearnStore((s) => s.markPart)
  const setReviewStyle = useLearnStore((s) => s.setReviewStyle)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)

  const deck = useMemo(
    () =>
      songNumber !== undefined
        ? wordsForSong(SAMPLE_LEARN_WORDS, songNumber)
        : sessionDeck(SAMPLE_LEARN_WORDS, [...songs.map((song) => song.number), ...songNumbersFromIds(savedSongIds)]),
    [songNumber, songs, savedSongIds],
  )
  const wordById = useMemo(() => new Map(deck.map((word) => [word.id, word])), [deck])

  const [queue, setQueue] = useState<string[] | null>(null)
  const [total, setTotal] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (!hydrated) return
    const stamp = Date.now()
    const ids = deck.map((word) => word.id)
    // "Study again" goes through the whole deck once more, due or not
    const built = round > 0 ? ids : buildDailyQueue(ids, useLearnStore.getState().cards, stamp)
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
    setQueue(advanceQueue(queue, value))
    setFlipped(false)
    if (songNumber !== undefined) {
      const latest = useLearnStore.getState().cards
      if (songWordsComplete(deck.map((word) => word.id), latest)) markPart(`ps-${songNumber}`, "words")
    }
  }

  const styleName = REVIEW_STYLES.find((option) => option.key === reviewStyle)?.name ?? ""
  const remaining = queue?.length ?? 0
  const fraction = total === 0 ? 1 : 1 - remaining / total
  const live = Boolean(head && headCard)

  return (
    <OverlayScreen
      theme={theme}
      onBack={back}
      label={songNumber !== undefined ? `Words · PS ${songNumber}` : "Words"}
      right={
        queue && headCard !== undefined ? (
          <QueueCounters
            theme={theme}
            counts={queueCounts(queue, cards, now)}
            active={headCard ? queueKind(headCard) : null}
          />
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
        <Over color={theme.eyebrow}>Loading your cards</Over>
      ) : (
        <>
          <Reveal index={0}>
            <Track theme={theme} value={fraction} />
          </Reveal>
          <Reveal index={1}>
            <ReviewStyleBar theme={theme} name={styleName} onPress={() => setSheetOpen(true)} />
          </Reveal>
          {live && head && headCard ? (
            <Reveal index={2} style={styles.stack}>
              <FlashCard word={head} kindLabel={KIND_LABEL[queueKind(headCard)]} flipped={flipped} onShow={() => setFlipped(true)} />
              {flipped ? (
                <GradeButtons theme={theme} intervals={previewIntervals(headCard, reviewStyle)} onGrade={onGrade} />
              ) : (
                <Pill theme={theme} full height={56} label="Show answer" onPress={() => setFlipped(true)} />
              )}
              <Text style={[styles.note, { color: theme.textBody }]}>
                The time under each button is when you will see this card again.
              </Text>
            </Reveal>
          ) : (
            <Reveal index={2} style={styles.stack}>
              <DoneCard
                theme={theme}
                text={
                  total === 0
                    ? "No word is waiting right now. Words come back here when it is time."
                    : `${total} ${total === 1 ? "card" : "cards"} answered. The next ones come back in 10 minutes and tomorrow.`
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
