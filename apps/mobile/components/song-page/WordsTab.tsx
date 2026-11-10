import { StyleSheet, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { WORDS_MODES, type WordsMode } from "@/lib/songPage/songTabs"
import { usePageT } from "@/lib/songPage/pageCopy"

import { Explanation } from "./About"
import type { PageUi } from "./state"
import { TextOptionsButton } from "./TextOptions"
import { TranslationBody } from "./TranslationBody"
import { Segmented, type SegItem } from "./ui"
import type { SongPageModel } from "./useSongPageModel"
import { WordByWordBody } from "./WordByWord"

/**
 * Tab 2, Words: where the meaning of the song lives. Two switches inside it. The top one picks what to read:
 * "Translation" (the whole text of the song, one kind at a time: Official, Poetic or Literal, only the kinds this song has,
 * with the commentary and the explanation under the text) or "Word by word" (each word over its meaning, with the choice
 * of language). The "Aa" button is the same as in Lyrics: size and script apply here too.
 */
export function WordsTab({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const items: Array<SegItem<WordsMode>> = WORDS_MODES.map((id) => ({ id, label: tr(id === "translation" ? "songWords.mode.translation" : "songWords.mode.words") }))
  return (
    <View>
      <View style={styles.head}>
        <Segmented t={t} items={items} value={ui.wordsMode} onChange={ui.setWordsMode} label={tr("songWords.mode.a11y")} role="tab" fit style={styles.mode} />
        <TextOptionsButton t={t} ui={ui} />
      </View>
      {ui.wordsMode === "translation" ? (
        <>
          <TranslationBody t={t} model={model} ui={ui} />
          <View style={styles.explain}>
            <Explanation t={t} tr={tr} model={model} />
          </View>
        </>
      ) : (
        <WordByWordBody t={t} model={model} ui={ui} />
      )}
      <View style={{ height: 24 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  mode: { flex: 1 },
  explain: { paddingHorizontal: 20 },
})
