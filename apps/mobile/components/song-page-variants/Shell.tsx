import { useState, type ReactNode, type RefObject } from "react"
import { ActivityIndicator, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import { usePathname, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated"

import { SpPill, SpToast } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { miniPlayerVisible } from "@/lib/navV2"
import { pageBottomInset, ramp, stripHairline, stripTop } from "@/lib/songPage/stickyBar"
import { useVariantT } from "@/lib/songPageVariants/copy"
import { usePlayerStore } from "@/stores/playerStore"

import { BarButton, PhotoButton } from "./ui"
import type { SongVariantModel } from "./useSongVariantModel"

/** The status-bar room the web preview does not report. */
const WEB_TOP = 12
export const BAR_ROW = 52

export function useBarHeight(): number {
  const insets = useSafeAreaInsets()
  return Math.max(insets.top, WEB_TOP) + BAR_ROW
}

export type ShellProps = {
  t: SpTheme
  model: SongVariantModel
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
  onBack?: () => void
  scrollRef?: RefObject<Animated.ScrollView | null>
  /** JS-side scroll offset, in steps of 8px */
  onScrollJS?: (y: number) => void
  /** the hero block's height, as it changes */
  onHeroHeight?: (height: number) => void
  /** drawn over the page, under the bar (the word tray) */
  overlay?: ReactNode
  /** a fixed overlay for sheets */
  sheets?: ReactNode
  children: ReactNode
}

/**
 * The frame the three variants share: the scroll view, the buttons over the photo, the compact bar that takes over
 * when the hero is gone, a strip that pins under it, the toast. Only transform and opacity animate.
 */
export function Shell({ t, model, title, heroHeight, top, hero, strip, stripHeight = 0, onMore, onBack, scrollRef, onScrollJS, onHeroHeight, overlay, sheets, children }: ShellProps) {
  const tr = useVariantT()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))
  const barHeight = useBarHeight()
  const bottom = pageBottomInset({ safeBottom: insets.bottom, miniVisible: miniPlayerVisible({ pathname, hasSong }) })

  const scrollY = useSharedValue(0)
  const stripY = useSharedValue(0)
  const [barOn, setBarOn] = useState(top === "plain")
  const threshold = Math.max(40, heroHeight - barHeight - 24)

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
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

  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))
  const topPad = Math.max(insets.top, WEB_TOP)
  // in the preview the variant switcher sits in the middle of the bar, so the title steps aside
  const showTitle = !MOCKUP_DATA

  return (
    <View style={[styles.root, { backgroundColor: t.sand200 }]}>
      <Animated.ScrollView
        ref={scrollRef as never}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom + 24, paddingTop: top === "plain" ? barHeight : 0 }}
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
          <PhotoButton t={t} icon="back" label={tr("songVariant.back")} onPress={back} />
          <PhotoButton t={t} icon="more" label={tr("songVariant.more")} onPress={onMore} />
        </View>
      ) : null}

      <Animated.View
        pointerEvents={barOn ? "auto" : "none"}
        style={[styles.bar, { height: barHeight, paddingTop: topPad, backgroundColor: t.sand200, borderBottomColor: t.sand400 }, barStyle]}
      >
        <BarButton t={t} icon="back" label={tr("songVariant.back")} onPress={back} />
        {showTitle ? (
          <Animated.Text style={[styles.barTitle, { color: t.ink900 }, titleStyle]} numberOfLines={1}>
            {title}
          </Animated.Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <BarButton t={t} icon="more" label={tr("songVariant.more")} onPress={onMore} />
      </Animated.View>

      {overlay}
      {sheets}
      <SpToast t={t} message={model.toast} />
    </View>
  )
}

/** Loading and not-found screens. */
export function ShellMessage({ t, loading, onBack }: { t: SpTheme; loading: boolean; onBack: () => void }) {
  const tr = useVariantT()
  return (
    <View style={[styles.root, styles.centered, { backgroundColor: t.sand200 }]}>
      {loading ? (
        <ActivityIndicator color={t.orange500} />
      ) : (
        <>
          <Text style={{ fontFamily: amFonts.medium, fontSize: 17, color: t.ink800 }}>{tr("songVariant.notFound")}</Text>
          <SpPill t={t} label={tr("songVariant.goBack")} onPress={onBack} />
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
  floating: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12 },
  bar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  barTitle: { flex: 1, textAlign: "center", fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, paddingHorizontal: 8 },
})
