import { useCallback, useMemo, useRef, useState } from "react"
import { StyleSheet, View, type LayoutChangeEvent } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import type Animated from "react-native-reanimated"

import { useSpTheme } from "@/hooks/useSpTheme"
import type { SpTheme } from "@/constants/tokens/amSong"
import { routeString } from "@/lib/songMap"
import { usePageT } from "@/lib/songPage/pageCopy"
import { STRIP_HEIGHT, activeSectionAt, jumpOffset, menuSections, sectionTops, visibleTabs, type PageSection, type TabSection } from "@/lib/songPage/pageSections"

import { AboutSection } from "./About"
import { ChordsSection } from "./Chords"
import { Actions, FadeHero, fadeHeight, songTitle } from "./Hero"
import { LearnButton } from "./LearnButton"
import { LyricsSection } from "./Lyrics"
import { MeaningSection } from "./Meaning"
import { PageSheets } from "./Sheets"
import { Shell, ShellMessage, useBarHeight } from "./Shell"
import { usePageUi } from "./state"
import { SectionTabs } from "./ui"
import type { SongPageModel } from "./useSongPageModel"
import { useSongPageModel } from "./useSongPageModel"
import { RecordingsSection, StorySection, VideoSection } from "./Watch"

/** The room the Learn button adds under the title, for the height the compact bar waits for. */
const LEARN_ROW = 64

/**
 * The song page: one scrolling page. A photo that fades into the page, the title, "Learn this song", the action row;
 * a pinned tab strip; then Lyrics, Meaning, Recordings, Chords, Video, Story and About this song, in that order,
 * each drawn only when the song has it (Lyrics, Meaning and Chords always have a place and say honestly when empty).
 * The tabs and the top Menu jump to a section; the strip follows the scroll.
 */
export function SongPage() {
  const params = useLocalSearchParams<{ songId: string | string[] }>()
  const songId = routeString(params.songId)
  const router = useRouter()
  const t = useSpTheme()
  const model = useSongPageModel(songId)
  if (!model.song) return <ShellMessage t={t} loading={model.loading} onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
  return <LoadedSongPage t={t} model={model} />
}

function LoadedSongPage({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const tr = usePageT()
  const ui = usePageUi()
  const bar = useBarHeight()
  const tabs = useMemo(() => visibleTabs(model.facts), [model.facts])
  const sections = useMemo(() => menuSections(model.facts), [model.facts])
  const [active, setActive] = useState<TabSection>("lyrics")
  const heights = useRef<Record<string, number>>({})
  const heroH = useRef(0)
  const scrollRef = useRef<Animated.ScrollView | null>(null)

  // a section's place is the hero plus the strip plus the heights above it (the web does not report a move)
  const topOf = useCallback((id: PageSection) => sectionTops(sections, heights.current, heroH.current + STRIP_HEIGHT)[id] ?? 0, [sections])
  const place = (id: PageSection) => (event: LayoutChangeEvent) => {
    heights.current[id] = event.nativeEvent.layout.height
  }
  const jump = useCallback(
    (id: PageSection) => {
      if (id !== "about") setActive(id)
      const y = jumpOffset(topOf(id), bar)
      ;(scrollRef.current as unknown as { scrollTo: (o: { y: number; animated: boolean }) => void } | null)?.scrollTo({ y, animated: true })
    },
    [topOf, bar],
  )
  const follow = useCallback(
    (y: number) => {
      const current = activeSectionAt(tabs, heights.current, heroH.current + STRIP_HEIGHT, y, bar)
      if (current) setActive((prev) => (prev === current ? prev : current))
    },
    [tabs, bar],
  )

  const items = tabs.map((id) => ({ id, label: tr(`songPage.tab.${id}`) }))
  const show = new Set<PageSection>(sections)
  const divider = <View style={[styles.divider, { backgroundColor: t.sand400 }]} />

  return (
    <Shell
      t={t}
      model={model}
      title={songTitle(model)}
      top="photo"
      heroHeight={fadeHeight(bar) + LEARN_ROW}
      hero={
        <>
          <FadeHero t={t} model={model} />
          <LearnButton t={t} model={model} />
          <Actions t={t} model={model} />
        </>
      }
      strip={<SectionTabs t={t} items={items} active={active} onSelect={jump} />}
      stripHeight={STRIP_HEIGHT}
      scrollRef={scrollRef}
      onScrollJS={follow}
      onHeroHeight={(h) => {
        heroH.current = h
      }}
      onMore={() => model.setSheet("actions")}
      onMenu={() => ui.setSheet("menu")}
      sheets={<PageSheets t={t} model={model} ui={ui} sections={sections} onJump={jump} />}
    >
      <View onLayout={place("lyrics")} style={styles.first}>
        <LyricsSection t={t} model={model} ui={ui} />
      </View>
      <View onLayout={place("meaning")} style={styles.section}>
        {divider}
        <MeaningSection t={t} meaning={model.meaning} />
      </View>
      {show.has("recordings") ? (
        <View onLayout={place("recordings")} style={styles.section}>
          {divider}
          <RecordingsSection t={t} model={model} />
        </View>
      ) : null}
      <View onLayout={place("chords")} style={styles.section}>
        {divider}
        <ChordsSection t={t} model={model} ui={ui} />
      </View>
      {show.has("video") ? (
        <View onLayout={place("video")} style={styles.section}>
          {divider}
          <VideoSection t={t} model={model} />
        </View>
      ) : null}
      {show.has("story") ? (
        <View onLayout={place("story")} style={styles.section}>
          {divider}
          <StorySection t={t} model={model} />
        </View>
      ) : null}
      <View onLayout={place("about")} style={styles.section}>
        {divider}
        <AboutSection t={t} model={model} />
      </View>
    </Shell>
  )
}

const styles = StyleSheet.create({
  first: { paddingTop: 24 },
  section: { paddingTop: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 20, marginBottom: 28, marginTop: 32 },
})
