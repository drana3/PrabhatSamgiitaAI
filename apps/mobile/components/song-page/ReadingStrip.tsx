import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  FadeIn,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"

import { Frost } from "@/components/common/Frost"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { SpIcon } from "@/components/song-v2/SpIcon"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { rubberBand } from "@/lib/navV2"
import { useSheetCover } from "@/lib/sheetCover"
import { lyricLanguage, lyricLanguageName } from "@/lib/songPage/lyricLanguages"
import { usePageT } from "@/lib/songPage/pageCopy"
import { STRIP_HEIGHT } from "@/lib/songPage/pageSections"
import { shownStanza, stanzaNumbers, stripSettle, stripVisible } from "@/lib/songPage/readingStrip"
import { useSongPageStore } from "@/stores/songPageStore"

import type { PageUi } from "./state"
import { useReading, useReadingStore } from "./readingState"
import { useBarHeight } from "./Shell"
import type { SongPageModel } from "./useSongPageModel"
import { useReadingSplit } from "./useReadingSplit"

/** Chrome of the card: the grabber, the label row. The compact card adds two lines of the translation. */
const GRAB = 14
const HEADER = 28
const PAD_BOTTOM = 14
const SIDE = 10
const RUBBER = 96
const REDUCED_MS = 150
/** the open card never takes more than this share of the window */
const MAX_SHARE = 0.5

/** Same colour, no opacity: the end of the fade that hides the third line of the compact card. */
function clear(color: string): string {
  return color.replace(/[\d.]+\)\s*$/, "0)")
}

/**
 * THE READING STRIP of the Lyrics tab. A card floating above the mini-player and the safe area, drawn only while the
 * Lyrics tab is on screen and the lyrics are in view. Compact by default: the stanza label and the first two lines of
 * its translation, fading. Tap it, or drag it up, and it opens to the whole translation of that stanza; the choice is
 * kept on the device. The drag is one to one from where the finger took it, past the limits it meets a rubber band, on
 * release the finger's speed goes into the spring and the landing is the projection of the throw. It can be caught
 * mid-flight: every move starts from the height on screen.
 *
 * It follows the stanza in the middle of the screen (Scroll mode) or the stanza the reader tapped (Tap mode). A song
 * whose translation cannot be tied to stanzas honestly shows it whole, scrollable, as one piece.
 */
export function ReadingStrip({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const store = useReadingStore()
  const reduce = useReducedMotion()
  const { width, height: windowHeight } = useWindowDimensions()
  const barHeight = useBarHeight()
  const bottom = useScrollBottomInset(-16)
  const expanded = useSongPageStore((s) => s.stripExpanded)
  const setExpanded = useSongPageStore((s) => s.setStripExpanded)
  const split = useReadingSplit(model, ui.translationOn)
  const inView = useReading((s) => s.inView)
  const sheetOpen = useSheetCover((s) => s.count > 0)
  const count = split.kind === "stanzas" ? split.items.length : 0
  const shown = useReading((s) => shownStanza(s.mode, s.current, count))
  const pinned = useReading((s) => s.mode.mode === "tap")
  const tab = model.facts.hasLyrics ? ui.blockTab : "lyrics"
  const visible = stripVisible({ tab, split: split.kind, translationOn: ui.translationOn, inView, sheetOpen })

  // ---- what the card says ----
  const numbers = useMemo(() => stanzaNumbers(model.structure.blocks), [model.structure.blocks])
  const language = lyricLanguage(model.meaning.language)?.native ?? lyricLanguageName(model.meaning.language)
  const scale = Math.max(1, ui.scale)
  const textStyle = { fontFamily: amFonts.regular, fontSize: Math.round(16 * scale), lineHeight: Math.round(23 * scale), color: t.ink800 }
  const item = split.kind === "stanzas" ? split.items[shown] : undefined
  const head =
    split.kind === "whole"
      ? tr("songPage.read.whole")
      : item?.chorus
        ? tr("songPage.lyrics.refrain")
        : tr("songPage.read.stanza", { n: numbers[shown] ?? shown + 1 })
  const paragraphs = split.kind === "whole" ? split.paragraphs : item ? [item.text] : []
  const key = split.kind === "whole" ? "whole" : `s${shown}`

  // ---- geometry: compact = chrome + two lines; open = chrome + the text, at most half the window ----
  const compactH = GRAB + HEADER + Math.round(23 * scale) * 2 + PAD_BOTTOM
  const cap = Math.round(windowHeight * MAX_SHARE)
  const [textH, setTextH] = useState(0)
  const openH = Math.max(compactH, Math.min(cap, GRAB + HEADER + textH))
  const hc = useSharedValue(compactH)
  const hx = useSharedValue(openH)
  const h = useSharedValue(expanded ? openH : compactH)
  const goal = useSharedValue(expanded ? openH : compactH)
  const dragging = useSharedValue(false)
  const press = useSharedValue(0)
  const start = useSharedValue(0)
  const vis = useSharedValue(0)

  const settleTo = useCallback(
    (target: number, velocity = 0, fling = false) => {
      goal.value = target
      cancelAnimation(h)
      h.value = reduce
        ? withTiming(target, { duration: REDUCED_MS })
        : withSpring(target, { ...(fling ? amSpring.fling : amSpring.default), velocity })
    },
    [goal, h, reduce],
  )
  // the card follows the stored choice and the height of the text, unless a drag is in charge
  useEffect(() => {
    hc.value = compactH
    hx.value = openH
    const target = expanded ? openH : compactH
    if (dragging.value || goal.value === target) return
    settleTo(target)
  }, [expanded, openH, compactH, hc, hx, dragging, goal, settleTo])

  // appear and leave: translate and fade, never a jump
  useEffect(() => {
    vis.value = reduce ? withTiming(visible ? 1 : 0, { duration: REDUCED_MS }) : withSpring(visible ? 1 : 0, amSpring.default)
  }, [visible, reduce, vis])

  // tell the lyrics where the strip is, so "the middle of the screen" is the middle of what is left
  useEffect(() => {
    store?.setViewport(windowHeight, barHeight + STRIP_HEIGHT)
    store?.setBottomReserve(bottom + (expanded ? openH : compactH) + 12)
  }, [store, windowHeight, barHeight, bottom, compactH, openH, expanded])

  const commit = useCallback((open: boolean) => setExpanded(open), [setExpanded])
  const toggle = useCallback(() => {
    const open = !expanded
    setExpanded(open)
    settleTo(open ? openH : compactH)
  }, [expanded, openH, compactH, setExpanded, settleTo])

  const makePan = () =>
    Gesture.Pan()
      .activeOffsetY([-6, 6])
      .failOffsetX([-24, 24])
      .onBegin(() => {
        cancelAnimation(h)
        start.value = h.value
        dragging.value = true
        press.value = reduce ? 1 : withSpring(1, amSpring.default)
      })
      .onUpdate((event) => {
        h.value = rubberBand(start.value - event.translationY, hc.value, hx.value, RUBBER)
      })
      .onEnd((event) => {
        const { expanded: open, fling } = stripSettle(h.value, event.velocityY, hc.value, hx.value)
        const target = open ? hx.value : hc.value
        goal.value = target
        // the finger's speed (up is negative in the gesture, positive for a growing height) goes into the spring
        h.value = reduce ? withTiming(target, { duration: REDUCED_MS }) : withSpring(target, { ...(fling ? amSpring.fling : amSpring.default), velocity: -event.velocityY })
        runOnJS(commit)(open)
      })
      .onFinalize(() => {
        dragging.value = false
        press.value = reduce ? 0 : withSpring(0, amSpring.default)
      })
  const makeTap = () =>
    Gesture.Tap()
      .maxDistance(10)
      .onBegin(() => {
        press.value = reduce ? 1 : withSpring(1, amSpring.default)
      })
      .onEnd((_event, success) => {
        if (success) runOnJS(toggle)()
      })
      .onFinalize(() => {
        press.value = reduce ? 0 : withSpring(0, amSpring.default)
      })
  const headerGesture = Gesture.Race(makePan(), makeTap())
  const peekGesture = Gesture.Race(makePan(), makeTap())

  const cardStyle = useAnimatedStyle(() => ({ height: h.value }))
  const wrapStyle = useAnimatedStyle(() => ({ opacity: vis.value, transform: [{ translateY: (1 - vis.value) * 28 }] }))
  const tintStyle = useAnimatedStyle(() => ({ opacity: press.value * 0.5 }))
  const fadeStyle = useAnimatedStyle(() => {
    const span = Math.max(1, hx.value - hc.value)
    const p = Math.min(1, Math.max(0, (h.value - hc.value) / span))
    return { opacity: 1 - p }
  })
  const chevStyle = useAnimatedStyle(() => {
    const span = Math.max(1, hx.value - hc.value)
    const p = Math.min(1, Math.max(0, (h.value - hc.value) / span))
    return { transform: [{ rotate: `${p * 180}deg` }] }
  })

  const scrollRef = useRef<Animated.ScrollView>(null)
  useEffect(() => {
    ;(scrollRef.current as unknown as { scrollTo?: (o: { y: number; animated: boolean }) => void } | null)?.scrollTo?.({ y: 0, animated: false })
  }, [key])
  const onContent = useCallback((_w: number, contentH: number) => setTextH((prev) => (Math.abs(prev - contentH) < 1 ? prev : contentH)), [])

  if (split.kind === "none") return null
  const label = item?.ofFirstTime ? `${language} · ${tr("songPage.read.firstTime")}` : language

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[styles.wrap, { bottom, left: SIDE, width: Math.max(0, width - SIDE * 2) }, wrapStyle]}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      <Animated.View style={[styles.card, { borderColor: t.orange100, backgroundColor: t.glassSolid }, cardStyle]} accessibilityLabel={tr("songPage.read.a11y")}>
        <Frost intensity={40} tint={t.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.glassSolid }]} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.orange100 }, tintStyle]} />
        <GestureDetector gesture={headerGesture}>
          <View
            style={styles.header}
            accessible
            accessibilityRole="button"
            accessibilityLabel={expanded ? tr("songPage.read.collapse") : tr("songPage.read.expand")}
            accessibilityState={{ expanded }}
          >
            <View style={[styles.grab, { backgroundColor: t.ink300 }]} />
            <View style={styles.row}>
              <View style={styles.title}>
                {item?.chorus ? <PlayerIcon name="repeat" size={14} color={t.accentText} /> : null}
                <Text numberOfLines={1} style={[styles.head, { color: t.accentText }]}>
                  {head}
                </Text>
                <Text numberOfLines={1} style={[styles.lang, { color: t.ink500 }]}>
                  {`· ${label}`}
                </Text>
              </View>
              {pinned && split.kind === "stanzas" ? <Text style={[styles.pinned, { color: t.ink500, borderColor: t.sand400 }]}>{tr("songPage.read.pinned")}</Text> : null}
              <Animated.View style={chevStyle}>
                <SpIcon name="chevDown" size={20} color={t.ink500} strokeWidth={2} />
              </Animated.View>
            </View>
          </View>
        </GestureDetector>
        <View style={styles.bodyBox}>
          <Animated.ScrollView
            ref={scrollRef}
            scrollEnabled={expanded}
            showsVerticalScrollIndicator={false}
            bounces={false}
            onContentSizeChange={onContent}
            contentContainerStyle={styles.bodyContent}
          >
            <Animated.View key={key} entering={reduce ? undefined : FadeIn.duration(180)}>
              {paragraphs.map((p, i) => (
                <Text key={i} style={[textStyle, i > 0 ? styles.para : null]}>
                  {p}
                </Text>
              ))}
            </Animated.View>
          </Animated.ScrollView>
          <Animated.View pointerEvents="none" style={[styles.fade, fadeStyle]}>
            <LinearGradient colors={[clear(t.glassSolid), t.glassSolid]} style={StyleSheet.absoluteFill} />
          </Animated.View>
          {!expanded ? (
            <GestureDetector gesture={peekGesture}>
              <View style={StyleSheet.absoluteFill} accessible={false} />
            </GestureDetector>
          ) : null}
        </View>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", zIndex: 12 },
  card: { borderRadius: 24, borderWidth: 1, overflow: "hidden" },
  header: { height: GRAB + HEADER, justifyContent: "flex-start" },
  grab: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginTop: 6, opacity: 0.7 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 16, paddingRight: 12, height: HEADER - 2 },
  title: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  head: { fontFamily: amFonts.bold, fontSize: 11, lineHeight: 16, letterSpacing: 1.1, textTransform: "uppercase", flexShrink: 0 },
  lang: { flexShrink: 1, fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16 },
  pinned: { fontFamily: amFonts.bold, fontSize: 11, lineHeight: 14, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderRadius: 9999, overflow: "hidden" },
  bodyBox: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingBottom: PAD_BOTTOM },
  para: { marginTop: 8 },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 22 },
})
