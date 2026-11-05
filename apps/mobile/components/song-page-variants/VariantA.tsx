import { useCallback, useMemo, useRef, useState } from "react"
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import type Animated from "react-native-reanimated"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useVariantT } from "@/lib/songPageVariants/copy"
import { variantLayout } from "@/lib/songPageVariants/layout"

import { AboutBody } from "./About"
import { Actions, BannerHero, bannerHeight, songTitle } from "./Hero"
import { LyricsBlock, LyricsToolbar, WordOverlay } from "./LyricsBlock"
import { MeaningBlock, MeaningHeader } from "./Meaning"
import { PlayPanel } from "./Play"
import { PageSheets } from "./Sheets"
import { Shell, useBarHeight } from "./Shell"
import { usePageUi } from "./state"
import { Eyebrow, TextTabs } from "./ui"
import type { SongVariantModel } from "./useSongVariantModel"
import { WatchPanel } from "./Watch"
import { SpChip } from "@/components/song-v2/SpUi"

type Section = "read" | "play" | "watch" | "about"
const STRIP = 49

/** A "Pairs": one long page with tabs that jump to Read, Play, Watch, About; the meaning sits under each line when it lines up. */
export function VariantA({ t, model }: { t: SpTheme; model: SongVariantModel }) {
  const tr = useVariantT()
  const ui = usePageUi()
  const bar = useBarHeight()
  const layout = useMemo(() => variantLayout("a", model.facts), [model.facts])
  const [withMeaning, setWithMeaning] = useState(true)
  const [active, setActive] = useState<Section>("read")
  const tops = useRef<Record<string, number>>({})
  const scrollRef = useRef<Animated.ScrollView | null>(null)
  const sections = layout.tabs as Section[]

  const place = (id: Section) => (event: LayoutChangeEvent) => {
    tops.current[id] = event.nativeEvent.layout.y
  }
  const go = (id: Section) => {
    setActive(id)
    const y = (tops.current[id] ?? 0) - bar - STRIP + 1
    ;(scrollRef.current as unknown as { scrollTo: (o: { y: number; animated: boolean }) => void } | null)?.scrollTo({ y: Math.max(0, y), animated: true })
  }
  const follow = useCallback(
    (y: number) => {
      let current: Section = sections[0] ?? "read"
      for (const id of sections) if ((tops.current[id] ?? 0) - bar - STRIP - 48 <= y) current = id
      setActive((prev) => (prev === current ? prev : current))
    },
    [sections, bar],
  )

  const showMeaning = layout.meaningToggle && withMeaning
  const pairs = showMeaning && layout.meaning === "pairs" && model.align.kind === "pairs" ? model.align.pairs.map((p) => p.meaning) : null
  const stackedNote = layout.stackedNote ? tr("songVariant.meaning.stackedNote") : null
  const items = sections.map((id) => ({ id, label: tr(`songVariant.tab.${id}` as "songVariant.tab.read") }))

  return (
    <Shell
      t={t}
      model={model}
      title={songTitle(model)}
      top="photo"
      heroHeight={bannerHeight(bar)}
      hero={
        <>
          <BannerHero t={t} model={model} />
          <Actions t={t} model={model} />
        </>
      }
      strip={<TextTabs t={t} items={items} active={active} onSelect={go} />}
      stripHeight={STRIP}
      scrollRef={scrollRef}
      onScrollJS={follow}
      onMore={() => model.setSheet("actions")}
      overlay={<WordOverlay t={t} model={model} ui={ui} bottom={96} />}
      sheets={<PageSheets t={t} model={model} ui={ui} />}
    >
      <View onLayout={place("read")} style={styles.section}>
        <LyricsToolbar t={t} model={model} ui={ui} wordsChip={layout.wordsChip}>
          {layout.meaningToggle ? (
            <SpChip t={t} size="sm" label={showMeaning ? tr("songVariant.lyrics.withMeaning") : tr("songVariant.lyrics.only")} on={showMeaning} onPress={() => setWithMeaning(!withMeaning)} />
          ) : null}
        </LyricsToolbar>
        {showMeaning ? <MeaningHeader t={t} meaning={model.meaning} onChange={() => ui.setSheet("meaning")} /> : null}
        <LyricsBlock t={t} model={model} ui={ui} pairs={pairs} showNote={layout.wordsNote && model.lines.primary.length > 0} />
        {showMeaning && layout.meaning === "stacked" ? (
          <View style={styles.stacked}>
            <MeaningBlock t={t} meaning={model.meaning} note={stackedNote} />
          </View>
        ) : null}
      </View>

      <View onLayout={place("play")} style={styles.section}>
        <Eyebrow t={t} style={styles.eyebrow}>{tr("songVariant.tab.play")}</Eyebrow>
        <PlayPanel t={t} model={model} />
      </View>

      <View onLayout={place("watch")} style={styles.section}>
        <Eyebrow t={t} style={styles.eyebrow}>{tr("songVariant.tab.watch")}</Eyebrow>
        <WatchPanel t={t} model={model} />
      </View>

      <View onLayout={place("about")} style={styles.section}>
        <Text style={[styles.h, { color: t.ink900 }]}>{tr("songVariant.about.title")}</Text>
        <AboutBody t={t} model={model} />
      </View>
    </Shell>
  )
}

const styles = StyleSheet.create({
  section: { paddingTop: 28 },
  eyebrow: { paddingHorizontal: 20, paddingBottom: 12 },
  stacked: { paddingHorizontal: 20, paddingTop: 24 },
  h: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 30, paddingHorizontal: 20, paddingBottom: 8 },
})
