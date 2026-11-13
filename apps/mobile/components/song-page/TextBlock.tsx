import { useCallback, useEffect, useState, type MutableRefObject } from "react"
import { StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from "react-native"
import { GestureDetector } from "react-native-gesture-handler"
import Animated, { FadeIn } from "react-native-reanimated"

import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { BLOCK_TABS, blockIndexOf, blockTabAt, type BlockTab } from "@/lib/songPage/blockTabs"
import { DOT_STEP, PAGE_COUNT } from "@/lib/songPage/pager"
import { usePageT } from "@/lib/songPage/pageCopy"

import { LyricsBody } from "./LyricsBody"
import { PronunciationChip } from "./Pronunciation"
import type { PageUi } from "./state"
import { TextOptionsButton } from "./TextOptions"
import { TranslationBody } from "./TranslationBody"
import type { SongPageModel } from "./useSongPageModel"
import { usePager, type PagerController } from "./usePager"
import { WordByWordBody } from "./WordByWord"

const TAB_LABEL: Record<BlockTab, "songPage.tab.lyrics" | "songPage.block.translation" | "songPage.lyrics.view.words"> = {
  lyrics: "songPage.tab.lyrics",
  translation: "songPage.block.translation",
  words: "songPage.lyrics.view.words",
}

/** The header: the label row and, under it, the row of page dots. */
const HEAD_ROW = 48
const DOTS_H = 28
/** The air above a page's first line and under its last. */
const PAGE_TOP = 10
const PAGE_FOOT = 28

/**
 * Section 1 of the page: ONE block of three pages side by side, Lyrics | Translation | Word by word. The header holds
 * the one-word name of the page, its place ("1/3"), the small "Aa" button (the text options popover) and the page
 * dots. The block is part of the page: it scrolls with it like any other section, whatever its height. A finger moving
 * sideways turns the pages (the sideways drag is one to one, the throw lands on the next page); a finger moving up or
 * down scrolls the page, on any of the three pages (see usePager.ts and lib/songPage/pager.ts). A dot also turns the
 * page. The pages' bodies are LyricsBody, TranslationBody and WordByWordBody.
 */
export function TextBlock({ t, model, ui, controller }: { t: SpTheme; model: SongPageModel; ui: PageUi; controller: MutableRefObject<PagerController | null> }) {
  const tr = usePageT()
  const { width: windowWidth } = useWindowDimensions()
  const [width, setWidth] = useState(windowWidth)
  const [heights, setHeights] = useState<number[]>(() => BLOCK_TABS.map(() => 0))
  const index = blockIndexOf(ui.blockTab)
  const { setBlockTab } = ui
  const onPage = useCallback((i: number) => setBlockTab(blockTabAt(i)), [setBlockTab])
  const pager = usePager({ width, heights, onPage })
  const { goTo } = pager
  useEffect(() => {
    controller.current = { goTo }
    return () => {
      controller.current = null
    }
  }, [controller, goTo])

  const measure = (i: number) => (event: LayoutChangeEvent) => {
    const h = Math.round(event.nativeEvent.layout.height)
    setHeights((list) => (list[i] === h ? list : list.map((v, k) => (k === i ? h : v))))
  }
  const labels = BLOCK_TABS.map((id) => tr(TAB_LABEL[id]))
  const current = labels[index] ?? ""

  return (
    <View>
      <View style={styles.head}>
        <View style={styles.headRow}>
          <Animated.View key={ui.blockTab} entering={FadeIn.duration(150)} style={styles.name} accessibilityRole="header">
            <Text style={[styles.nameText, { color: t.ink900 }]} numberOfLines={1}>
              {current}
            </Text>
            <Text style={[styles.place, { color: t.ink500 }]}>{`${index + 1}/${PAGE_COUNT}`}</Text>
          </Animated.View>
          <View style={styles.tools}>
            {BLOCK_TABS[index] === "lyrics" ? <PronunciationChip t={t} ui={ui} /> : null}
            <TextOptionsButton t={t} ui={ui} />
          </View>
        </View>
        <View accessibilityRole="tablist" accessibilityLabel={tr("songPage.block.a11y")} style={styles.dots}>
          <View style={styles.dotTrack}>
            {labels.map((label, i) => (
              <SpPress
                key={BLOCK_TABS[i]}
                onPress={() => (i !== index ? goTo(i) : undefined)}
                accessibilityRole="tab"
                accessibilityLabel={`${label}, ${i + 1}/${PAGE_COUNT}`}
                accessibilityState={{ selected: i === index }}
                pressedScale={0.9}
                hitSlop={{ top: 8, bottom: 8 }}
                style={[styles.slot, { left: i * DOT_STEP }]}
              >
                <View style={[styles.dot, { backgroundColor: t.sand400 }]} />
              </SpPress>
            ))}
            <Animated.View pointerEvents="none" style={[styles.mark, { backgroundColor: t.action }, pager.markStyle]} />
          </View>
        </View>
      </View>
      {/* `pan-y` keeps the vertical scroll with the browser; only a clear sideways drag reaches the pager */}
      <GestureDetector gesture={pager.gesture} touchAction="pan-y">
        <Animated.View style={[styles.window, pager.windowStyle]} onLayout={(event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width))}>
          <Animated.View style={[styles.row, { width: width * PAGE_COUNT }, pager.rowStyle]}>
            {BLOCK_TABS.map((id, i) => (
              <View
                key={id}
                onLayout={measure(i)}
                style={[styles.page, { width, paddingTop: PAGE_TOP, paddingBottom: PAGE_FOOT }]}
                accessibilityElementsHidden={i !== index}
                importantForAccessibility={i === index ? "auto" : "no-hide-descendants"}
              >
                {id === "lyrics" ? <LyricsBody t={t} model={model} ui={ui} /> : id === "translation" ? <TranslationBody t={t} model={model} ui={ui} /> : <WordByWordBody t={t} model={model} ui={ui} />}
              </View>
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 20 },
  headRow: { height: HEAD_ROW, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tools: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, flexDirection: "row", alignItems: "baseline", gap: 8 },
  nameText: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 26 },
  place: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  dots: { height: DOTS_H, alignItems: "center", justifyContent: "center" },
  dotTrack: { width: DOT_STEP * PAGE_COUNT, height: DOTS_H },
  slot: { position: "absolute", top: 0, width: DOT_STEP, height: DOTS_H, alignItems: "center", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  mark: { position: "absolute", left: (DOT_STEP - 18) / 2, top: (DOTS_H - 6) / 2, width: 18, height: 6, borderRadius: 3 },
  window: { overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "flex-start" },
  page: { overflow: "hidden" },
})
