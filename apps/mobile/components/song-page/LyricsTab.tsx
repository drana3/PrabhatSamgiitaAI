import { StyleSheet, Text, View } from "react-native"

import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { activeLineKind } from "@/lib/songTranslations/derive"
import { usePageT } from "@/lib/songPage/pageCopy"

import { LyricsBody } from "./LyricsBody"
import type { PageUi } from "./state"
import { TextOptionsButton } from "./TextOptions"
import type { SongPageModel } from "./useSongPageModel"

/**
 * Tab 1, Lyrics: the lyrics, large and clean. One "Aa" button on the right holds every text setting (size, script,
 * the translation under each line, pronunciation). When the song has a translation and none is shown under the lines,
 * a quiet line says where it lives: in the Words tab, with a button that goes there.
 */
export function LyricsTab({ t, model, ui, onOpenWords }: { t: SpTheme; model: SongPageModel; ui: PageUi; onOpenWords: () => void }) {
  const tr = usePageT()
  const hasTranslation = model.translations.kinds.length > 0
  const underOn = activeLineKind(ui.lineTranslation, model.translations.kinds) !== null
  const showWhere = hasTranslation && !underOn
  return (
    <View>
      <View style={styles.head}>
        <View style={styles.where}>
          {showWhere ? (
            <SpPress onPress={onOpenWords} accessibilityLabel={`${tr("songLyr.where")} ${tr("songLyr.where.open")}`} pressedScale={0.98} style={styles.whereHit}>
              <Text style={[styles.whereText, { color: t.ink500 }]} numberOfLines={2}>
                {tr("songLyr.where")}
              </Text>
              <View style={styles.go}>
                <Text style={[styles.goText, { color: t.accentText }]}>{tr("songLyr.where.open")}</Text>
                <SpIcon name="chevRight" size={16} color={t.accentText} strokeWidth={2.2} />
              </View>
            </SpPress>
          ) : null}
        </View>
        <TextOptionsButton t={t} ui={ui} />
      </View>
      <LyricsBody t={t} model={model} ui={ui} />
      <View style={{ height: 24 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  where: { flex: 1, minHeight: 44, justifyContent: "center" },
  whereHit: { gap: 2, minHeight: 44, justifyContent: "center" },
  whereText: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  go: { flexDirection: "row", alignItems: "center", gap: 2 },
  goText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20 },
})
