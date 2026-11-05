import { StyleSheet, Text, View } from "react-native"

import { ActionsSheet } from "@/components/player-v2/ActionsSheet"
import { ShareSheet } from "@/components/player-v2/ShareSheet"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpSheet } from "@/components/song-v2/SpSheet"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import type { PageSection } from "@/lib/songPage/pageSections"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"
import type { ScriptId } from "@/lib/songPage/scripts"

import { songTitle } from "./Hero"
import { MeaningLanguageSheet } from "./Meaning"
import type { PageUi } from "./state"
import { ChevronRow } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

const SCRIPT_IDS: ScriptId[] = ["roman", "devanagari", "bengali"]

export function scriptName(tr: PageT, id: ScriptId): string {
  return tr(`songPage.script.${id}`)
}

/** Which script the lyrics are shown in: only the scripts this song has can be picked. */
function ScriptSheet({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const current = model.lines.primaryScript
  return (
    <SpSheet t={t} visible={ui.sheet === "script"} onClose={() => ui.setSheet(null)} label={tr("songPage.script.title")}>
      <Text style={[styles.title, { color: t.ink900 }]}>{tr("songPage.script.title")}</Text>
      {SCRIPT_IDS.map((id) => {
        const has = model.scripts.includes(id)
        const on = has && current === id
        return (
          <SpPress
            key={id}
            disabled={!has}
            onPress={() => {
              model.setScript(id)
              ui.setSheet(null)
            }}
            accessibilityLabel={`${scriptName(tr, id)}${has ? "" : `. ${tr("songPage.script.missing")}`}`}
            accessibilityState={{ selected: on, disabled: !has }}
            style={styles.row}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowName, { color: has ? t.ink900 : t.ink500 }]}>{scriptName(tr, id)}</Text>
              {has ? null : <Text style={[styles.rowSub, { color: t.ink500 }]}>{tr("songPage.script.missing")}</Text>}
            </View>
            {on ? <SpIcon name="check" size={22} color={t.orange500} strokeWidth={2.4} /> : null}
          </SpPress>
        )
      })}
      <View style={{ height: 8 }} />
    </SpSheet>
  )
}

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

/** Every sheet of the page: More, Share, Script, Translation language, the sections Menu. */
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
      <ScriptSheet t={t} model={model} ui={ui} />
      <MeaningLanguageSheet
        t={t}
        visible={ui.sheet === "language"}
        onClose={() => ui.setSheet(null)}
        rows={model.meaningRows}
        selected={model.meaning.wanted}
        onPick={(code) => model.setMeaningLanguage(code)}
      />
      <MenuSheet t={t} ui={ui} sections={sections} onPick={onJump} />
    </>
  )
}

const styles = StyleSheet.create({
  title: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 30, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 12 },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  rowSub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
})
