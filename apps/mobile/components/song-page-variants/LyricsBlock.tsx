import { useMemo } from "react"
import { StyleSheet, View } from "react-native"

import { SpChip } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { splitWords } from "@/lib/songPage/chordChart"
import { useVariantT } from "@/lib/songPageVariants/copy"
import { repeatsOf } from "@/lib/songPageVariants/stanzas"

import { LyricLines, WordTray } from "./Lyrics"
import { scriptName } from "./Sheets"
import type { PageUi } from "./state"
import { QuietNote } from "./ui"
import type { SongVariantModel } from "./useSongVariantModel"

const SIZE_KEYS = ["songVariant.lyrics.size.small", "songVariant.lyrics.size.medium", "songVariant.lyrics.size.large"] as const

/** The chips over the lyrics: script, text size and (only when real word meanings exist) Words. */
export function LyricsToolbar({ t, model, ui, wordsChip, children }: { t: SpTheme; model: SongVariantModel; ui: PageUi; wordsChip: boolean; children?: React.ReactNode }) {
  const tr = useVariantT()
  return (
    <View style={styles.toolbar}>
      {children}
      <SpChip t={t} size="sm" label={scriptName(tr, model.lines.primaryScript)} trailingIcon="chevDown" onPress={() => ui.setSheet("script")} />
      <SpChip t={t} size="sm" label={tr("songVariant.lyrics.size")} onPress={ui.cycleScale} />
      {wordsChip ? <SpChip t={t} size="sm" label={tr("songVariant.lyrics.words")} on={ui.wordsOn} onPress={() => ui.setWordsOn(!ui.wordsOn)} /> : null}
    </View>
  )
}

/** The one lyrics block: bold lines, grey repeats, tap-only word meanings where they exist, optional pairs under each line. */
export function LyricsBlock({
  t,
  model,
  ui,
  pairs,
  from = 0,
  to,
  showNote,
}: {
  t: SpTheme
  model: SongVariantModel
  ui: PageUi
  pairs?: string[] | null
  from?: number
  to?: number
  showNote?: boolean
}) {
  const tr = useVariantT()
  const all = model.lines.primary
  const last = to ?? all.length - 1
  const lines = useMemo(() => all.slice(from, last + 1), [all, from, last])
  const repeats = useMemo(() => repeatsOf(all).slice(from, last + 1), [all, from, last])
  if (!all.length) return <QuietNote t={t}>{tr("songVariant.lyrics.empty")}</QuietNote>
  const glossOf = ui.wordsOn && model.glosses ? (l: number, w: number) => model.glossOf(from + l, w) : null
  const selectedHere = (() => {
    if (!ui.selected) return null
    const [l = "", w = ""] = ui.selected.split("-")
    const line = Number(l)
    return line >= from && line <= last ? `${line - from}-${w}` : null
  })()
  return (
    <View style={styles.block}>
      <LyricLines
        t={t}
        lines={lines}
        script={model.lines.primaryScript}
        scale={ui.scale}
        repeats={repeats}
        pairs={pairs ?? null}
        glossOf={glossOf}
        selected={selectedHere}
        onSelect={(key) => {
          if (!key) return ui.setSelected(null)
          const [l = "", w = ""] = key.split("-")
          ui.setSelected(`${from + Number(l)}-${w}`)
        }}
      />
      {showNote ? <QuietNote t={t}>{tr("songVariant.lyrics.noWords")}</QuietNote> : null}
    </View>
  )
}

/** The tray with the meaning of the tapped word (only ever opens for a word that has a real one). */
export function WordOverlay({ t, model, ui, bottom }: { t: SpTheme; model: SongVariantModel; ui: PageUi; bottom: number }) {
  if (!ui.selected) return null
  const [l = "", w = ""] = ui.selected.split("-")
  const word = splitWords(model.lines.primary[Number(l)] ?? "")[Number(w)] ?? ""
  const meaning = model.glossOf(Number(l), Number(w))
  if (!word || !meaning) return null
  return <WordTray t={t} word={word} meaning={meaning} bottom={bottom} onClose={() => ui.setSelected(null)} />
}

export { SIZE_KEYS }

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  block: { paddingHorizontal: 20 },
})
