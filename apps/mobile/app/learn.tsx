import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useFocusEffect, useRouter } from "expo-router"
import { Guitar, Layers, CircleQuestionMark, Piano } from "lucide-react-native"

import {
  ContinueCard,
  ExploreRow,
  HUB_INSET,
  HubEmpty,
  HubHeading,
  HubSectionHead,
  HubShelf,
  HubTile,
  HubTopRow,
  SeeAllCard,
  SongShelfCard,
  WordOfDayRow,
} from "@/components/learn-v2/LearnHub"
import { ChooseRow, SearchAllRow, StatusCounters } from "@/components/learn-v2/LearnChain"
import { useLearnTopInset } from "@/components/learn-v2/ui"
import { Toast } from "@/components/songs-v2/Toast"
import { Reveal } from "@/components/today/motion"
import { protoFor } from "@/constants/tokens/amToday"
import { useProfileInitial } from "@/hooks/useProfileInitial"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useLearnHydrated } from "@/hooks/useLearnHydrated"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useLearnSongs } from "@/hooks/useLearnSongs"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useNotificationItems } from "@/hooks/useNotificationItems"
import { useOpenProfileSheet } from "@/components/nav-v2/useOpenProfileSheet"
import { INDEX_SUMMARY, LEARN_SUGGESTED_NUMBERS, MOCKUP_LEARN, learnSongTitle } from "@/lib/fixtures/learn"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { learnWordList, learnWordsAvailable } from "@/lib/learn/verified"
import {
  HUB_LINKS,
  buildChoices,
  buildContinue,
  buildShelf,
  quizSubtitle,
  quizTarget,
  statsLine,
  wordCardsSubtitle,
} from "@/lib/learn/hub"
import { PS_SONG_COUNT } from "@/lib/learn/learnSongs"
import { nextOpenQuizLevel, type LearningSong } from "@/lib/learn/progress"
import { LEARN_ROUTES, indexHref, wordsHref } from "@/lib/learn/routes"
import { songStatusCounts } from "@/lib/learn/songStatus"
import { dueCardCount, wordsLearnedCount } from "@/lib/learn/srs"
import { sessionDeck, songNumbersFromIds, wordOfTheDay, wordsForSong } from "@/lib/learn/words"
import { useLearnStore } from "@/stores/learnStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"

/**
 * Learn tab, variant A (Dada, 10 November 2026): one page, one chain. Continue, then My songs with the three
 * counters (Not started, Learning, Learned) and a shelf of songs with their steps (Words, Quiz, Chords), then
 * "I want to learn this" (choose a new song, search all 5018), then Practice (word cards, the quiz over all words,
 * word of the day). Below the chain stay the blocks that were there before: Play along (Harmonium, Chords), the raga
 * and tala index, how to play the harmonium, Stories. The full list is the "See all" screen (/learn/songs).
 */
export default function LearnScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const top = useLearnTopInset()
  const bottomInset = useScrollBottomInset()
  const hydrated = useLearnHydrated()
  const openProfile = useOpenProfileSheet()
  const { unread } = useNotificationItems()
  // "now" is read again every time the tab comes into view, so after midnight "due today" is today's
  const [now, setNow] = useState(() => Date.now())
  useFocusEffect(useCallback(() => setNow(Date.now()), []))
  // word meanings and quiz questions are unchecked prototype content: a real build shows an honest state instead
  const wordsReady = learnWordsAvailable()
  const wordList = learnWordList()

  const initial = useProfileInitial()

  const cards = useLearnStore((s) => s.cards)
  const songs = useLearnStore((s) => s.songs)
  const paths = useLearnStore((s) => s.paths)
  const quizBest = useLearnStore((s) => s.quizBest)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)

  const go = (path: string) => router.push(href(path))

  // taking a song off the list (the small x on its card): Undo for a few seconds, progress stays saved
  const songsTheme = useSongsTheme()
  const learn = useLearnSongs()
  const [removedNote, setRemovedNote] = useState<{ message: string; song: LearningSong | null } | null>(null)
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (noteTimer.current) clearTimeout(noteTimer.current)
  }, [])
  const removeSong = useCallback(
    (number: number) => {
      const song = learn.remove(number)
      if (!song) return
      if (noteTimer.current) clearTimeout(noteTimer.current)
      setRemovedNote({ message: t("learn.add.toast.removed", { number }), song })
      noteTimer.current = setTimeout(() => setRemovedNote(null), 4000)
    },
    [learn, t],
  )
  const undoRemove = useCallback(() => {
    if (!removedNote?.song) return
    learn.restore(removedNote.song)
    setRemovedNote(null)
  }, [learn, removedNote])
  // "+ Learn" on a suggested song: it moves to My songs, a short note says so (no Undo: the x on its card takes it off)
  const addChoice = useCallback(
    (number: number, title: string) => {
      learn.add(number, title)
      if (noteTimer.current) clearTimeout(noteTimer.current)
      setRemovedNote({ message: t("learn.add.toast.added", { number }), song: null })
      noteTimer.current = setTimeout(() => setRemovedNote(null), 3000)
    },
    [learn, t],
  )

  // Not started / Learning / Learned from the two steps that count, Words and Quiz (Chords are an extra)
  const counts = useMemo(() => songStatusCounts(songs, paths), [songs, paths])
  const words = wordsReady ? wordsLearnedCount(cards) : 0
  const due = wordsReady ? dueCardCount(cards, now) : 0
  const hasCards = wordsReady && Object.keys(cards).length > 0
  const quizLevel = nextOpenQuizLevel(quizBest)

  const hasWords = useCallback((songNumber: number) => wordsForSong(wordList, songNumber).length > 0, [wordList])
  const continueModel = useMemo(
    () => buildContinue(songs, paths, LEARN_SUGGESTED_NUMBERS, learnSongTitle, hasWords),
    [songs, paths, hasWords],
  )
  const shelf = useMemo(() => buildShelf(songs, paths), [songs, paths])
  const choices = useMemo(() => buildChoices(songs, LEARN_SUGGESTED_NUMBERS, learnSongTitle), [songs])

  const deck = useMemo(
    () => sessionDeck(wordList, [...songs.map((song) => song.number), ...songNumbersFromIds(savedSongIds)]),
    [wordList, songs, savedSongIds],
  )
  const wordOfDay = useMemo(
    () =>
      MOCKUP_DATA
        ? (wordList.find((word) => word.roman === MOCKUP_LEARN.wordOfDay) ?? null)
        : wordOfTheDay(deck.filter((word) => word.roman.length > 3), new Date(now)),
    [deck, now, wordList],
  )

  const nothingYet = counts.total === 0 && words === 0
  const stats = statsLine(counts.learned, counts.learning, words)
  // each phrase starts with its number; the number is drawn bold, the rest plain
  const part = (text: string) => {
    const at = text.indexOf(" ")
    return at < 0 ? { value: text, rest: "" } : { value: text.slice(0, at), rest: text.slice(at) }
  }
  const statsParts = [
    part(t("learn.songsLearned", { count: counts.learned })),
    part(t("learn.learning", { count: counts.learning })),
    part(t("learn.words", { count: words })),
  ]
  const iconColor = p.orange700

  return (
    <View style={[styles.root, { backgroundColor: p.sand200 }]}>
      <LinearGradient
        pointerEvents="none"
        colors={p.dark ? ["rgba(74, 46, 28, 0.6)", "rgba(74, 46, 28, 0)"] : [p.orange100, "rgba(255, 220, 197, 0)"]}
        style={styles.wash}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: bottomInset }]}
      >
        <Reveal index={0}>
          <HubTopRow
            p={p}
            initial={initial}
            unread={unread > 0}
            onAvatar={openProfile}
            onSearch={() => go("/search-v2?focus=1")}
            onBell={() => go("/notifications")}
          />
        </Reveal>
        <Reveal index={1}>
          <HubHeading
            p={p}
            explanation={t("learn.explain")}
            stats={nothingYet ? t("learn.nothingYet") : stats}
            statsParts={nothingYet ? [part(t("learn.songsLearned", { count: 0 })), part(t("learn.words", { count: 0 }))] : statsParts}
          />
        </Reveal>

        {!hydrated ? null : (
          <>
            {continueModel.kind !== "none" ? (
              <Reveal index={2}>
                <ContinueCard model={continueModel} onGo={() => go(continueModel.href)} />
              </Reveal>
            ) : null}

            <Reveal index={3} style={styles.section}>
              <HubSectionHead
                p={p}
                eyebrow={t("learn.page.my.eyebrow")}
                first={t("learn.page.my.first")}
                second={t("learn.page.my.second")}
              />
              <StatusCounters p={p} counts={counts} />
              {shelf.length > 0 ? (
                <HubShelf>
                  {shelf.map((entry) => (
                    <SongShelfCard
                      key={entry.songId}
                      p={p}
                      entry={entry}
                      onPress={() => go(`/learn/song/${entry.songId}`)}
                      onRemove={entry.listed ? () => removeSong(entry.number) : undefined}
                    />
                  ))}
                  <SeeAllCard p={p} count={counts.total} onPress={() => go(HUB_LINKS.allSongs)} />
                </HubShelf>
              ) : (
                <HubEmpty p={p} text={t("learn.page.my.empty")} />
              )}
            </Reveal>

            <Reveal index={4} style={styles.section}>
              <HubSectionHead
                p={p}
                eyebrow={t("learn.page.choose.eyebrow")}
                first={t("learn.page.choose.first")}
                second={t("learn.page.choose.second")}
              />
              <View style={styles.pad}>
                {choices.map((song) => (
                  <ChooseRow
                    key={song.songId}
                    p={p}
                    song={song}
                    wordsReady={hasWords(song.number)}
                    onOpen={() => go(`/learn/song/${song.songId}`)}
                    onAdd={() => addChoice(song.number, song.title)}
                  />
                ))}
                {choices.length === 0 ? <HubEmpty p={p} text={t("learn.page.choose.none")} /> : null}
                <SearchAllRow p={p} count={PS_SONG_COUNT} onPress={() => go(HUB_LINKS.pickSong)} />
              </View>
            </Reveal>

            <Reveal index={5} style={styles.section}>
              <HubSectionHead p={p} eyebrow={t("learn.sect.fresh")} first={t("learn.sect.fresh.first")} second={t("learn.sect.fresh.second")} />
              <View style={styles.pad}>
                {wordsReady ? (
                  <>
                    <View style={styles.tiles}>
                      <HubTile
                        p={p}
                        icon={<Layers size={22} color={iconColor} strokeWidth={1.9} />}
                        title={t("learn.wordCards")}
                        subtitle={wordCardsSubtitle(due, hasCards)}
                        emphasis={due > 0}
                        onPress={() => go(HUB_LINKS.wordCards)}
                      />
                      <HubTile
                        p={p}
                        icon={<CircleQuestionMark size={22} color={iconColor} strokeWidth={1.9} />}
                        title={t("learn.quiz")}
                        subtitle={quizSubtitle(quizLevel)}
                        onPress={() => go(quizTarget(quizLevel))}
                      />
                    </View>
                    {wordOfDay ? (
                      <WordOfDayRow
                        p={p}
                        word={wordOfDay.roman}
                        meaning={wordOfDay.meaning}
                        songNumber={wordOfDay.songNumber}
                        onPress={() => go(wordsHref({ song: wordOfDay.songNumber }))}
                      />
                    ) : null}
                  </>
                ) : (
                  <HubEmpty p={p} text={t("learn.gate.hub")} />
                )}
              </View>
            </Reveal>

            <Reveal index={6} style={styles.section}>
              <HubSectionHead p={p} eyebrow={t("learn.sect.along")} first={t("learn.sect.along.first")} second={t("learn.sect.along.second")} />
              <View style={[styles.pad, styles.tiles]}>
                <HubTile
                  p={p}
                  icon={<Piano size={22} color={iconColor} strokeWidth={1.9} />}
                  title={t("learn.harmonium")}
                  subtitle={t("learn.harmonium.sub")}
                  onPress={() => go(HUB_LINKS.harmonium)}
                />
                <HubTile
                  p={p}
                  icon={<Guitar size={22} color={iconColor} strokeWidth={1.9} />}
                  title={t("learn.chords")}
                  subtitle={t("learn.chords.sub")}
                  onPress={() => go(HUB_LINKS.chords)}
                />
              </View>
            </Reveal>

            <Reveal index={7} style={styles.section}>
              <HubSectionHead p={p} eyebrow={t("learn.sect.deeper")} first={t("learn.sect.deeper.first")} second={t("learn.sect.deeper.second")} />
              <View style={[styles.pad, styles.rows]}>
                {/* The raga and tala index is prototype content (invented song counts); the catalog has no raga data yet. */}
                {MOCKUP_DATA ? (
                  <ExploreRow
                    p={p}
                    title={t("learn.index")}
                    subtitle={t("learn.index.summary", { ragas: INDEX_SUMMARY.ragas, talas: INDEX_SUMMARY.talas })}
                    onPress={() => go(indexHref("tala"))}
                  />
                ) : null}
                <ExploreRow
                  p={p}
                  title={t("learn.page.harmoniumHow")}
                  subtitle={t("learn.page.harmoniumHow.sub")}
                  onPress={() => go(HUB_LINKS.harmonium)}
                />
                <ExploreRow p={p} title={t("learn.stories")} onPress={() => go(HUB_LINKS.stories)} />
                {/* hidden for now, Dada 2026-11-05: <ExploreRow p={p} title="Certificates" subtitle="Live quiz · none yet" onPress={() => go(HUB_LINKS.certificates)} /> */}
              </View>
            </Reveal>
          </>
        )}
      </ScrollView>
      <Toast
        message={removedNote?.message ?? null}
        theme={songsTheme}
        action={removedNote ? { label: t("learn.add.undo"), onPress: undoRemove } : null}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  wash: { position: "absolute", left: 0, right: 0, top: 0, height: 420 },
  content: { paddingBottom: 190, gap: 28 },
  section: { gap: 16 },
  pad: { paddingHorizontal: HUB_INSET, gap: 12 },
  tiles: { flexDirection: "row", gap: 12 },
  rows: { gap: 8 },
})
