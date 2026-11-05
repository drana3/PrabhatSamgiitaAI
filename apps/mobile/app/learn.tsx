import { useMemo } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
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
import { useLearnTopInset } from "@/components/learn-v2/ui"
import { Reveal } from "@/components/today/motion"
import { SAMPLE_LEARN_WORDS } from "@/data/learnWords"
import { protoFor } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useLearnHydrated } from "@/hooks/useLearnHydrated"
import { useNotificationItems } from "@/hooks/useNotificationItems"
import { useOpenProfileSheet } from "@/components/nav-v2/useOpenProfileSheet"
import { INDEX_SUMMARY, LEARN_SUGGESTED_NUMBERS, MOCKUP_LEARN, learnSongTitle } from "@/lib/fixtures/learn"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { memberProfileName } from "@/lib/displayName"
import {
  HUB_LINKS,
  buildContinue,
  buildShelf,
  quizSubtitle,
  quizTarget,
  statsLine,
  wordCardsSubtitle,
} from "@/lib/learn/hub"
import { buildLibraryRows, libraryCounts } from "@/lib/learn/library"
import { nextOpenQuizLevel } from "@/lib/learn/progress"
import { indexHref, wordsHref } from "@/lib/learn/routes"
import { dueCardCount, wordsLearnedCount } from "@/lib/learn/srs"
import { sessionDeck, songNumbersFromIds, wordOfTheDay } from "@/lib/learn/words"
import { useAuthStore } from "@/stores/authStore"
import { useLearnStore } from "@/stores/learnStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

const EXPLANATION = "Learn songs word by word, understand them, and play along."

/**
 * Learn tab, as one hub that says what it is for: continue a song, a shelf of songs with
 * three steps each, today's practice, play along, and explore. It replaces the Practice /
 * My songs / Tools switch. The old "My songs" list is now the "See all" screen (/learn/songs).
 */
export default function LearnScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const top = useLearnTopInset()
  const hydrated = useLearnHydrated()
  const openProfile = useOpenProfileSheet()
  const { unread } = useNotificationItems()
  const now = useMemo(() => Date.now(), [])

  const mode = useAuthStore((s) => s.mode)
  const email = useAuthStore((s) => s.email)
  const displayName = useAuthStore((s) => s.displayName)
  const displayNameOverridden = useAuthStore((s) => s.displayNameOverridden)
  const initial = MOCKUP_DATA
    ? MOCKUP_LEARN.initial
    : memberProfileName({ mode, email, displayName, displayNameOverridden }).trim().charAt(0).toUpperCase() || "D"

  const cards = useLearnStore((s) => s.cards)
  const songs = useLearnStore((s) => s.songs)
  const paths = useLearnStore((s) => s.paths)
  const quizBest = useLearnStore((s) => s.quizBest)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)

  const go = (path: string) => router.push(href(path))

  const counts = useMemo(
    () => libraryCounts(buildLibraryRows({ songs, paths, cards, words: SAMPLE_LEARN_WORDS, now, mockup: MOCKUP_DATA })),
    [songs, paths, cards, now],
  )
  const words = wordsLearnedCount(cards)
  const due = dueCardCount(cards, now)
  const hasCards = Object.keys(cards).length > 0
  const quizLevel = nextOpenQuizLevel(quizBest)

  const continueModel = useMemo(() => buildContinue(songs, paths, LEARN_SUGGESTED_NUMBERS, learnSongTitle), [songs, paths])
  const shelf = useMemo(() => buildShelf(songs, paths, LEARN_SUGGESTED_NUMBERS, learnSongTitle), [songs, paths])

  const deck = useMemo(
    () => sessionDeck(SAMPLE_LEARN_WORDS, [...songs.map((song) => song.number), ...songNumbersFromIds(savedSongIds)]),
    [songs, savedSongIds],
  )
  const wordOfDay = useMemo(
    () =>
      MOCKUP_DATA
        ? (SAMPLE_LEARN_WORDS.find((word) => word.roman === MOCKUP_LEARN.wordOfDay) ?? null)
        : wordOfTheDay(deck.filter((word) => word.roman.length > 3), new Date(now)),
    [deck, now],
  )

  const nothingYet = counts.total === 0 && words === 0
  const stats = statsLine(counts.learned, counts.learning, words)
  const statsParts = [
    { value: String(counts.learned), rest: counts.learned === 1 ? " song learned" : " songs learned" },
    { value: String(counts.learning), rest: " learning" },
    { value: String(words), rest: words === 1 ? " word" : " words" },
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
        contentContainerStyle={[styles.content, { paddingTop: top }]}
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
            explanation={EXPLANATION}
            stats={nothingYet ? "Nothing learned yet" : stats}
            statsParts={nothingYet ? [{ value: "0", rest: " songs learned" }, { value: "0", rest: " words" }] : statsParts}
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
              <HubSectionHead p={p} eyebrow="Three steps each" first="Learn" second="a song" />
              {shelf.length > 0 || counts.total > 0 ? (
                <HubShelf>
                  {shelf.map((entry) => (
                    <SongShelfCard key={entry.songId} p={p} entry={entry} onPress={() => go(`/learn/song/${entry.songId}`)} />
                  ))}
                  <SeeAllCard p={p} count={counts.total} onPress={() => go(HUB_LINKS.allSongs)} />
                </HubShelf>
              ) : (
                <HubEmpty p={p} text="Songs you start to learn appear here. Open any song and tap Learn this song." />
              )}
            </Reveal>

            <Reveal index={4} style={styles.section}>
              <HubSectionHead p={p} eyebrow="Keep it fresh" first="Practice" second="today" />
              <View style={styles.pad}>
                <View style={styles.tiles}>
                  <HubTile
                    p={p}
                    icon={<Layers size={22} color={iconColor} strokeWidth={1.9} />}
                    title="Word cards"
                    subtitle={wordCardsSubtitle(due, hasCards)}
                    emphasis={due > 0}
                    onPress={() => go(HUB_LINKS.wordCards)}
                  />
                  <HubTile
                    p={p}
                    icon={<CircleQuestionMark size={22} color={iconColor} strokeWidth={1.9} />}
                    title="Quiz"
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
              </View>
            </Reveal>

            <Reveal index={5} style={styles.section}>
              <HubSectionHead p={p} eyebrow="With the songs" first="Play" second="along" />
              <View style={[styles.pad, styles.tiles]}>
                <HubTile
                  p={p}
                  icon={<Piano size={22} color={iconColor} strokeWidth={1.9} />}
                  title="Harmonium"
                  subtitle="Find the swaras on the keys"
                  onPress={() => go(HUB_LINKS.harmonium)}
                />
                <HubTile
                  p={p}
                  icon={<Guitar size={22} color={iconColor} strokeWidth={1.9} />}
                  title="Chords"
                  subtitle="How chords work"
                  onPress={() => go(HUB_LINKS.chords)}
                />
              </View>
            </Reveal>

            <Reveal index={6} style={styles.section}>
              <HubSectionHead p={p} eyebrow="Go deeper" first="Explore" second="more" />
              <View style={[styles.pad, styles.rows]}>
                <ExploreRow p={p} title="Stories behind the songs" onPress={() => go(HUB_LINKS.stories)} />
                <ExploreRow
                  p={p}
                  title="Raga and tala index"
                  subtitle={`${INDEX_SUMMARY.ragas} ragas · ${INDEX_SUMMARY.talas} talas`}
                  onPress={() => go(indexHref("tala"))}
                />
                <ExploreRow p={p} title="Certificates" subtitle="Live quiz · none yet" onPress={() => go(HUB_LINKS.certificates)} />
              </View>
            </Reveal>
          </>
        )}
      </ScrollView>
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
