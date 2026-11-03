import { useMemo, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import {
  Chip,
  EmptyBlock,
  HarmoniumCard,
  LibraryRow,
  PracticeCard,
  ProgressCard,
  QuizLevelRow,
  StatsStrip,
  ToolRow,
  WordOfDayCard,
} from "@/components/learn-v2/LearnBlocks"
import { Segmented } from "@/components/learn-v2/ui"
import { Reveal } from "@/components/today/motion"
import { TwoToneHeading } from "@/components/today/TodayBlocks"
import { amGap } from "@/constants/tokens/amSpacing"
import { SAMPLE_LEARN_WORDS } from "@/data/learnWords"
import { useAmTheme } from "@/hooks/useAmTheme"
import {
  learnProgress,
  levelName,
  pathDots,
  pathDoneCount,
  practiceSummary,
  progressLine,
  songLibraryState,
  songsWithDueWords,
  type LearningSong,
} from "@/lib/learn/progress"
import { levelStatuses, type LearnQuizLevel, type QuizBest } from "@/lib/learn/quiz"
import { LEARN_ROUTES, quizHref, songHref, songPathHref, wordsHref } from "@/lib/learn/routes"
import { pickDeck, songNumbersFromIds, wordOfTheDay } from "@/lib/learn/words"
import { useLearnStore } from "@/stores/learnStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

type Tab = "practice" | "songs" | "tools"
type Filter = "all" | "due" | "learning" | "learned"

const TABS = [
  { key: "practice", label: "Practice" },
  { key: "songs", label: "My songs" },
  { key: "tools", label: "Tools" },
] as const

const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "due", label: "Due" },
  { key: "learning", label: "Learning" },
  { key: "learned", label: "Learned" },
]

function bestLabel(best: QuizBest | undefined): string | null {
  if (!best) return null
  return `Best ${best.score} of ${best.total}${best.passed ? ", passed" : ""}`
}

/**
 * Learn (spec SCR-15 as restructured in SCR-36 and SCR-40): three tabs, Practice,
 * My songs and Tools, with one slim stats strip under them. Redesign screen,
 * reachable at /learn until the tab bar switches to it.
 */
export default function LearnScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const now = useMemo(() => Date.now(), [])
  const today = useMemo(() => new Date(now), [now])

  const cards = useLearnStore((s) => s.cards)
  const songs = useLearnStore((s) => s.songs)
  const paths = useLearnStore((s) => s.paths)
  const quizBest = useLearnStore((s) => s.quizBest)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)

  const [tab, setTab] = useState<Tab>("practice")
  const [filter, setFilter] = useState<Filter>("all")

  const go = (path: string) => router.push(href(path))

  const progress = useMemo(() => learnProgress(songs, paths, cards), [songs, paths, cards])
  const summary = useMemo(() => practiceSummary(songs, paths, cards, now), [songs, paths, cards, now])
  const levels = useMemo(() => levelStatuses(quizBest), [quizBest])

  const learnedCount = songs.filter((song) => pathDoneCount(paths[song.songId]) === 3).length
  const learningCount = songs.length - learnedCount

  const deck = useMemo(
    () => pickDeck(SAMPLE_LEARN_WORDS, [...songs.map((song) => song.number), ...songNumbersFromIds(savedSongIds)]),
    [songs, savedSongIds],
  )
  const wordOfDay = useMemo(() => wordOfTheDay(deck, today), [deck, today])
  const dueSongs = useMemo(() => songsWithDueWords(SAMPLE_LEARN_WORDS, cards, now), [cards, now])

  const rows = useMemo(() => {
    const view = songs.map((song: LearningSong) => {
      const path = paths[song.songId]
      const state = songLibraryState(path)
      const due = dueSongs.has(song.number)
      return { song, path, state, due }
    })
    const rank = (r: (typeof view)[number]) => (r.due ? 0 : r.state === "learning" ? 1 : r.state === "notStarted" ? 2 : 3)
    return view
      .filter((r) => {
        if (filter === "due") return r.due
        if (filter === "learning") return r.state !== "learned"
        if (filter === "learned") return r.state === "learned"
        return true
      })
      .sort((a, b) => rank(a) - rank(b) || a.song.number - b.song.number)
  }, [songs, paths, dueSongs, filter])

  let block = 0
  const next = () => block++

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: amGap.gutter }]}
      >
        <Reveal index={next()}>
          <TwoToneHeading theme={theme} first="Learn" second="practise and play" />
        </Reveal>

        <Reveal index={next()} style={styles.stack}>
          <Segmented theme={theme} options={TABS} value={tab} onChange={(key) => setTab(key as Tab)} />
          <StatsStrip
            theme={theme}
            learned={learnedCount}
            total={songs.length}
            learning={learningCount}
            words={progress.wordsLearned}
          />
        </Reveal>

        {tab === "practice" ? (
          <Reveal index={next()} style={styles.stack}>
            <ProgressCard
              theme={theme}
              levelLabel={levelName(quizBest)}
              progress={progress}
              line={progressLine(progress)}
              onContinue={() => go(wordsHref())}
              onQuiz={() => go(quizHref())}
            />
            <PracticeCard theme={theme} summary={summary} onStart={() => go(wordsHref())} />
            {wordOfDay ? (
              <WordOfDayCard
                theme={theme}
                word={wordOfDay}
                practiseCount={deck.length}
                onPractise={() => go(wordsHref())}
              />
            ) : null}
          </Reveal>
        ) : null}

        {tab === "songs" ? (
          <Reveal index={next()} style={styles.stack}>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {FILTERS.map((item) => (
                <Chip key={item.key} theme={theme} label={item.label} on={filter === item.key} onPress={() => setFilter(item.key)} />
              ))}
            </View>
            {songs.length === 0 ? (
              <EmptyBlock
                theme={theme}
                title="No songs yet"
                text="Open a song and tap Learn. It shows up here with its three steps."
                actionLabel="Find a song"
                onAction={() => go(LEARN_ROUTES.songs)}
              />
            ) : rows.length === 0 ? (
              <EmptyBlock
                theme={theme}
                title="Nothing here"
                text={filter === "due" ? "No song has words due today." : "No song matches this filter."}
                actionLabel="Show all"
                onAction={() => setFilter("all")}
              />
            ) : (
              rows.map(({ song, path, state, due }) => {
                const done = pathDoneCount(path)
                const repeat = state === "learned" || due
                return (
                  <LibraryRow
                    key={song.songId}
                    theme={theme}
                    number={song.number}
                    title={song.title}
                    state={state}
                    due={due}
                    dots={pathDots(path)}
                    note={due ? "Words due today" : state === "learned" ? "All three steps done" : `${done} of 3 steps`}
                    ctaLabel={repeat ? "Repeat" : state === "notStarted" ? "Start" : "Continue"}
                    onOpen={() => go(songHref(song.songId))}
                    onCta={() => go(repeat ? wordsHref({ song: song.number }) : songPathHref(song.songId))}
                  />
                )
              })
            )}
          </Reveal>
        ) : null}

        {tab === "tools" ? (
          <Reveal index={next()} style={styles.stack}>
            <HarmoniumCard
              theme={theme}
              onKeyboard={() => go(LEARN_ROUTES.harmonium)}
              onChords={() => go(LEARN_ROUTES.harmoniumChords)}
            />
            <ToolRow
              theme={theme}
              eyebrow="Guitar and harmonium"
              title="Chords over the words"
              onPress={() => go(songHref(songs[0]?.songId ?? "ps-1"))}
            />
            {levels.map((status) => (
              <QuizLevelRow
                key={status.level}
                theme={theme}
                status={status}
                best={bestLabel(quizBest[status.level as LearnQuizLevel])}
                onPress={() => go(quizHref({ level: status.level }))}
              />
            ))}
            <ToolRow
              theme={theme}
              eyebrow="Live quiz"
              title="Scan a quiz QR code"
              onPress={() => go(LEARN_ROUTES.liveQuizScan)}
            />
            <ToolRow theme={theme} eyebrow="Quiz" title="Certificates" onPress={() => go(LEARN_ROUTES.liveQuiz)} />
            <ToolRow
              theme={theme}
              eyebrow="Index"
              title="Raga and tala index"
              note="Arrives with the next content update."
            />
            <ToolRow
              theme={theme}
              eyebrow="Stories"
              title="Stories behind the songs"
              onPress={() => go(LEARN_ROUTES.stories)}
            />
            <ToolRow
              theme={theme}
              eyebrow="Reflection"
              title="Reflection archive"
              note="Arrives with the next content update."
            />
            <ToolRow theme={theme} eyebrow="About" title="About the songs" onPress={() => go(LEARN_ROUTES.about)} />
          </Reveal>
        ) : null}

        <View style={styles.tail} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: amGap.block, paddingTop: amGap.block },
  stack: { gap: amGap.grid },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: amGap.grid / 2 },
  tail: { height: 140 },
})
