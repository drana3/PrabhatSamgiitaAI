import { useCallback, useEffect, useRef, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import Animated, { FadeIn, useAnimatedRef, useReducedMotion } from "react-native-reanimated"

import { useSongVideos } from "@/components/recording-extras/SongVideos"
import type { SpTheme } from "@/constants/tokens/amSong"
import { useSpTheme } from "@/hooks/useSpTheme"
import { routeString } from "@/lib/songMap"
import { songRouteNumber } from "@/lib/songPage/songRoute"
import { DEFAULT_TAB, TAB_STRIP_HEIGHT, scrollOnSelect, songTabFromParam, type SongTab } from "@/lib/songPage/songTabs"

import { ActionRow } from "./ActionRow"
import { PhotoCredit } from "./About"
import { CommentsSection } from "./Comments"
import { ChordsTab } from "./ChordsTab"
import { FadeHero, fadeHeight, songTitle } from "./Hero"
import { InfoTab } from "./InfoTab"
import { LearnButton } from "./LearnButton"
import { LyricsTab } from "./LyricsTab"
import { MeaningTab } from "./MeaningTab"
import { PageTabs } from "./PageTabs"
import { RecordingsRow } from "./Rows"
import { PageSheets } from "./Sheets"
import { Shell, ShellMessage, useBarHeight } from "./Shell"
import { usePageUi } from "./state"
import type { SongPageModel } from "./useSongPageModel"
import { useSongPageModel } from "./useSongPageModel"
import { VideoTab } from "./VideoTab"

/** What the rows under the title add to the photo, for the height the compact bar waits for (Learn, icons, recordings). */
const HERO_ROWS = 90

/**
 * The song page (decision of 10 November 2026, variant V1 with the photo header of V2): a photo that fades into the
 * page, the title and PS number, "Add to learning", the one row of icons (Saved, Download, Playlist, Share, More, Play),
 * the recordings row; then a pinned switch of five tabs in a fixed order, Lyrics, Meaning, Chords, Video, Info. Each tab
 * is its own screen under the switch. All text settings sit behind the one "Aa" button of Lyrics and Meaning. The members'
 * comments are one block under the content of every tab (scroll down on any tab and they are there), with the small photo
 * credit after them. `?tab=meaning` opens a tab directly; a reply to a comment opens the page scrolled to the comments.
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
  const ui = usePageUi()
  const bar = useBarHeight()
  const reduce = useReducedMotion()
  // "somebody replied to your comment" opens this page with `?comment=`: the comments end every tab, so scroll to the end
  const { comment: openedFromReply, tab: tabParam } = useLocalSearchParams<{ comment?: string | string[]; tab?: string | string[] }>()
  const fromReply = typeof openedFromReply === "string" && openedFromReply !== ""
  const wanted = songTabFromParam(tabParam)
  const [active, setActive] = useState<SongTab>(wanted ?? DEFAULT_TAB)
  const heroH = useRef(0)
  const scrollY = useRef(0)
  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  type Scroller = { scrollTo: (o: { y: number; animated: boolean }) => void; scrollToEnd?: (o: { animated: boolean }) => void }
  const scroller = () => scrollRef.current as unknown as Scroller | null

  useEffect(() => {
    if (!fromReply) return undefined
    const toEnd = () => scroller()?.scrollToEnd?.({ animated: true })
    const timers = [setTimeout(toEnd, 700), setTimeout(toEnd, 1800)]
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromReply])

  const select = useCallback(
    (tab: SongTab) => {
      ui.closeOptions()
      setActive(tab)
      // the tab's content starts right under the switch, and since the page is only as tall as the tab, the page goes back to that line
      const to = scrollOnSelect(scrollY.current, heroH.current - bar)
      if (to !== null) scroller()?.scrollTo({ y: to, animated: true })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bar, ui.closeOptions],
  )

  const songVideos = useSongVideos(t, model.song?.number, model.showToast, true)

  return (
    <Shell
      t={t}
      model={model}
      title={songTitle(model)}
      top="photo"
      heroHeight={fadeHeight(bar) + HERO_ROWS}
      hero={
        <>
          <FadeHero t={t} model={model} />
          <LearnButton t={t} model={model} />
          <ActionRow t={t} model={model} />
          <RecordingsRow t={t} model={model} />
        </>
      }
      strip={<PageTabs t={t} active={active} onSelect={select} />}
      stripHeight={TAB_STRIP_HEIGHT}
      scrollRef={scrollRef}
      onScrollJS={(y) => {
        scrollY.current = y
      }}
      onHeroHeight={(h) => {
        heroH.current = h
      }}
      onMore={() => model.setSheet("actions")}
      sheets={
        <>
          <PageSheets t={t} model={model} ui={ui} />
          {songVideos.sheet}
        </>
      }
    >
      {/* the tab is exactly as tall as what it holds: no minimum height, so the comments follow the text of the chosen tab */}
      <Animated.View key={active} entering={reduce ? undefined : FadeIn.duration(180)}>
        {active === "lyrics" ? <LyricsTab t={t} model={model} ui={ui} onOpenWords={() => select("meaning")} /> : null}
        {active === "meaning" ? <MeaningTab t={t} model={model} ui={ui} /> : null}
        {active === "chords" ? <ChordsTab t={t} model={model} ui={ui} /> : null}
        {active === "video" ? <VideoTab t={t} model={model} memberVideos={songVideos.section} /> : null}
        {active === "info" ? <InfoTab t={t} model={model} /> : null}
      </Animated.View>
      <CommentsSection t={t} model={model} />
      {model.photo ? (
        <View style={styles.credit}>
          <PhotoCredit t={t} model={model} />
        </View>
      ) : null}
    </Shell>
  )
}

const styles = StyleSheet.create({
  credit: { paddingHorizontal: 20, paddingBottom: 24 },
})
