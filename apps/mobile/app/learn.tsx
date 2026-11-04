import { useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { LearnLogo, LibraryRow, StatsStrip, type LibraryRowData } from "@/components/learn-v2/LearnBlocks"
import {
  CardText,
  CardTitle,
  Chip,
  LCard,
  LearnHead,
  NavRow,
  Over,
  PageHeading,
  Pill,
  Segmented,
  Track,
  useLearnTopInset,
} from "@/components/learn-v2/ui"
import { useOpenProfileSheet } from "@/components/nav-v2/useOpenProfileSheet"
import { Reveal } from "@/components/today/motion"
import { SAMPLE_LEARN_WORDS } from "@/data/learnWords"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useLearnHydrated } from "@/hooks/useLearnHydrated"
import { demoLibraryEntry, INDEX_SUMMARY } from "@/lib/fixtures/learn"
import { memberProfileName } from "@/lib/displayName"
import {
  learnProgress,
  nextOpenQuizLevel,
  pathDots,
  pathDoneCount,
  practiceSummary,
  progressLine,
  songsWithDueWords,
} from "@/lib/learn/progress"
import { LEARN_ROUTES, indexHref, quizHref, songHref, songPathHref, wordsHref } from "@/lib/learn/routes"
import { nextStepNote } from "@/lib/learn/songPath"
import { describeNextDue, dueCardCount, nextDueAt } from "@/lib/learn/srs"
import { sessionDeck, songNumbersFromIds, wordOfTheDay, wordsForSong } from "@/lib/learn/words"
import { useAuthStore } from "@/stores/authStore"
import { useLearnStore } from "@/stores/learnStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

type Tab = "practice" | "library" | "tools"
type Filter = "all" | "due" | "learning" | "learned"

const TABS = [
  { key: "practice", label: "Practice" },
  { key: "library", label: "My songs" },
  { key: "tools", label: "Tools" },
] as const

const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "due", label: "Due" },
  { key: "learning", label: "Learning" },
  { key: "learned", label: "Learned" },
]

/** Songs in the level 1 curriculum. TODO(api): comes with the quiz bank. */
const LEVEL_SONG_TOTAL = 10

/**
 * Learn tab. The prototype's default layout is option B (`lv: 'b'` in Main.dc.html):
 * a two-tone heading, a Practice / My songs / Tools switch and one stats strip.
 * The prototype's other layouts (Current, A, C) are reachable there only through a
 * "Mockup only" chooser, so they are not part of the app.
 */
export default function LearnScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const top = useLearnTopInset()
  const hydrated = useLearnHydrated()
  const openProfile = useOpenProfileSheet()
  const now = useMemo(() => Date.now(), [])

  const mode = useAuthStore((s) => s.mode)
  const email = useAuthStore((s) => s.email)
  const displayName = useAuthStore((s) => s.displayName)
  const displayNameOverridden = useAuthStore((s) => s.displayNameOverridden)
  const initials =
    memberProfileName({ mode, email, displayName, displayNameOverridden }).trim().charAt(0).toUpperCase() || "D"

  const cards = useLearnStore((s) => s.cards)
  const songs = useLearnStore((s) => s.songs)
  const paths = useLearnStore((s) => s.paths)
  const quizBest = useLearnStore((s) => s.quizBest)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)

  const [tab, setTab] = useState<Tab>("practice")
  const [filter, setFilter] = useState<Filter>("all")

  const go = (path: string) => router.push(href(path))

  const rows = useMemo(() => {
    const dueBySong = songsWithDueWords(SAMPLE_LEARN_WORDS, cards, now)
    return songs.map((song): LibraryRowData => {
      const path = paths[song.songId]
      const learned = pathDoneCount(path) === 3
      const demo = demoLibraryEntry(song.number)
      const due = learned && Boolean(demo?.due || dueBySong.has(song.number))
      let note: string
      if (!learned) note = nextStepNote(path)
      else if (demo?.next) note = demo.next
      else if (due) note = "Review due today"
      else {
        const nextWord = nextDueAt(
          Object.fromEntries(wordsForSong(SAMPLE_LEARN_WORDS, song.number).flatMap((w) => (cards[w.id] ? [[w.id, cards[w.id]!]] : []))),
          now,
        )
        note = nextWord ? describeNextDue(nextWord, now).replace("Next card", "Next review") : "All three steps done"
      }
      return {
        number: song.number,
        title: song.title,
        learned,
        due,
        strength: demo?.strength ?? 3,
        steps: pathDots(path),
        note,
      }
    })
  }, [songs, paths, cards, now])

  const shown = useMemo(
    () =>
      rows.filter((row) => {
        if (filter === "due") return row.due
        if (filter === "learning") return !row.learned
        if (filter === "learned") return row.learned
        return true
      }),
    [rows, filter],
  )

  const learnedCount = rows.filter((row) => row.learned).length
  const learningCount = rows.length - learnedCount
  const progressBase = useMemo(() => learnProgress(songs, paths, cards), [songs, paths, cards])
  const levelTotal = Math.max(LEVEL_SONG_TOTAL, songs.length)
  const progress = { ...progressBase, total: levelTotal, fraction: progressBase.studied / levelTotal }
  const dueSongCount = rows.filter((row) => row.due).length
  const summary = practiceSummary(dueCardCount(cards, now), dueSongCount)
  const quizLevel = nextOpenQuizLevel(quizBest)
  const levelOver = `Level ${quizLevel} · ${quizLevel === 1 ? "Know the words" : quizLevel === 2 ? "Know the meaning" : "Know the story"}`

  const deck = useMemo(
    () => sessionDeck(SAMPLE_LEARN_WORDS, [...songs.map((song) => song.number), ...songNumbersFromIds(savedSongIds)]),
    [songs, savedSongIds],
  )
  const wordOfDay = useMemo(() => wordOfTheDay(deck, new Date(now)), [deck, now])

  const openFirstSong = () => go(songHref(songs[0]?.songId ?? "ps-1"))

  const openRow = (row: LibraryRowData) => go(songHref(`ps-${row.number}`))
  const rowCta = (row: LibraryRowData) =>
    row.learned ? go(wordsHref()) : go(songPathHref(`ps-${row.number}`))

  return (
    <View style={[styles.flex, { backgroundColor: theme.page }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: top, paddingBottom: 190 }}
      >
        <Reveal index={0}>
          <LearnHead theme={theme} initials={initials} onAvatar={openProfile} logo={<LearnLogo />} />
        </Reveal>
        <Reveal index={1}>
          <PageHeading theme={theme} first="Learn" second="practise and play" />
        </Reveal>
        <Reveal index={2} style={styles.pad}>
          <Segmented theme={theme} options={TABS} value={tab} onChange={(key) => setTab(key as Tab)} />
        </Reveal>
        <Reveal index={3} style={styles.pad}>
          <StatsStrip theme={theme} learned={learnedCount} total={rows.length} learning={learningCount} words={progress.wordsLearned} />
        </Reveal>

        {!hydrated ? null : tab === "practice" ? (
          <Reveal key="practice" index={3} style={[styles.list, { marginTop: 16 }]}>
            <LCard theme={theme} tone="prg">
              {(c) => (
                <>
                  <Over color={c.over}>Today's practice</Over>
                  <CardTitle color={c.text} size={28}>
                    {summary.headline.replace(" to repeat", "\nto repeat")}
                  </CardTitle>
                  <CardText color={c.body}>{summary.detail}</CardText>
                  <Pill theme={theme} go arrow label="Start practice" onPress={() => go(wordsHref())} />
                </>
              )}
            </LCard>
            <LCard theme={theme} tone="green">
              {(c) => (
                <>
                  <Over color={c.over}>{levelOver}</Over>
                  <Track theme={theme} value={progress.fraction} />
                  <CardText color={c.body}>{progressLine(progress)}</CardText>
                  <Pill theme={theme} label={`Take the level ${quizLevel} quiz`} onPress={() => go(quizHref({ level: quizLevel }))} />
                </>
              )}
            </LCard>
            {wordOfDay ? (
              <LCard theme={theme} tone="peach">
                {(c) => (
                  <>
                    <Over color={c.over}>{`Word of the day · PS ${wordOfDay.songNumber}`}</Over>
                    <CardTitle color={c.text} size={36}>
                      {wordOfDay.roman}
                    </CardTitle>
                    <CardText color={c.body} bold>
                      {wordOfDay.meaning}
                    </CardText>
                  </>
                )}
              </LCard>
            ) : null}
          </Reveal>
        ) : tab === "library" ? (
          <Reveal key="library" index={3} style={{ marginTop: 6 }}>
            <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Show">
              {FILTERS.map((item) => (
                <Chip key={item.key} theme={theme} small green label={item.label} on={filter === item.key} onPress={() => setFilter(item.key)} />
              ))}
            </View>
            <View style={[styles.list, { marginTop: 6 }]}>
              {shown.map((row) => (
                <LibraryRow key={row.number} theme={theme} row={row} onOpen={() => openRow(row)} onCta={() => rowCta(row)} />
              ))}
              {shown.length === 0 ? (
                <Text style={[styles.empty, { color: theme.textBody }]}>
                  {rows.length === 0
                    ? "No songs yet. Open a song and tap Learn this song. Three steps: hear it, know what it means, play it."
                    : "You have nothing due. Words and songs come back here when it is time."}
                </Text>
              ) : null}
            </View>
          </Reveal>
        ) : (
          <Reveal key="tools" index={3} style={[styles.list, { marginTop: 16 }]}>
            <LCard theme={theme} tone="peach">
              {(c) => (
                <>
                  <Over color={c.over}>Harmonium</Over>
                  <CardTitle color={c.text}>{"Find the swaras\non the keys"}</CardTitle>
                  <Pill theme={theme} go label="Open keyboard" onPress={() => go(LEARN_ROUTES.harmonium)} />
                  <Pill
                    theme={theme}
                    go
                    variant="sand"
                    label="How chords work"
                    style={{ marginTop: 0 }}
                    onPress={() => go(LEARN_ROUTES.harmoniumChords)}
                  />
                </>
              )}
            </LCard>
            <LCard theme={theme} tone="white">
              {(c) => (
                <>
                  <Over color={c.over}>Guitar and harmonium</Over>
                  <CardTitle color={c.text}>{"Chords over\nthe words"}</CardTitle>
                  <Pill theme={theme} go label="Open a song" onPress={openFirstSong} />
                </>
              )}
            </LCard>
            <NavRow theme={theme} eyebrow="Stories" title="Stories behind the songs" onPress={() => go(LEARN_ROUTES.stories)} />
            <NavRow
              theme={theme}
              numericEyebrow
              eyebrow={`${INDEX_SUMMARY.ragas} ragas · ${INDEX_SUMMARY.talas} talas`}
              title="Raga and tala index"
              onPress={() => go(indexHref("tala"))}
            />
            <NavRow theme={theme} eyebrow="Quiz" title="Certificates · none yet" onPress={() => go(LEARN_ROUTES.liveQuiz)} />
          </Reveal>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: 10 },
  list: { gap: 10, paddingHorizontal: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 12, paddingBottom: 6, paddingHorizontal: 10 },
  empty: { fontFamily: "Roboto_500Medium", fontSize: 16, lineHeight: 23, paddingHorizontal: 20, maxWidth: 300 },
})
