import { ActionsSheet } from "@/components/player-v2/ActionsSheet"
import { ShareSheet } from "@/components/player-v2/ShareSheet"
import type { SpTheme } from "@/constants/tokens/amSong"

import { ChordSheets } from "./ChordSheets"
import { songTitle } from "./Hero"
import { LanguagesSheet, PdfSheet } from "./PdfSheet"
import { PronunciationSheet } from "./Pronunciation"
import { TextOptionsPopover } from "./TextOptions"
import type { PageUi } from "./state"
import type { SongPageModel } from "./useSongPageModel"

/** Every sheet of the page: More, Share, the text options popover (script, size, translation under the lines), the pronunciation sheet and the chords sheets (capo, members). */
export function PageSheets({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const song = model.song
  if (!song) return null
  return (
    <>
      <ActionsSheet
        visible={model.sheet === "actions"}
        theme={model.am}
        songNumber={song.number}
        title={songTitle(model)}
        subtitle={`PS ${song.number}`}
        rows={model.actionRows}
        onAction={model.onAction}
        onClose={() => model.setSheet(null)}
      />
      <ShareSheet
        visible={model.sheet === "share"}
        theme={model.am}
        songNumber={song.number}
        title={songTitle(model)}
        performer=""
        lyrics={song.lyrics}
        lyricsDevanagari={song.lyricsDevanagari}
        onShare={model.onShareTarget}
        onClose={() => model.setSheet(null)}
      />
      <TextOptionsPopover t={t} model={model} ui={ui} />
      <ChordSheets t={t} model={model} ui={ui} />
      <PronunciationSheet t={t} model={model} ui={ui} />
      <PdfSheet t={t} model={model} ui={ui} />
      <LanguagesSheet t={t} model={model} ui={ui} />
    </>
  )
}
