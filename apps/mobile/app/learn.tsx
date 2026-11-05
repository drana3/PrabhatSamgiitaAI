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
import { useProfileInitial } from "@/hooks/useProfileInitial"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useLearnHydrated } from "@/hooks/useLearnHydrated"
import { useNotificationItems } from "@/hooks/useNotificationItems"
import { useOpenProfileSheet } from "@/components/nav-v2/useOpenProfileSheet"
import { INDEX_SUMMARY, LEARN_SUGGESTED_NUMBERS, MOCKUP_LEARN, learnSongTitle } from "@/lib/fixtures/learn"
import { MOCKUP_DATA } from "@/lib/mockupMode"
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
import { useLearnStore } from "@/stores/learnStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"

/**
 * Learn tab, as one hub that says what it is for: continue a song, a shelf of songs with
 * three steps each, today's practice, play along, and explore. It replaces the Practice /
 * My songs / Tools switch. The old "My songs" list is now the "See all" screen (/learn/songs).
 */
export default function LearnScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const top = useLearnTopInset()
  const hydrated = useLearnHydrated()
  const openProfile = useOpenProfileSheet()
  const { unread } = useNotificationItems()
  const now = useMemo(() => Date.now(), [])

  const initial = useProfileInitial()

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
              <HubSectionHead p={p} eyebrow={t("learn.sect.steps")} first={t("learn.sect.steps.first")} second={t("learn.sect.steps.second")} />
              {shelf.length > 0 || counts.total > 0 ? (
                <HubShelf>
                  {shelf.map((entry) => (
                    <SongShelfCard key={entry.songId} p={p} entry={entry} onPress={() => go(`/learn/song/${entry.songId}`)} />
                  ))}
                  <SeeAllCard p={p} count={counts.total} onPress={() => go(HUB_LINKS.allSongs)} />
                </HubShelf>
              ) : (
                <HubEmpty p={p} text={t("learn.empty.songs")} />
              )}
            </Reveal>

            <Reveal index={4} style={styles.section}>
              <HubSectionHead p={p} eyebrow={t("learn.sect.fresh")} first={t("learn.sect.fresh.first")} second={t("learn.sect.fresh.second")} />
              <View style={styles.pad}>
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
              </View>
            </Reveal>

            <Reveal index={5} style={styles.section}>
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

            <Reveal index={6} style={styles.section}>
              <HubSectionHead p={p} eyebrow={t("learn.sect.deeper")} first={t("learn.sect.deeper.first")} second={t("learn.sect.deeper.second")} />
              <View style={[styles.pad, styles.rows]}>
                <ExploreRow p={p} title={t("learn.stories")} onPress={() => go(HUB_LINKS.stories)} />
                {/* The raga and tala index is prototype content (invented song counts); the catalog has no raga data yet. */}
                {MOCKUP_DATA ? (
                  <ExploreRow
                    p={p}
                    title={t("learn.index")}
                    subtitle={t("learn.index.summary", { ragas: INDEX_SUMMARY.ragas, talas: INDEX_SUMMARY.talas })}
                    onPress={() => go(indexHref("tala"))}
                  />
                ) : null}
                {/* hidden for now, Dada 2026-11-05: <ExploreRow p={p} title="Certificates" subtitle="Live quiz · none yet" onPress={() => go(HUB_LINKS.certificates)} /> */}
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
