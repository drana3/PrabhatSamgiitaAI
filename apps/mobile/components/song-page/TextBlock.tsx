import { StyleSheet, View } from "react-native"
import Animated, { FadeIn } from "react-native-reanimated"

import type { SpTheme } from "@/constants/tokens/amSong"
import { BLOCK_TABS, type BlockTab } from "@/lib/songPage/blockTabs"
import { usePageT } from "@/lib/songPage/pageCopy"

import { CommentaryBody } from "./Commentary"
import { LyricsBody } from "./LyricsBody"
import { useReadingStore } from "./readingState"
import type { PageUi } from "./state"
import { TextOptionsButton } from "./TextOptions"
import { Segmented, type SegItem } from "./ui"
import type { SongPageModel } from "./useSongPageModel"
import { WordByWordBody } from "./WordByWord"

const TAB_LABEL: Record<BlockTab, "songPage.tab.lyrics" | "songPage.tab.meaning" | "songPage.lyrics.view.words"> = {
  lyrics: "songPage.tab.lyrics",
  commentary: "songPage.tab.meaning",
  words: "songPage.lyrics.view.words",
}

/**
 * Section 1 of the page: ONE block with three tabs, Lyrics | Commentary | Word by word, and the small "Aa" button
 * (the text options popover) in the same row. The body under the switch is the tab's own component: LyricsBody
 * (swappable, see its file), CommentaryBody, WordByWordBody. Nothing about the lyrics' look lives here.
 */
export function TextBlock({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const reading = useReadingStore()
  const items: Array<SegItem<BlockTab>> = BLOCK_TABS.map((id) => ({ id, label: tr(TAB_LABEL[id]) }))
  const tab = model.facts.hasLyrics || ui.blockTab !== "words" ? ui.blockTab : "lyrics"
  return (
    <View>
      <View style={styles.head}>
        <Segmented
          t={t}
          items={items}
          value={tab}
          onChange={(id) => ui.setBlockTab(id)}
          label={tr("songPage.block.a11y")}
          role="tab"
          fit
          style={styles.seg}
        />
        <TextOptionsButton t={t} ui={ui} />
      </View>
      <Animated.View key={tab} entering={FadeIn.duration(200)} style={styles.body} onLayout={(event) => reading?.setBodyY(event.nativeEvent.layout.y)}>
        {tab === "lyrics" ? <LyricsBody t={t} model={model} ui={ui} /> : tab === "commentary" ? <CommentaryBody t={t} model={model} /> : <WordByWordBody t={t} model={model} ui={ui} />}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingBottom: 16 },
  seg: { flex: 1 },
  body: { minHeight: 80 },
})
