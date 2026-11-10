import { useEffect, useState, type ReactNode, type RefObject } from "react"
import { ActivityIndicator, Platform, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated"

import { SpPill, SpToast } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useResolvedAppearance } from "@/hooks/useAmTheme"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { statusBarStyleFor } from "@/lib/appearance"
import { PS_SONG_COUNT } from "@/lib/learn/learnSongs"
import { postFrameStatusBar } from "@/lib/framePreview"
import { ramp, stripHairline, stripTop } from "@/lib/songPage/stickyBar"
import { usePageT } from "@/lib/songPage/pageCopy"

import { BarButton, PhotoButton } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/** The status-bar room the web preview does not report. */
const WEB_TOP = 12
export const BAR_ROW = 52

export function useBarHeight(): number {
  const insets = useSafeAreaInsets()
  return Math.max(insets.top, WEB_TOP) + BAR_ROW
}

export type ShellProps = {
  t: SpTheme
  model: SongPageModel
  /** the title shown in the compact bar */
  title: string
  /** how tall the hero is; the compact bar appears as it scrolls away */
  heroHeight: number
  /** photo: buttons float over the hero; plain: the bar is always there */
  top: "photo" | "plain"
  hero: ReactNode
  /** a strip (tabs) that pins under the bar, and its height */
  strip?: ReactNode
  stripHeight?: number
  onMore: () => void
  /** opens the sections menu; a page that has no such menu (the tabbed song page) leaves it out and no button is drawn */
  onMenu?: () => void
  onBack?: () => void
  scrollRef?: RefObject<Animated.ScrollView | null> | AnimatedRef<Animated.ScrollView>
  /**
   * The page's scroll offset and a counter of finger touches on the scroll, owned by the page so the pinned text block
   * can read the offset on the UI thread and stop a settling spring when the reader puts a finger on the page.
   */
  motion?: { scrollY: SharedValue<number>; touch: SharedValue<number> }
  /** JS-side scroll offset, in steps of 8px */
  onScrollJS?: (y: number) => void
  /** the hero block's height, as it changes */
  onHeroHeight?: (height: number) => void
  /** drawn over the page, under the bar (for example a floating tray) */
  overlay?: ReactNode
  /** a fixed overlay for sheets */
  sheets?: ReactNode
  children: ReactNode
}

/**
 * The frame of the song page: the scroll view, the buttons over the photo, the compact bar that takes over
 * when the hero is gone, a strip that pins under it, the toast. Only transform and opacity animate.
 */
export function Shell({ t, model, title, heroHeight, top, hero, strip, stripHeight = 0, onMore, onMenu, onBack, scrollRef, motion, onScrollJS, onHeroHeight, overlay, sheets, children }: ShellProps) {
  const tr = usePageT()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const barHeight = useBarHeight()
  const bottom = useScrollBottomInset(24)
  const resolved = useResolvedAppearance()

  const ownScrollY = useSharedValue(0)
  const scrollY = motion?.scrollY ?? ownScrollY
  const touch = motion?.touch
  const stripY = useSharedValue(0)
  const [barOn, setBarOn] = useState(top === "plain")
  const threshold = Math.max(40, heroHeight - barHeight - 24)

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y
    },
    onBeginDrag: () => {
      if (touch) touch.value += 1
    },
  })
  useAnimatedReaction(
    () => scrollY.value > threshold,
    (now, before) => {
      if (top === "photo" && now !== before) runOnJS(setBarOn)(now)
    },
    [threshold, top],
  )
  useAnimatedReaction(
    () => Math.round(scrollY.value / 8),
    (step, before) => {
      if (onScrollJS && step !== before) runOnJS(onScrollJS)(step * 8)
    },
    [onScrollJS],
  )

  const barStyle = useAnimatedStyle(() => ({ opacity: top === "plain" ? 1 : ramp(scrollY.value, threshold - 20, threshold + 20) }))
  const titleStyle = useAnimatedStyle(() => ({ opacity: ramp(scrollY.value, threshold + 10, threshold + 60) }))
  const stripStyle = useAnimatedStyle(() => ({
    opacity: stripY.value > 0 ? 1 : 0,
    transform: [{ translateY: stripTop(stripY.value, scrollY.value, barHeight) }],
  }))
  const hairStyle = useAnimatedStyle(() => ({ opacity: stripHairline(stripY.value, scrollY.value, barHeight) }))

  // the photo sits under the status bar: while it shows, the status bar is light (over the dark scrim), then it follows the theme
  const heroOn = top === "photo" && !barOn
  useEffect(() => {
    if (Platform.OS !== "web") return
    postFrameStatusBar(heroOn ? "light" : statusBarStyleFor(resolved))
    return () => postFrameStatusBar(statusBarStyleFor(resolved))
  }, [heroOn, resolved])

  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))
  const topPad = Math.max(insets.top, WEB_TOP)

  return (
    <View style={[styles.root, { backgroundColor: t.sand200 }]}>
      <Animated.ScrollView
        ref={scrollRef as never}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom, paddingTop: top === "plain" ? barHeight : 0 }}
      >
        <View
          onLayout={(event: LayoutChangeEvent) => {
            // the web reports a size change but not a move, so the strip's place is the hero's height, not a measured y
            const h = Math.round(event.nativeEvent.layout.height)
            stripY.value = h + (top === "plain" ? barHeight : 0)
            onHeroHeight?.(h)
          }}
        >
          {hero}
        </View>
        {strip ? <View style={{ height: stripHeight }} /> : null}
        {children}
      </Animated.ScrollView>

      {strip ? (
        <Animated.View style={[styles.strip, { height: stripHeight, backgroundColor: t.sand200 }, stripStyle]}>
          {strip}
          <Animated.View pointerEvents="none" style={[styles.hair, { backgroundColor: t.sand400 }, hairStyle]} />
        </Animated.View>
      ) : null}

      {top === "photo" && !barOn ? (
        <View style={[styles.floating, { paddingTop: topPad + 4 }]} pointerEvents="box-none">
          <PhotoButton t={t} icon="back" label={tr("songPage.back")} onPress={back} />
          <View style={styles.right}>
            {onMenu ? <PhotoButton t={t} icon="menu" label={tr("songPage.menu.a11y")} onPress={onMenu} /> : null}
            <PhotoButton t={t} icon="more" label={tr("songPage.more")} onPress={onMore} />
          </View>
        </View>
      ) : null}

      <Animated.View
        pointerEvents={barOn ? "auto" : "none"}
        style={[styles.bar, { height: barHeight, paddingTop: topPad, backgroundColor: t.sand200, borderBottomColor: t.sand400 }, barStyle]}
      >
        <BarButton t={t} icon="back" label={tr("songPage.back")} onPress={back} />
        <Animated.Text style={[styles.barTitle, { color: t.ink900 }, titleStyle]} numberOfLines={1}>
          {title}
        </Animated.Text>
        {onMenu ? <BarButton t={t} icon="menu" label={tr("songPage.menu.a11y")} onPress={onMenu} /> : null}
        <BarButton t={t} icon="more" label={tr("songPage.more")} onPress={onMore} />
      </Animated.View>

      {heroOn ? <StatusBar style="light" /> : null}
      {overlay}
      {sheets}
      <SpToast t={t} message={model.toast} />
    </View>
  )
}

/** Loading and not-found screens. */
export function ShellMessage({ t, loading, missing, onBack }: { t: SpTheme; loading: boolean; missing?: boolean; onBack: () => void }) {
  const tr = usePageT()
  return (
    <View style={[styles.root, styles.centered, { backgroundColor: t.sand200 }]}>
      {loading ? (
        <ActivityIndicator color={t.orange500} />
      ) : (
        <>
          <Text style={{ fontFamily: amFonts.medium, fontSize: 17, color: t.ink800 }}>{tr("songPage.notFound")}</Text>
          {missing ? (
            <Text style={{ fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20, color: t.ink500, textAlign: "center", paddingHorizontal: 32 }}>
              {tr("songPage.notFound.range", { max: PS_SONG_COUNT })}
            </Text>
          ) : null}
          <SpPill t={t} label={tr("songPage.goBack")} onPress={onBack} />
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", gap: 16 },
  strip: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 8, justifyContent: "center" },
  hair: { position: "absolute", left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  right: { flexDirection: "row", gap: 8 },
  floating: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12 },
  bar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  barTitle: { flex: 1, textAlign: "center", fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, paddingHorizontal: 8 },
})
