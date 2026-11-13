import { useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"

import { SpSheet } from "@/components/song-v2/SpSheet"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { toggleCode } from "@/lib/songPage/languages"
import { usePageT } from "@/lib/songPage/pageCopy"
import { useSongLanguagesStore } from "@/stores/songLanguagesStore"

import { LanguageList } from "./LanguageList"
import type { PageUi } from "./state"
import { Segmented, type SegItem } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/** The word languages that count now: the chosen ones the song has, or the one the page shows. */
export function effectiveWordLanguages(chosen: readonly string[], model: SongPageModel): string[] {
  const have = chosen.filter((c) => model.wordLanguages.includes(c))
  return have.length ? have : model.wordLanguages.length ? [model.wordLanguage] : []
}

/** Toggles a word language: the page shows the first one. */
export function useWordLanguageToggle(model: SongPageModel) {
  const chosen = useSongLanguagesStore((s) => s.wordLanguages)
  return (code: string) => {
    // the base of a change is what is on screen, so a first tap changes what the person sees
    const next = toggleCode(effectiveWordLanguages(chosen, model), code)
    useSongLanguagesStore.setState({ wordLanguages: next })
    if (next[0]) model.setWordLanguage(next[0])
  }
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 24 },
  title: { fontFamily: amFonts.bold, fontSize: 22, lineHeight: 28 },
  make: { minHeight: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginTop: 16 },
  makeText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
})

/** THE LANGUAGES SHEET: opened from the Aa popover; word meanings and translation as two layers of one list of languages. */
export function LanguagesSheet({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const open = ui.sheet === "languages"
  const [layer, setLayer] = useState<"words" | "translation">("words")
  const wordChoice = useSongLanguagesStore((s) => s.wordLanguages)
  const translationLanguages = useSongLanguagesStore((s) => s.translationLanguages)
  const toggleTranslation = useSongLanguagesStore((s) => s.toggleTranslationLanguage)
  const toggleWord = useWordLanguageToggle(model)
  const translationAvailable = useMemo(() => [...new Set(model.translations.items.filter((i) => i.text.trim()).map((i) => i.language))], [model.translations])
  const items: Array<SegItem<"words" | "translation">> = [
    { id: "words", label: tr("lang.layer.words") },
    { id: "translation", label: tr("lang.layer.translation") },
  ]
  return (
    <SpSheet t={t} visible={open} onClose={() => ui.setSheet(null)} label={tr("lang.title")} testID="languages-sheet">
      <View style={styles.body}>
        <Text style={[styles.title, { color: t.ink900 }]} accessibilityRole="header">{tr("lang.title")}</Text>
        <View style={{ marginTop: 12 }}>
          <Segmented t={t} items={items} value={layer} onChange={setLayer} label={tr("lang.title")} role="tab" fit />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          {layer === "words" ? (
            <LanguageList t={t} tr={tr} available={model.wordLanguages} chosen={effectiveWordLanguages(wordChoice, model)} onToggle={toggleWord} />
          ) : (
            <LanguageList t={t} tr={tr} available={translationAvailable} chosen={translationLanguages.filter((c) => translationAvailable.includes(c))} onToggle={toggleTranslation} />
          )}
        </ScrollView>
        <SpPress onPress={() => ui.setSheet(null)} accessibilityLabel={tr("lang.done")} pressedScale={0.97} style={[styles.make, { backgroundColor: t.action }]}>
          <Text style={[styles.makeText, { color: t.onAction }]}>{tr("lang.done")}</Text>
        </SpPress>
      </View>
    </SpSheet>
  )
}
