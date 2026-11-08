import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { StyleSheet, View, type LayoutChangeEvent } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import Animated, { useAnimatedRef } from "react-native-reanimated"

import { useSpTheme } from "@/hooks/useSpTheme"
import type { SpTheme } from "@/constants/tokens/amSong"
import { routeString } from "@/lib/songMap"
import { songRouteNumber } from "@/lib/songPage/songRoute"
import { usePageT } from "@/lib/songPage/pageCopy"
import { STRIP_HEIGHT, activeSectionAt, jumpOffset, menuSections, sectionTops, visibleTabs, type PageSection, type TabSection } from "@/lib/songPage/pageSections"

import { AboutSection } from "./About"
import { useSongVideos } from "@/components/recording-extras/SongVideos"
import { CommentsSection } from "./Comments"
import { ChordsSection } from "./Chords"
import { Actions, FadeHero, fadeHeight, songTitle } from "./Hero"
import { LearnButton } from "./LearnButton"
import { PronunciationRow } from "./Pronunciation"
import { PageSheets } from "./Sheets"
import { Shell, ShellMessage, useBarHeight } from "./Shell"
import { usePageUi } from "./state"
import { TextBlock } from "./TextBlock"
import { SectionTabs } from "./ui"
import type { PagerController } from "./usePager"
import type { SongPageModel } from "./useSongPageModel"
import { useSongPageModel } from "./useSongPageModel"
import { RecordingsSection, StorySection, VideoSection } from "./Watch"

/** The room the Learn button adds under the title, for the height the compact bar waits for. */
const LEARN_ROW = 64
/** The air above the text block inside its place in the scroll (the first section's top padding). */
const FIRST_PAD = 24

/**
 * The song page: one scrolling page. A photo that fades into the page, the title, "Learn this song", the action row;
 * a pinned tab strip; then the text block (Lyrics | Translation | Word by word, three pages of one block that turn
 * sideways and scroll with the page), Recordings, Chords, Video, Story and Song information, in that order, each drawn
 * only when the song has it (the text block and Chords always have a place and say honestly when empty). The tabs and
 * the top Menu jump to a section; the strip follows the scroll.
 */
export function SongPage() {
  const params = useLocalSearchParams<{ songId: string | string[] }>()
  const songId = routeString(params.songId)
  const router = useRouter()
  const t = useSpTheme()
  const onBack = () => (router.canGoBack() ? router.back() : router.replace("/"))
  // a number the catalogue does not have (0, 5019, "abc") is a not-found page with a way back, not a made-up song
  if (songRouteNumber(songId) === null) return <ShellMessage t={t} loading={false} missing onBack={onBack} />
  return <SongPageOf songId={songId} t={t} onBack={onBack} />
}

function SongPageOf({ songId, t, onBack }: { songId: string | undefined; t: SpTheme; onBack: () => void }) {
  const model = useSongPageModel(songId)
  if (!model.song) return <ShellMessage t={t} loading={model.loading} onBack={onBack} />
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
  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  // "somebody replied to your comment" opens this page with `?comment=`: the comments are the end of the page, so go there
  const { comment: openedFromReply } = useLocalSearchParams<{ comment?: string | string[] }>()
  useEffect(() => {
    if (typeof openedFromReply !== "string" || !openedFromReply) return
    const toEnd = () => (scrollRef.current as unknown as { scrollToEnd?: (o: { animated: boolean }) => void } | null)?.scrollToEnd?.({ animated: true })
    const timers = [setTimeout(toEnd, 700), setTimeout(toEnd, 1800)]
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedFromReply])
  // the text block's remote: a jump to Lyrics turns its pages back to the lyrics
  const pages = useRef<PagerController | null>(null)

  // a section's place is the hero plus the strip plus the heights above it (the web does not report a move)
  const topOf = useCallback((id: PageSection) => sectionTops(sections, heights.current, heroH.current + STRIP_HEIGHT)[id] ?? 0, [sections])
  const place = (id: PageSection) => (event: LayoutChangeEvent) => {
    heights.current[id] = event.nativeEvent.layout.height
  }
  const jump = useCallback(
    (id: PageSection) => {
      ui.closeOptions()
      if (id !== "about") setActive(id)
      if (id === "lyrics") pages.current?.goTo(0)
      const y = jumpOffset(topOf(id), bar)
      ;(scrollRef.current as unknown as { scrollTo: (o: { y: number; animated: boolean }) => void } | null)?.scrollTo({ y, animated: true })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topOf, bar, ui.closeOptions],
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
  const songVideos = useSongVideos(t, model.song?.number, model.showToast)
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
      sheets={
        <>
          <PageSheets t={t} model={model} ui={ui} sections={sections} onJump={jump} />
          {songVideos.sheet}
        </>
      }
    >
      <View onLayout={place("lyrics")} style={styles.first}>
        <TextBlock t={t} model={model} ui={ui} controller={pages} />
      </View>
      {show.has("recordings") ? (
        <View onLayout={place("recordings")} style={styles.section}>
          {divider}
          <RecordingsSection t={t} model={model} />
          {songVideos.section ? <View style={styles.videos}>{songVideos.section}</View> : null}
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
        <PronunciationRow t={t} ui={ui} last />
      </View>
      {/* members' comments close the page; not a tab, so the strip and the jump math do not know it */}
      {/* members' video links sit under the Recordings; a song without that section gets them here, before the comments */}
      {!show.has("recordings") && songVideos.section ? (
        <View style={styles.section}>
          {divider}
          {songVideos.section}
        </View>
      ) : null}
      <View style={styles.section}>
        {divider}
        <CommentsSection t={t} model={model} />
      </View>
    </Shell>
  )
}

const styles = StyleSheet.create({
  videos: { paddingTop: 32 },
  first: { paddingTop: FIRST_PAD },
  section: { paddingTop: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 20, marginBottom: 28, marginTop: 32 },
})
