import { StyleSheet, Text, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { lyricsLayout } from "@/lib/songPage/pageSections"
import { usePageT } from "@/lib/songPage/pageCopy"

import { LyricsReader } from "./LyricsReader"
import type { PageUi } from "./state"
import { QuietNote } from "./ui"
import type { SongPageModel } from "./useSongPageModel"
import { useReadingSplit } from "./useReadingSplit"

/**
 * THE LYRICS TAB (variant G, "Reading strip"). The lyrics stand clean, large, stanza by stanza, with no
 * translation under the lines (LyricsReader.tsx). The translation lives in the strip at the bottom of the screen
 * (ReadingStrip.tsx), which follows the stanza in the middle of the screen. Nothing else is drawn here: no title and
 * no controls (the tabs and the "Aa" options belong to the block around it, TextBlock.tsx).
 */
export function LyricsBody({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const layout = lyricsLayout(model.facts, ui.translationOn)
  const split = useReadingSplit(model, ui.translationOn)
  if (layout.kind === "empty") return <QuietNote t={t}>{tr("songPage.lyrics.empty")}</QuietNote>
  return (
    <View style={styles.body}>
      <LyricsReader t={t} blocks={model.structure.blocks} script={model.lines.primaryScript} scale={ui.scale} split={split} />
      {split.kind === "whole" ? <Text style={[styles.note, { color: t.ink500 }]}>{tr("songPage.lyrics.expand.note")}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, marginTop: 20 },
})
