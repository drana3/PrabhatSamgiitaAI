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
import { EMPTY_PATH, pathStepDone, type PathPart } from "@/lib/learn/progress"
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
import { resolveSongBundle } from "@/lib/songs"
import { useLearnStore } from "@/stores/learnStore"
import { usePlayerStore } from "@/stores/playerStore"
import { useSongPageStore } from "@/stores/songPageStore"
import { href } from "@/utils/href"

/** Where "Hear it and sing it" lands: the Player tab of the redesigned shell. */
const PLAYER_ROUTE = "/player-v2"
/** The prototype plays the song at three quarters of its speed. */
const SING_ALONG_RATE = 0.75

/**
 * Learn a song (prototype LEARN A SONG, SCR-21): the song, a progress bar, three step
 * cards (hear it, learn what it means, play it) and a link to how chords work on the
 * harmonium. Every step can be done in any order and repeated.
 */
export default function LearnSongScreen() {
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
  const startLearning = useLearnStore((s) => s.startLearning)
  const markPart = useLearnStore((s) => s.markPart)

  const listed = songs.find((song) => song.songId === songId)
  const title = listed?.title ?? (number !== null ? learnSongTitle(number) : "")
  const entered = useRef(false)

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
      <OverlayScreen theme={theme} onBack={back} label="Learn a song">
        <EmptyCard
          theme={theme}
          eyebrow="Learn a song"
          title="Song not found"
          text="This link does not point to a song."
          action="Back to Learn"
          onAction={back}
        />
      </OverlayScreen>
    )
  }

  const links = pathLinks(songId, number)

  const mark = (part: PathPart) => markPart(songId, part)

  const listen = () => {
    mark("listen")
    useSongPageStore.getState().setScript("roman")
    const player = usePlayerStore.getState()
    player.setRate(SING_ALONG_RATE)
    void resolveSongBundle(songId)
      .then((bundle) => {
        if (bundle) usePlayerStore.getState().playOrToggle(bundle.song, [bundle.song.number])
      })
      .catch(() => undefined)
    go(PLAYER_ROUTE)
  }
  const words = () => go(links.words)
  const chords = () => {
    mark("chords")
    useSongPageStore.getState().setChordsOn(true)
    go(links.listen)
  }
  const actions = [listen, words, chords]

  return (
    <OverlayScreen theme={theme} onBack={back} label="Learn a song">
      <Reveal index={0} style={styles.head}>
        <Over color={theme.eyebrow} numeric>{`PS ${number}`}</Over>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.textHeading }]}>
          {title}
        </Text>
      </Reveal>
      <Reveal index={1} style={styles.progress}>
        <Track theme={theme} value={pathFraction(path)} />
        <Over color={theme.eyebrow} numeric>
          {pathProgressLabel(path)}
        </Over>
      </Reveal>
      {PATH_STEPS.map((meta, i) => {
        const done = pathStepDone(path, meta.step)
        const c = lcardPalette("white", theme)
        return (
          <Reveal key={meta.step} index={2 + i}>
            <View
              style={[
                styles.step,
                {
                  backgroundColor: done ? (tone.dark ? "rgba(245,194,83,0.12)" : amColors.sage200) : c.bg,
                  borderColor: done ? (tone.dark ? "rgba(245,194,83,0.4)" : "transparent") : (c.border ?? "transparent"),
                },
              ]}
            >
              <Over color={c.over} numeric>
                {stepOver(meta.step, done)}
              </Over>
              <CardTitle color={c.text}>{meta.title}</CardTitle>
              <CardText wide color={c.body}>{meta.text}</CardText>
              <Pill theme={theme} go label={stepCta(meta.step, path)} onPress={actions[i]!} />
            </View>
          </Reveal>
        )
      })}
      <Reveal index={5}>
        <NavRow
          theme={theme}
          eyebrow="Playing harmonium?"
          title="How chords work on the harmonium"
          onPress={() => go(LEARN_ROUTES.harmoniumChords)}
        />
      </Reveal>
    </OverlayScreen>
  )
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 10, gap: 6 },
  title: { fontFamily: amFonts.display, fontSize: 36, lineHeight: 36, letterSpacing: -0.72, textTransform: "uppercase" },
  progress: { paddingHorizontal: 10, gap: 8 },
  step: { padding: 25, borderRadius: 30, borderWidth: 1, gap: 12, overflow: "hidden", width: "100%" },
})
