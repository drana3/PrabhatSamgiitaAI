import { StyleSheet, Text, View } from "react-native"

import { SpSheet } from "@/components/song-v2/SpSheet"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { activeLineKind, lineKinds, type LineKind } from "@/lib/songTranslations/derive"
import { usePageT } from "@/lib/songPage/pageCopy"

import { OptionRow, OptionTick } from "./OptionRow"
import type { PageUi } from "./state"
import { lineChoiceLabel } from "./TextOptions"
import type { SongPageModel } from "./useSongPageModel"

/**
 * THE CHOICE OF THE TRANSLATION UNDER EACH LINE: a small sheet opened from the Aa window. One row per choice (Off, and
 * Literal or Poetic when the song has them), the chosen one ticked; a tap picks it and closes the sheet.
 */
export function LineTranslationSheet({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const open = ui.sheet === "lineTranslation"
  const kinds = lineKinds(model.translations.kinds)
  const value = activeLineKind(ui.lineTranslation, model.translations.kinds) ?? "off"
  const ids: Array<"off" | LineKind> = ["off", ...kinds]
  const pick = (id: "off" | LineKind) => {
    ui.setLineTranslation(id)
    ui.setSheet(null)
  }
  return (
    <SpSheet t={t} visible={open} onClose={() => ui.setSheet(null)} label={tr("songPage.options.translation")} testID="line-translation-sheet">
      <View style={styles.body}>
        <Text style={[styles.title, { color: t.ink900 }]} accessibilityRole="header">
          {tr("songPage.options.translation")}
        </Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={tr("songPage.options.translation")}>
          {ids.map((id) => (
            <OptionRow key={id} t={t} label={lineChoiceLabel(tr, id)} role="radio" selected={id === value} onPress={() => pick(id)}>
              <OptionTick t={t} on={id === value} />
            </OptionRow>
          ))}
        </View>
      </View>
    </SpSheet>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 24 },
  title: { fontFamily: amFonts.bold, fontSize: 22, lineHeight: 28, paddingBottom: 8 },
})
