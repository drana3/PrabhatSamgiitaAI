import { StyleSheet, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { WORDS_MODES, type WordsMode } from "@/lib/songPage/songTabs"
import { usePageT } from "@/lib/songPage/pageCopy"

import { CentralIdea, Explanation } from "./About"
import type { PageUi } from "./state"
import { TextOptionsButton } from "./TextOptions"
import { TranslationBody } from "./TranslationBody"
import { Segmented, type SegItem } from "./ui"
import type { SongPageModel } from "./useSongPageModel"
import { WordByWordBody } from "./WordByWord"

/**
 * Tab 2, Meaning (it was called Words until 11 November 2026): where the meaning of the song lives. Two switches
 * inside it. "Translation": the central idea of the song, then the one translation (Official, or the only kind there is),
 * then the explanation of the song. "Word by word": each word over its meaning; the language of the meanings is chosen
 * behind the round "Aa" button (the tab itself carries only a small line that names the language now).
 */
export function MeaningTab({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const items: Array<SegItem<WordsMode>> = WORDS_MODES.map((id) => ({ id, label: tr(id === "translation" ? "songWords.mode.translation" : "songWords.mode.words") }))
  const wordByWord = ui.wordsMode === "words"
  return (
    <View>
      <View style={styles.head}>
        <Segmented t={t} items={items} value={ui.wordsMode} onChange={ui.setWordsMode} label={tr("songWords.mode.a11y")} role="tab" fit style={styles.mode} />
        <TextOptionsButton t={t} ui={ui} wordLanguage={wordByWord} />
      </View>
      {wordByWord ? (
        <WordByWordBody t={t} model={model} ui={ui} />
      ) : (
        <>
          {model.meaning.central ? (
            <View style={styles.pad}>
              <CentralIdea t={t} tr={tr} model={model} />
            </View>
          ) : null}
          <TranslationBody t={t} model={model} ui={ui} />
          <View style={styles.pad}>
            <Explanation t={t} tr={tr} model={model} />
          </View>
        </>
      )}
      <View style={{ height: 24 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  mode: { flex: 1 },
  pad: { paddingHorizontal: 20 },
})
