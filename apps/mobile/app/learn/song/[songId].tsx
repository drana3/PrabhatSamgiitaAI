import { useEffect, useRef } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { EmptyCard } from "@/components/learn-v2/LearnBlocks"
import { CardText, CardTitle, NavRow, OverlayScreen, Over, Pill, Track, lcardPalette, toneOf } from "@/components/learn-v2/ui"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useLearnHydrated } from "@/hooks/useLearnHydrated"
import { learnSongTitle } from "@/lib/fixtures/learn"
import { EMPTY_PATH, type PathPart } from "@/lib/learn/progress"
import { LEARN_ROUTES } from "@/lib/learn/routes"
import {
  PATH_STEPS,
  pathFraction,
  pathLinks,
  pathProgressLabel,
  songNumberFromId,
  stepCta,
  stepOver,
} from "@/lib/learn/songPath"
import { SONG_QUIZ_LENGTH, songFactsFor, songQuizPassMark } from "@/lib/learn/songQuiz"
import { songStatus, songSteps, type SongStepView } from "@/lib/learn/songStatus"
import { learnWordList } from "@/lib/learn/verified"
import { useSongsWithChords } from "@/hooks/useSongsWithChords"
import { resolveSongBundle } from "@/lib/songs"
import { useLearnStore } from "@/stores/learnStore"
import { usePlayerStore } from "@/stores/playerStore"
import { useSongPageStore } from "@/stores/songPageStore"
import { useT } from "@/lib/i18n"
import { href } from "@/utils/href"

/** Where "Hear it and sing it" lands: the Player tab of the redesigned shell. */
const PLAYER_ROUTE = "/player-v2"
/** The prototype plays the song at three quarters of its speed. */
const SING_ALONG_RATE = 0.75

/**
 * Learn a song (variant A, Dada 10 November 2026): the song, a Listen button at the top (not a step), a
 * progress bar over the two steps that count, and three step cards: Words, Quiz, Chords. The song is
 * Learned when Words and Quiz are done. Chords are an extra: with no accepted chords the card is grey
 * ("No chords yet") and in nobody's way. A step that cannot start yet (no checked words, too few words
 * for a quiz) says so honestly. Every step can be repeated.
 */
export default function LearnSongScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useAmTheme()
  const tone = toneOf(theme)
  const params = useLocalSearchParams<{ songId?: string | string[] }>()
  const rawId = (Array.isArray(params.songId) ? params.songId[0] : params.songId) ?? ""
  // /learn/song/1 and /learn/song/ps-1 are the same song
  const songId = /^\d+$/.test(rawId) ? `ps-${rawId}` : rawId
  const number = songNumberFromId(songId)
  const hydrated = useLearnHydrated()

  const songs = useLearnStore((s) => s.songs)
  const path = useLearnStore((s) => s.paths[songId]) ?? EMPTY_PATH
  const chordSongs = useSongsWithChords()
  const startLearning = useLearnStore((s) => s.startLearning)
  const markPart = useLearnStore((s) => s.markPart)

  const listed = songs.find((song) => song.songId === songId)
  const title = listed?.title ?? (number !== null ? learnSongTitle(number) : "")
  const entered = useRef(false)
  const previousRate = useRef<number | null>(null)
  useEffect(
    () => () => {
      const player = usePlayerStore.getState()
      if (previousRate.current !== null && player.rate === SING_ALONG_RATE) player.setRate(previousRate.current)
    },
    [],
  )

  // opening the path puts the song on the learning list, like the prototype's "Start"
  useEffect(() => {
    if (!hydrated || number === null || listed || entered.current) return
    entered.current = true
    startLearning({ songId, number, title })
  }, [hydrated, number, listed, songId, title, startLearning])

  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href(LEARN_ROUTES.learn))
  }
  const go = (target: string) => router.push(href(target))

  if (number === null) {
    return (
      <OverlayScreen theme={theme} onBack={back} label={t("learn.song.screen")}>
        <EmptyCard
          theme={theme}
          eyebrow={t("learn.song.screen")}
          title={t("learn.song.notFound.title")}
          text={t("learn.song.notFound.text")}
          action={t("learn.song.backToLearn")}
          onAction={back}
        />
      </OverlayScreen>
    )
  }

  const links = pathLinks(songId, number)

  const mark = (part: PathPart) => markPart(songId, part)

  const listen = () => {
    mark("listen")
    // sing-along speed belongs to this lesson: it is put back when the lesson screen closes.
    // (The lyrics script is the person's own setting and is left alone.)
    const player = usePlayerStore.getState()
    if (previousRate.current === null) previousRate.current = player.rate
    player.setRate(SING_ALONG_RATE)
    void resolveSongBundle(songId)
      .then((bundle) => {
        if (bundle) usePlayerStore.getState().playOrToggle(bundle.song, [bundle.song.number])
      })
      .catch(() => undefined)
    go(PLAYER_ROUTE)
  }
  const words = () => go(links.words)
  const quiz = () => go(links.quiz)
  const chords = () => {
    mark("chords")
    useSongPageStore.getState().setChordsOn(true)
    go(links.listen)
  }
  const actions = [words, quiz, chords]
  const facts = songFactsFor(learnWordList(), number, chordSongs ? chordSongs.has(number) : null)
  const steps = songSteps(path, facts)
  const status = songStatus(path)
  const quizTotal = Math.min(SONG_QUIZ_LENGTH, facts.distinctMeanings)

  /** Text of a step card: its own, or the honest reason it cannot start yet. */
  const cardCopy = (view: SongStepView, i: number) => {
    const meta = PATH_STEPS[i]!
    switch (view.availability) {
      case "wordsSoon":
        return { title: t("learn.song.wordsSoon.title"), text: t("learn.song.wordsSoon.text"), note: null }
      case "quizSoon":
        return { title: t("learn.song.quizMore.title"), text: t("learn.song.quizWait.text"), note: null }
      case "needsMoreWords":
        return { title: t("learn.song.quizMore.title"), text: t("learn.song.quizMore.text", { count: facts.distinctMeanings }), note: null }
      case "noChords":
        return { title: t("learn.song.noChords.title"), text: t("learn.song.noChords.text"), note: null }
      default: {
        const note =
          view.key === "words"
            ? t("learn.song.s1.count", { count: facts.wordCount })
            : view.key === "quiz"
              ? t("learn.song.s2.count", { total: quizTotal, pass: songQuizPassMark(quizTotal) })
              : null
        return { title: meta.title, text: meta.text, note }
      }
    }
  }

  return (
    <OverlayScreen theme={theme} onBack={back} label={t("learn.song.screen")}>
      <Reveal index={0} style={styles.head}>
        <Over color={theme.eyebrow} numeric>{`PS ${number}`}</Over>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.textHeading }]}>
          {title}
        </Text>
        <View style={styles.actions}>
          <Pill theme={theme} label={t("learn.song.listen")} onPress={listen} />
          <Pill theme={theme} variant="sand" label={t("learn.song.openSong")} onPress={() => go(links.listen)} />
        </View>
      </Reveal>
      <Reveal index={1} style={styles.progress}>
        <Track theme={theme} value={pathFraction(path)} />
        <Over color={theme.eyebrow} numeric>
          {pathProgressLabel(path)}
        </Over>
        <Text accessibilityLabel={t("learn.song.status.a11y", { status: t(`learn.page.counter.${status}`) })} style={[styles.note, { color: theme.textBody }]}>
          {status === "learned" ? t("learn.song.learnedNote") : t("learn.song.countsNote")}
        </Text>
      </Reveal>
      {steps.map((view, i) => {
        const meta = PATH_STEPS[i]!
        const copy = cardCopy(view, i)
        const c = lcardPalette("white", theme)
        const grey = view.blocked
        return (
          <Reveal key={view.key} index={2 + i}>
            <View
              style={[
                styles.step,
                {
                  backgroundColor: grey
                    ? tone.dark ? "rgba(255,255,255,0.06)" : amColors.sand300
                    : view.done ? (tone.dark ? "rgba(245,194,83,0.12)" : amColors.sage200) : c.bg,
                  borderColor: grey ? "transparent" : view.done ? (tone.dark ? "rgba(245,194,83,0.4)" : "transparent") : (c.border ?? "transparent"),
                },
              ]}
            >
              <Over color={grey ? theme.textBody : c.over} numeric>
                {view.availability === "noChords" ? t("learn.song.extraOnly") : stepOver(meta.step, view.done)}
              </Over>
              <CardTitle color={grey ? theme.textBody : c.text}>{copy.title}</CardTitle>
              <CardText wide color={grey ? theme.textBody : c.body}>{copy.text}</CardText>
              {copy.note ? (
                <CardText wide bold color={c.body}>
                  {copy.note}
                </CardText>
              ) : null}
              {grey ? null : <Pill theme={theme} go label={stepCta(meta.step, path)} onPress={actions[i]!} />}
            </View>
          </Reveal>
        )
      })}
      <Reveal index={5}>
        <NavRow
          theme={theme}
          eyebrow={t("learn.song.harmonium.eyebrow")}
          title={t("learn.song.harmonium.title")}
          onPress={() => go(LEARN_ROUTES.harmoniumChords)}
        />
      </Reveal>
    </OverlayScreen>
  )
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 10, gap: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  note: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  title: { fontFamily: amFonts.display, fontSize: 36, lineHeight: 36, letterSpacing: -0.72, textTransform: "uppercase" },
  progress: { paddingHorizontal: 10, gap: 8 },
  step: { padding: 25, borderRadius: 30, borderWidth: 1, gap: 12, overflow: "hidden", width: "100%" },
})
