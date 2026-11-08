import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { activeLineKind, underLines, versionsOf } from "@/lib/songTranslations/derive"
import { usePageT } from "@/lib/songPage/pageCopy"

import { LyricsReader } from "./LyricsReader"
import type { PageUi } from "./state"
import { QuietNote } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/**
 * THE LYRICS PAGE. The lyrics stand clean and large, stanza by stanza (LyricsReader.tsx), in the script chosen in the
 * text options, with NO translation under the lines unless the reader chose one there ("Translation under each line":
 * Off, Literal or Poetic). A translation that was written for the whole song cannot be set under single lines: the
 * page says so and keeps the lyrics as they are. Nothing else is drawn here: no title and no controls (the pages and
 * the "Aa" options belong to the block around it, TextBlock.tsx).
 */
export function LyricsBody({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const lineCount = model.structure.lines.length
  const kind = activeLineKind(ui.lineTranslation, model.translations.kinds)
  const chosen = useMemo(() => versionsOf(model.translations.items, kind)[0] ?? null, [model.translations.items, kind])
  const under = useMemo(() => (kind ? underLines(chosen, lineCount) : ({ kind: "none" } as const)), [kind, chosen, lineCount])
  if (!model.facts.hasLyrics) return <QuietNote t={t}>{tr("songPage.lyrics.empty")}</QuietNote>
  return (
    <View style={styles.body}>
      <LyricsReader t={t} blocks={model.structure.blocks} script={model.lines.primaryScript} scale={ui.scale} under={under.kind === "lines" ? under.under : null} />
      {kind && under.kind === "whole" ? <Text style={[styles.note, { color: t.ink500 }]}>{tr("songPage.lyrics.underline.whole")}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, marginTop: 20 },
})
