import { StyleSheet, Text, View } from "react-native"

import { ActionsSheet } from "@/components/player-v2/ActionsSheet"
import { ShareSheet } from "@/components/player-v2/ShareSheet"
import { SpSheet } from "@/components/song-v2/SpSheet"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import type { PageSection } from "@/lib/songPage/pageSections"
import { usePageT } from "@/lib/songPage/pageCopy"

import { songTitle } from "./Hero"
import { PronunciationSheet } from "./Pronunciation"
import { TextOptionsPopover } from "./TextOptions"
import type { PageUi } from "./state"
import { ChevronRow } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/** The top Menu: only the sections this song has, each one a row that scrolls the page to it. */
function MenuSheet({ t, ui, sections, onPick }: { t: SpTheme; ui: PageUi; sections: readonly PageSection[]; onPick: (id: PageSection) => void }) {
  const tr = usePageT()
  return (
    <SpSheet t={t} visible={ui.sheet === "menu"} onClose={() => ui.setSheet(null)} label={tr("songPage.menu.title")}>
      <Text style={[styles.title, { color: t.ink900 }]}>{tr("songPage.menu.title")}</Text>
      {sections.map((id, i) => (
        <ChevronRow
          key={id}
          t={t}
          title={tr(`songPage.tab.${id}`)}
          last={i === sections.length - 1}
          onPress={() => {
            ui.setSheet(null)
            onPick(id)
          }}
        />
      ))}
      <View style={{ height: 8 }} />
    </SpSheet>
  )
}

/** Every sheet of the page: More, Share, the sections Menu, and the text options popover (script, size, translation). */
export function PageSheets({ t, model, ui, sections, onJump }: { t: SpTheme; model: SongPageModel; ui: PageUi; sections: readonly PageSection[]; onJump: (id: PageSection) => void }) {
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
      <MenuSheet t={t} ui={ui} sections={sections} onPick={onJump} />
      <PronunciationSheet t={t} model={model} ui={ui} />
    </>
  )
}

const styles = StyleSheet.create({
  title: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 30, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
})
