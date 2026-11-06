import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react"
import { StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from "react-native"
import { GestureDetector } from "react-native-gesture-handler"
import Animated, { FadeIn, type AnimatedRef, type SharedValue } from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"

import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { BLOCK_TABS, type BlockTab } from "@/lib/songPage/blockTabs"
import { DOT_STEP, LYRICS_FOOT, PANELS_HEAD, PANEL_COUNT, PANEL_FOOT, PANEL_TOP, buildFrame, panelIndexOf, panelTab } from "@/lib/songPage/blockPanels"
import { usePageT } from "@/lib/songPage/pageCopy"

import { CommentaryBody } from "./Commentary"
import { LyricsBody } from "./LyricsBody"
import { useReadingStore } from "./readingState"
import type { PageUi } from "./state"
import { TextOptionsButton } from "./TextOptions"
import type { SongPageModel } from "./useSongPageModel"
import { usePanelMotion, type PanelController } from "./usePanelMotion"
import { WordByWordBody } from "./WordByWord"

const TAB_LABEL: Record<BlockTab, "songPage.tab.lyrics" | "songPage.tab.meaning" | "songPage.lyrics.view.words"> = {
  lyrics: "songPage.tab.lyrics",
  commentary: "songPage.tab.meaning",
  words: "songPage.lyrics.view.words",
}

/** The row of page dots under the Aa row. */
const DOTS_H = 28
/** The bottom room the stage leaves under itself (the mini-player is added by the bottom inset). */
const STAGE_FOOT = 8

/**
 * Section 1 of the page: ONE block with three panels side by side, Lyrics | Commentary | Word by word, and no visible
 * tab switcher (board 6, variant 5). The header holds the one-word name of the panel, its place ("1/3"), the small
 * "Aa" button (the text options popover) and the page dots. The panels sit in a PINNED STAGE: when the block reaches
 * the bars the stage holds still, and the page's scroll moves the panels (see lib/songPage/blockPanels.ts and
 * usePanelMotion.ts). A sideways swipe, a dot, or the section strip changes the panel too. The panels' bodies are the
 * tab components as before: LyricsBody (swappable, see its file), CommentaryBody, WordByWordBody.
 */
export function TextBlock({
  t,
  model,
  ui,
  blockTop,
  topInset,
  motion,
  scrollRef,
  controller,
}: {
  t: SpTheme
  model: SongPageModel
  ui: PageUi
  /** page y of the block's top, and the bars it pins under */
  blockTop: number
  topInset: number
  motion: { scrollY: SharedValue<number>; touch: SharedValue<number> }
  scrollRef: AnimatedRef<Animated.ScrollView>
  controller: MutableRefObject<PanelController | null>
}) {
  const tr = usePageT()
  const reading = useReadingStore()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const bottomInset = useScrollBottomInset(0)
  const [width, setWidth] = useState(windowWidth)
  const [heights, setHeights] = useState<number[]>(() => BLOCK_TABS.map(() => 0))
  const index = panelIndexOf(ui.blockTab)

  const frame = useMemo(
    () => buildFrame({ width, contents: heights, available: windowHeight - topInset - bottomInset - STAGE_FOOT }),
    [width, heights, windowHeight, topInset, bottomInset],
  )
  const { setBlockTab } = ui
  const onPanel = useCallback((i: number) => setBlockTab(panelTab(i)), [setBlockTab])
  const onReading = useCallback((y: number) => reading?.setScroll(y), [reading])
  const m = usePanelMotion({ scrollY: motion.scrollY, touch: motion.touch, scrollRef, blockTop, topInset, frame, onPanel, onReading })
  const { goTo } = m
  useEffect(() => {
    controller.current = { goTo }
    return () => {
      controller.current = null
    }
  }, [controller, goTo])
  // where the lyrics begin inside the block: under the stage's header
  useEffect(() => {
    reading?.setBodyY(PANELS_HEAD + PANEL_TOP)
  }, [reading])

  const measure = (i: number) => (event: LayoutChangeEvent) => {
    const h = Math.round(event.nativeEvent.layout.height)
    setHeights((list) => (list[i] === h ? list : list.map((v, k) => (k === i ? h : v))))
  }
  const labels = BLOCK_TABS.map((id) => tr(TAB_LABEL[id]))
  const current = labels[index] ?? ""

  return (
    <View style={{ height: frame.stage + frame.distance }}>
      <Animated.View
        style={[styles.stage, { height: frame.stage, backgroundColor: t.sand200 }, m.stageStyle]}
        onLayout={(event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width))}
      >
        <View style={styles.head}>
          <View style={styles.headRow}>
            <Animated.View key={ui.blockTab} entering={FadeIn.duration(150)} style={styles.name} accessibilityRole="header">
              <Text style={[styles.nameText, { color: t.ink900 }]} numberOfLines={1}>
                {current}
              </Text>
              <Text style={[styles.place, { color: t.ink500 }]}>{`${index + 1}/${PANEL_COUNT}`}</Text>
            </Animated.View>
            <TextOptionsButton t={t} ui={ui} />
          </View>
          <View accessibilityRole="tablist" accessibilityLabel={tr("songPage.block.a11y")} style={styles.dots}>
            <View style={styles.dotTrack}>
              {labels.map((label, i) => (
                <SpPress
                  key={BLOCK_TABS[i]}
                  onPress={() => (i !== index ? goTo(i) : undefined)}
                  accessibilityRole="tab"
                  accessibilityLabel={`${label}, ${i + 1}/${PANEL_COUNT}`}
                  accessibilityState={{ selected: i === index }}
                  pressedScale={0.9}
                  hitSlop={{ top: 8, bottom: 8 }}
                  style={[styles.slot, { left: i * DOT_STEP }]}
                >
                  <View style={[styles.dot, { backgroundColor: t.sand400 }]} />
                </SpPress>
              ))}
              <Animated.View pointerEvents="none" style={[styles.mark, { backgroundColor: t.action }, m.markStyle]} />
            </View>
          </View>
        </View>
        <GestureDetector gesture={m.gesture}>
          <View style={{ height: frame.view, overflow: "hidden" }}>
            <Animated.View style={[styles.row, { width: width * PANEL_COUNT, height: frame.view }, m.rowStyle]}>
              {BLOCK_TABS.map((id, i) => (
                <View
                  key={id}
                  style={{ width, height: frame.view, overflow: "hidden" }}
                  accessibilityElementsHidden={i !== index}
                  importantForAccessibility={i === index ? "auto" : "no-hide-descendants"}
                >
                  <Animated.View style={[styles.content, m.readStyle[i]]}>
                    <View onLayout={measure(i)} style={{ paddingTop: PANEL_TOP, paddingBottom: id === "lyrics" ? LYRICS_FOOT : PANEL_FOOT }}>
                      {id === "lyrics" ? <LyricsBody t={t} model={model} ui={ui} /> : id === "commentary" ? <CommentaryBody t={t} model={model} /> : <WordByWordBody t={t} model={model} ui={ui} />}
                    </View>
                  </Animated.View>
                </View>
              ))}
            </Animated.View>
          </View>
        </GestureDetector>
        {/* the text runs on under the header and under the stage's bottom edge: a soft end instead of a cut line */}
        <LinearGradient pointerEvents="none" colors={[t.sand200, `${t.sand200}00`]} style={styles.fadeTop} />
        <LinearGradient pointerEvents="none" colors={[`${t.sand200}00`, t.sand200]} style={styles.fade} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  stage: { overflow: "hidden", zIndex: 1 },
  head: { height: PANELS_HEAD, paddingHorizontal: 20 },
  headRow: { height: PANELS_HEAD - DOTS_H, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, flexDirection: "row", alignItems: "baseline", gap: 8 },
  nameText: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 26 },
  place: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  dots: { height: DOTS_H, alignItems: "center", justifyContent: "center" },
  dotTrack: { width: DOT_STEP * PANEL_COUNT, height: DOTS_H },
  slot: { position: "absolute", top: 0, width: DOT_STEP, height: DOTS_H, alignItems: "center", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  mark: { position: "absolute", left: (DOT_STEP - 18) / 2, top: (DOTS_H - 6) / 2, width: 18, height: 6, borderRadius: 3 },
  fadeTop: { position: "absolute", left: 0, right: 0, top: PANELS_HEAD, height: PANEL_TOP + 6 },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 32 },
  row: { position: "absolute", top: 0, left: 0, flexDirection: "row" },
  content: { position: "absolute", top: 0, left: 0, right: 0 },
})
