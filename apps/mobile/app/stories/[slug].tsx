import { useCallback, useMemo } from "react"
import { Platform, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated"

import { openExternal } from "@/lib/openLink"
import { SpPill, SpRound } from "@/components/song-v2/SpUi"
import { Press } from "@/components/songs-v2/Press"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { CheckGlyph, PhotoChip, ShareGlyph, StoryPicture, StoryRow, songLine } from "@/components/stories/StoryParts"
import { amPhotoChip, amScrimPhoto, amScrimPhotoTop } from "@/constants/tokens/amColors"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { minutesOf, useStories, useStory, useStorySongTitles } from "@/hooks/useStories"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { hasPlayableAudio } from "@/lib/playableAudio"
import { starterSongForNumber } from "@/lib/playPlaylist"
import { NAV_V2_PLAYER_ROUTE } from "@/lib/navV2"
import { bodyText, keepPsTogether, parseBody } from "@/lib/stories/body"
import { nextStory, sortStories } from "@/lib/stories/list"
import { isFinished, readingProgress } from "@/lib/stories/progress"
import { estimateReadMinutes, readTimeLabel } from "@/lib/stories/readTime"
import { storyShareMessage } from "@/lib/stories/share"
import { primarySong, type Story } from "@/lib/stories/types"
import { songHrefFor } from "@/lib/songsV2/storySheet"
import { usePlayerStore } from "@/stores/playerStore"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useStoriesStore } from "@/stores/storiesStore"
import { href } from "@/utils/href"

const HERO = 400
const BAR = 56
const MEASURE = 600

export default function StoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  // keyed by slug: "Next story" replaces the route and the page starts again from the top
  return <StoryReader key={String(slug)} slug={String(slug)} />
}

function StoryReader({ slug }: { slug: string }) {
  const router = useRouter()
  const theme = useSongsTheme()
  const sp = useSpTheme()
  const insets = useSafeAreaInsets()
  const inset = Platform.OS === "web" ? 54 : insets.top
  const openedAt = useRevealClock()
  const read = useStoriesStore((s) => s.read)
  const isRead = slug in read

  const { story, loading } = useStory(slug)
  const { stories } = useStories()
  const songTitle = useStorySongTitles(story ? [story, ...stories] : stories)

  const back = useCallback(() => (router.canGoBack() ? router.back() : router.replace(href("/stories"))), [router])

  const next = useMemo(() => {
    const sorted = sortStories(stories)
    return nextStory(sorted, slug, read)
    // the list should not reshuffle while reading: the read map only matters for the first pick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories, slug])

  if (!story) {
    return (
      <View style={[styles.root, { backgroundColor: theme.page, paddingTop: inset }]}>
        <View style={styles.missingBar}>
          <SpRound t={sp} icon="back" label="Back" onPress={back} />
        </View>
        <View style={styles.missing}>
          <Text style={[styles.missingText, { color: theme.textHeading }]}>
            {loading ? "Loading the story…" : "This story could not be found."}
          </Text>
          {!loading ? (
            <SpPill t={sp} label="All stories" onPress={() => router.replace(href("/stories"))} style={styles.missingBtn} />
          ) : null}
        </View>
      </View>
    )
  }

  return (
    <StoryView
      story={story}
      theme={theme}
      sp={sp}
      inset={inset}
      openedAt={openedAt}
      isRead={isRead}
      songTitle={songTitle}
      next={next}
      back={back}
    />
  )
}

function clamp01(v: number): number {
  "worklet"
  return v < 0 ? 0 : v > 1 ? 1 : v
}

type ViewProps = {
  story: Story
  theme: ReturnType<typeof useSongsTheme>
  sp: ReturnType<typeof useSpTheme>
  inset: number
  openedAt: number
  isRead: boolean
  songTitle: (n: number) => string | undefined
  next: Story | null
  back: () => void
}

function StoryView({
  story,
  theme,
  sp,
  inset,
  openedAt,
  isRead,
  songTitle,
  next,
  back,
}: ViewProps) {
  const bottomInset = useScrollBottomInset()
  const router = useRouter()
  const readMap = useStoriesStore((s) => s.read)
  const { width } = useWindowDimensions()
  const scrollY = useSharedValue(0)
  const contentH = useSharedValue(0)
  const viewH = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y
  })
  const progress = useDerivedValue(() => readingProgress(scrollY.value, contentH.value, viewH.value))

  const finish = useCallback(() => useStoriesStore.getState().markRead(story.slug), [story.slug])
  useAnimatedReaction(
    () => isFinished(progress.value),
    (done, was) => {
      if (done && !was) runOnJS(finish)()
    },
  )

  // the bar takes the page colour and shows the title once the photo has scrolled away
  const barGround = useAnimatedStyle(() => ({ opacity: clamp01((scrollY.value - (HERO - inset - BAR - 40)) / 40) }))
  const fill = useAnimatedStyle(() => ({
    opacity: scrollY.value > 4 ? 1 : 0,
    transform: [{ translateX: (progress.value - 1) * width }],
  }))


  const blocks = useMemo(() => parseBody(story.paragraphs), [story.paragraphs])
  const minutes = useMemo(() => {
    const m = estimateReadMinutes(bodyText(story.paragraphs))
    return m > 0 ? m : null
  }, [story.paragraphs])
  const songNumber = primarySong(story)
  const line = songLine(story, songTitle)
  const canListen = songNumber != null && hasPlayableAudio(songNumber)
  const songPage = songHrefFor(songNumber)

  const listen = useCallback(() => {
    if (songNumber == null) return
    usePlayerStore.getState().loadSong(starterSongForNumber(songNumber), [songNumber], "default")
    router.push(href(NAV_V2_PLAYER_ROUTE))
  }, [router, songNumber])

  const share = useCallback(async () => {
    const { message, subject } = storyShareMessage({
      title: story.title,
      songNumber,
      songTitle: songNumber ? songTitle(songNumber) : null,
      url: story.sourceUrl,
    })
    try {
      await Share.share({ message, title: subject })
    } catch {
      // the share sheet was closed or is not available here
    }
  }, [story, songNumber, songTitle])

  const openNext = useCallback((target: Story) => router.replace(href(`/stories/${target.slug}`)), [router])

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.root, { backgroundColor: theme.page }]}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          onLayout={(e) => {
            viewH.value = e.nativeEvent.layout.height
          }}
          onContentSizeChange={(_w, h) => {
            contentH.value = h
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomInset }}
        >
          {/* hero: the photo, a flat dim, a scrim at the top for the buttons and one at the bottom for the title */}
          <View style={[styles.hero, { backgroundColor: theme.inner }]}>
            <StoryPicture story={story} size="large" tint={theme.inner} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.dim]} pointerEvents="none" />
            <LinearGradient colors={amScrimPhotoTop} style={styles.scrimTop} pointerEvents="none" />
            <LinearGradient colors={amScrimPhoto} style={styles.scrimBottom} pointerEvents="none" />
            <SongsReveal index={0} style={styles.heroText}>
              <PhotoChip label={["Story", readTimeLabel(minutes)].filter(Boolean).join(" · ")} />
              <Text style={styles.heroTitle} accessibilityRole="header">
                {keepPsTogether(story.title)}
              </Text>
            </SongsReveal>
          </View>

          <View style={styles.column}>
            <SongsReveal index={1}>
              <View style={styles.meta}>
                {line ? (
                  <Text style={[styles.metaSong, { color: theme.accentText }]} numberOfLines={2}>
                    {line}
                  </Text>
                ) : null}
                <Text style={[styles.metaLine, { color: theme.textBody }]}>
                  {[story.author, readTimeLabel(minutes)].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </SongsReveal>

            <SongsReveal index={2}>
              <View style={styles.body}>
                {blocks.map((block, i) =>
                  block.kind === "quote" ? (
                    <View key={i} style={styles.quote} accessibilityRole="text">
                      <View style={[styles.quoteBar, { backgroundColor: theme.accentBright }]} />
                      <Text style={[styles.quoteText, { color: theme.textHeading }]}>{block.text}</Text>
                    </View>
                  ) : (
                    <Text key={i} style={[styles.paragraph, { color: theme.textHeading }]}>
                      {block.text}
                    </Text>
                  ),
                )}
              </View>
            </SongsReveal>

            <View style={[styles.end, { borderTopColor: theme.line }]}>
              <View style={styles.endState}>
                <View style={[styles.endMark, isRead ? { backgroundColor: theme.brand } : { borderColor: theme.line, borderWidth: 1.5 }]}>
                  {isRead ? <CheckGlyph size={14} color={theme.onBrand} /> : null}
                </View>
                <Text style={[styles.endText, { color: theme.textBody }]}>
                  {isRead ? "You have read this story." : "Read to the end and it is marked as read."}
                </Text>
              </View>
              {isRead ? (
                <Press
                  accessibilityRole="button"
                  accessibilityLabel="Mark as unread"
                  onPress={() => useStoriesStore.getState().markUnread(story.slug)}
                  pressedScale={0.96}
                  style={styles.endLink}
                >
                  <Text style={[styles.endLinkText, { color: theme.accent }]}>Mark unread</Text>
                </Press>
              ) : null}
            </View>

            {songNumber != null ? (
              <View style={styles.actions}>
                {canListen ? (
                  <SpPill t={sp} label="Listen to the song" icon="play" onPress={listen} style={styles.pill} />
                ) : null}
                {songPage ? (
                  <SpPill
                    t={sp}
                    label="Open the song page"
                    variant={canListen ? "sand" : "brand"}
                    onPress={() => router.push(href(songPage))}
                    style={styles.pill}
                  />
                ) : null}
              </View>
            ) : null}

            {story.sourceUrl ? (
              <Press
                accessibilityRole="link"
                accessibilityLabel="Read the original text"
                onPress={() => void openExternal(story.sourceUrl as string)}
                pressedScale={0.97}
                style={styles.source}
              >
                <Text style={[styles.endLinkText, { color: theme.accent }]}>Read the original text</Text>
              </Press>
            ) : null}
          </View>

          {next ? (
            <View style={styles.nextBlock}>
              <Text style={[amType.label, styles.nextLabel, { color: theme.eyebrow }]} accessibilityRole="header">
                Next story
              </Text>
              <StoryRow
                theme={theme}
                story={next}
                line={songLine(next, songTitle)}
                minutes={minutesOf(next)}
                read={next.slug in readMap}
                onOpen={openNext}
              />
            </View>
          ) : null}
        </Animated.ScrollView>

        {/* the pinned bar: buttons always, page colour + title after the photo, reading progress along its foot */}
        <View style={[styles.bar, { paddingTop: inset, height: inset + BAR }]} pointerEvents="box-none">
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.page }, barGround]} />
          <View style={styles.barRow} pointerEvents="box-none">
            <SpRound t={sp} icon="back" label="Back" onPress={back} />
            <Animated.View pointerEvents="none" style={[styles.barTitleWrap, barGround]}>
              <Text style={[styles.barTitle, { color: theme.textHeading }]} numberOfLines={1}>
                {story.title}
              </Text>
            </Animated.View>
            <SpRound t={sp} label="Share this story" onPress={() => void share()}>
              <ShareGlyph size={22} color={sp.ink800} />
            </SpRound>
          </View>
          <View style={styles.track} pointerEvents="none" accessibilityElementsHidden>
            <Animated.View style={[styles.fill, { backgroundColor: theme.accentBright }, fill]} />
          </View>
        </View>
      </View>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  missingBar: { paddingLeft: 10, height: BAR, justifyContent: "center" },
  missing: { paddingHorizontal: 20, paddingTop: 24, gap: 16 },
  missingText: { fontFamily: amFonts.medium, fontSize: 18, lineHeight: 25 },
  missingBtn: { alignSelf: "flex-start" },
  hero: { height: HERO, justifyContent: "flex-end", overflow: "hidden" },
  dim: { backgroundColor: "rgba(0,0,0,0.16)" },
  scrimTop: { position: "absolute", left: 0, right: 0, top: 0, height: 140 },
  scrimBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: 280 },
  heroText: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  heroTitle: {
    fontFamily: amFonts.display,
    fontSize: 34,
    lineHeight: 35,
    letterSpacing: -0.68,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  column: { width: "100%", maxWidth: MEASURE, alignSelf: "center", paddingHorizontal: 20 },
  meta: { paddingTop: 20, gap: 4 },
  metaSong: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  metaLine: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 19 },
  body: { paddingTop: 20, gap: 18 },
  paragraph: { fontFamily: amFonts.regular, fontSize: 17, lineHeight: 26 },
  quote: { flexDirection: "row", gap: 16, paddingVertical: 8 },
  quoteBar: { width: 4, borderRadius: 2 },
  quoteText: { flex: 1, fontFamily: amFonts.bold, fontSize: 22, lineHeight: 30, letterSpacing: -0.22 },
  end: {
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  endState: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  endMark: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  endText: { flex: 1, fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  endLink: { minHeight: 44, justifyContent: "center" },
  endLinkText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  actions: { paddingTop: 20, gap: 12 },
  pill: { alignSelf: "stretch" },
  source: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", marginTop: 8 },
  nextBlock: { paddingTop: 36, width: "100%", maxWidth: MEASURE + 32, alignSelf: "center" },
  nextLabel: { paddingHorizontal: 20, paddingBottom: 12 },
  bar: { position: "absolute", left: 0, right: 0, top: 0, zIndex: 10 },
  barRow: { flexDirection: "row", alignItems: "center", height: BAR, paddingHorizontal: 10, gap: 8 },
  barTitleWrap: { flex: 1, paddingHorizontal: 4 },
  barTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21, textAlign: "center" },
  track: { position: "absolute", left: 0, right: 0, bottom: 0, height: 2, overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, width: "100%" },
})
