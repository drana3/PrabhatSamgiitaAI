import { useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { GreenPanel } from "@/components/learn-v2/GreenPanel"
import { ReviewStyleSheet } from "@/components/learn-v2/ReviewStyleSheet"
import { FlipCard, GradeButtons, QueueCounters } from "@/components/learn-v2/WordCardParts"
import { PillButton, ProgressBar, SubHeader } from "@/components/learn-v2/ui"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amGap } from "@/constants/tokens/amSpacing"
import { amType } from "@/constants/tokens/amTypography"
import { SAMPLE_LEARN_WORDS } from "@/data/learnWords"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useLearnHydrated } from "@/hooks/useLearnHydrated"
import { songWordsComplete } from "@/lib/learn/progress"
import { LEARN_ROUTES, parseNumberParam } from "@/lib/learn/routes"
import {
  advanceQueue,
  buildDailyQueue,
  describeNextDue,
  newCard,
  nextDueAt,
  previewIntervals,
  queueCounts,
  queueKind,
  REVIEW_STYLES,
  type Grade,
} from "@/lib/learn/srs"
import { pickDeck, songNumbersFromIds, wordsForSong } from "@/lib/learn/words"
import { useLearnStore } from "@/stores/learnStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

/**
 * Word cards, Anki style (spec SCR-22). Full-screen over Learn or the song path.
 * With ?song=3 the deck is the words of that song, and finishing every card once
 * marks the words part of the song path done.
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
        : pickDeck(SAMPLE_LEARN_WORDS, [...songs.map((song) => song.number), ...songNumbersFromIds(savedSongIds)]),
    [songNumber, songs, savedSongIds],
  )
  const wordById = useMemo(() => new Map(deck.map((word) => [word.id, word])), [deck])

  const [queue, setQueue] = useState<string[] | null>(null)
  const [total, setTotal] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!hydrated || queue !== null) return
    const stamp = Date.now()
    const built = buildDailyQueue(
      deck.map((word) => word.id),
      useLearnStore.getState().cards,
      stamp,
    )
    setNow(stamp)
    setQueue(built)
    setTotal(built.length)
  }, [hydrated, queue, deck])

  const headId = queue?.[0]
  const head = headId ? wordById.get(headId) : undefined
  const headCard = headId ? (cards[headId] ?? newCard(headId, now)) : null

  const finish = () => {
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
  const title = songNumber !== undefined ? `PS ${songNumber} · Word cards` : "Word cards"

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: amGap.gutter }]}
      >
        <SubHeader theme={theme} title={title} onBack={finish} />

        {queue === null ? (
          <Text style={[amType.body, { color: theme.textBody }]}>Loading your cards…</Text>
        ) : (
          <>
            <Reveal index={0} style={styles.stack}>
              <View style={styles.topRow}>
                <QueueCounters
                  theme={theme}
                  counts={queueCounts(queue, cards, now)}
                  active={headCard ? queueKind(headCard) : null}
                />
                <PillButton
                  theme={theme}
                  label={`Review style: ${styleName}`}
                  variant="sand"
                  onPress={() => setSheetOpen(true)}
                  style={styles.styleButton}
                />
              </View>
              <ProgressBar value={fraction} trackColor={theme.line} fillColor={theme.brand} />
            </Reveal>

            {head && headCard ? (
              <Reveal index={1} style={styles.stack}>
                <FlipCard word={head} flipped={flipped} />
                {flipped ? (
                  <GradeButtons theme={theme} intervals={previewIntervals(headCard, reviewStyle)} onGrade={onGrade} />
                ) : (
                  <PillButton theme={theme} label="Show answer" onPress={() => setFlipped(true)} />
                )}
              </Reveal>
            ) : (
              <DoneCard
                total={total}
                nextLine={describeNextDue(nextDueAt(cards, Date.now()), Date.now())}
                onBack={finish}
                theme={theme}
              />
            )}
          </>
        )}
      </ScrollView>

      <ReviewStyleSheet
        theme={theme}
        visible={sheetOpen}
        value={reviewStyle}
        onSelect={setReviewStyle}
        onClose={() => setSheetOpen(false)}
      />
    </SafeAreaView>
  )
}

function DoneCard({
  theme,
  total,
  nextLine,
  onBack,
}: {
  theme: ReturnType<typeof useAmTheme>
  total: number
  nextLine: string
  onBack: () => void
}) {
  return (
    <Reveal index={1}>
      <GreenPanel>
        <Text style={[amType.title, { color: amColors.white }]}>
          {total === 0 ? "Nothing due" : "All cards done for today"}
        </Text>
        <Text style={[amType.lead, { color: amColors.white }]}>
          {total === 0
            ? "No word is waiting right now."
            : `${total} ${total === 1 ? "card" : "cards"} learned today.`}
        </Text>
        <Text style={[amType.body, { color: "rgba(255,255,255,0.86)" }]}>{nextLine}</Text>
        <PillButton theme={theme} label="Back to Learn" onPress={onBack} style={styles.back} />
      </GreenPanel>
    </Reveal>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: amGap.block, paddingBottom: 140 },
  stack: { gap: amGap.block },
  topRow: { gap: amGap.grid },
  styleButton: { alignSelf: "flex-start", minHeight: 44 },
  back: { alignSelf: "flex-start", marginTop: 6 },
})
