import { useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { GreenPanel } from "@/components/learn-v2/GreenPanel"
import { StepCard, TextAction } from "@/components/learn-v2/SongPathParts"
import { EmptyBlock } from "@/components/learn-v2/LearnBlocks"
import { Overline, PillButton, StepDots, SubHeader } from "@/components/learn-v2/ui"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amGap } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useLearnHydrated } from "@/hooks/useLearnHydrated"
import { EMPTY_PATH, isSongLearned, pathDots } from "@/lib/learn/progress"
import { LEARN_ROUTES, songPathHref } from "@/lib/learn/routes"
import {
  nextSongToLearn,
  PATH_STEPS,
  pathHeadline,
  pathLinks,
  songNumberFromId,
  stepOneNote,
  stepStatuses,
} from "@/lib/learn/songPath"
import { useLearnStore } from "@/stores/learnStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

/**
 * Learn a song (spec SCR-21): three steps, one card each.
 * 1 Listen and word cards, 2 short quiz on the meaning, 3 chords and playing on the keyboard.
 * Steps after the current one are locked until the learner taps "Skip ahead".
 */
export default function LearnSongScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const params = useLocalSearchParams<{ songId?: string | string[] }>()
  const songId = (Array.isArray(params.songId) ? params.songId[0] : params.songId) ?? ""
  const number = songNumberFromId(songId)
  const hydrated = useLearnHydrated()

  const songs = useLearnStore((s) => s.songs)
  const paths = useLearnStore((s) => s.paths)
  const startLearning = useLearnStore((s) => s.startLearning)
  const markPart = useLearnStore((s) => s.markPart)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)

  const [skipAhead, setSkipAhead] = useState(false)

  const path = paths[songId] ?? EMPTY_PATH
  const onList = songs.some((song) => song.songId === songId)
  const title = songs.find((song) => song.songId === songId)?.title
  const statuses = useMemo(() => stepStatuses(path, skipAhead), [path, skipAhead])
  const learned = isSongLearned(path)
  const nextId = useMemo(() => nextSongToLearn(savedSongIds, paths, songId), [savedSongIds, paths, songId])

  const go = (target: string) => router.push(href(target))
  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href(LEARN_ROUTES.learn))
  }

  if (number === null) {
    return (
      <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
        <View style={[styles.content, { paddingHorizontal: amGap.gutter }]}>
          <SubHeader theme={theme} title="LEARN A SONG" onBack={back} />
          <EmptyBlock
            theme={theme}
            title="Song not found"
            text="This link does not point to a song."
            actionLabel="Back to Learn"
            onAction={back}
          />
        </View>
      </SafeAreaView>
    )
  }

  const links = pathLinks(songId, number)
  const displayTitle = title ?? `Song ${number}`

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: amGap.gutter }]}
      >
        <SubHeader theme={theme} title="LEARN A SONG" onBack={back} />

        {!hydrated ? (
          <Text style={[amType.body, { color: theme.textBody }]}>Loading your progress…</Text>
        ) : (
          <>
            <Reveal index={0} style={styles.stack}>
              <Overline color={theme.eyebrow}>{`PS ${number} · ${pathHeadline(path).toUpperCase()}`}</Overline>
              <Text style={[styles.title, { color: theme.textHeading }]}>{displayTitle}</Text>
              <StepDots done={pathDots(path)} onColor={theme.brand} offColor={theme.line} />
              {!onList ? (
                <PillButton
                  theme={theme}
                  label="Add to my learning list"
                  variant="sand"
                  onPress={() => startLearning({ songId, number, title: displayTitle })}
                />
              ) : null}
            </Reveal>

            {learned ? (
              <Reveal index={1}>
                <GreenPanel>
                  <Text style={styles.learnedTitle}>SONG LEARNED</Text>
                  <Text style={styles.learnedText}>You listened, learned the words, checked the meaning and played it.</Text>
                  {nextId ? (
                    <PillButton
                      theme={theme}
                      label={`Learn PS ${songNumberFromId(nextId)} next`}
                      variant="light"
                      onPress={() => router.replace(href(songPathHref(nextId)))}
                    />
                  ) : null}
                  <PillButton theme={theme} label="Back to Learn" variant={nextId ? "dark" : "light"} onPress={back} />
                </GreenPanel>
              </Reveal>
            ) : null}

            <Reveal index={2} style={styles.stack}>
              {PATH_STEPS.map(({ step, title: stepTitle, text }, index) => {
                const status = statuses[index]!
                return (
                  <StepCard
                    key={step}
                    theme={theme}
                    step={step}
                    title={stepTitle}
                    text={text}
                    status={status}
                    note={step === 1 ? stepOneNote(path) : undefined}
                    lockedNote={step === 2 ? "Finish step 1 first." : "Finish step 2 first."}
                  >
                    {step === 1 ? (
                      <>
                        <PillButton
                          theme={theme}
                          label="Listen to the song"
                          variant={path.listen ? "sand" : "brand"}
                          onPress={() => {
                            markPart(songId, "listen")
                            go(links.listen)
                          }}
                        />
                        <PillButton
                          theme={theme}
                          label="Word cards"
                          variant={path.listen && !path.words ? "brand" : "sand"}
                          onPress={() => go(links.words)}
                        />
                        {status === "current" && !skipAhead ? (
                          <TextAction theme={theme} label="Skip ahead" onPress={() => setSkipAhead(true)} />
                        ) : null}
                      </>
                    ) : null}
                    {step === 2 ? (
                      <PillButton
                        theme={theme}
                        label={path.meaning ? "Take the quiz again" : "Start the quiz"}
                        variant={path.meaning ? "sand" : "brand"}
                        onPress={() => go(links.quiz)}
                      />
                    ) : null}
                    {step === 3 ? (
                      <>
                        <PillButton theme={theme} label="See the chords" variant="sand" onPress={() => go(links.chords)} />
                        <PillButton theme={theme} label="Open the keyboard" variant="sand" onPress={() => go(links.harmonium)} />
                        {!path.chords ? (
                          <PillButton theme={theme} label="I can play it" onPress={() => markPart(songId, "chords")} />
                        ) : null}
                      </>
                    ) : null}
                  </StepCard>
                )
              })}
            </Reveal>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 96, gap: amGap.block },
  stack: { gap: amGap.grid },
  title: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 30, letterSpacing: -0.6, textTransform: "uppercase" },
  learnedTitle: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 30, color: amColors.white },
  learnedText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, color: amColors.sage300, marginBottom: 8 },
})
