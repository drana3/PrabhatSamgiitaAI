import { StyleSheet, Text, View } from "react-native"

import { ActionsSheet } from "@/components/player-v2/ActionsSheet"
import { ShareSheet } from "@/components/player-v2/ShareSheet"
import { AboutBody } from "./About"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpSheet } from "@/components/song-v2/SpSheet"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useVariantT } from "@/lib/songPageVariants/copy"
import type { ScriptId } from "@/lib/songPage/scripts"

import { MeaningLanguageSheet } from "./Meaning"
import { PlayPanel } from "./Play"
import { songTitle } from "./Hero"
import type { PageUi } from "./state"
import type { SongVariantModel } from "./useSongVariantModel"
import { WatchPanel } from "./Watch"

const SCRIPT_IDS: ScriptId[] = ["roman", "devanagari", "bengali"]

export function scriptName(tr: ReturnType<typeof useVariantT>, id: ScriptId): string {
  return tr(`songVariant.script.${id}`)
}

/** Which script the lyrics are shown in: only the scripts this song has can be picked. */
export function ScriptSheet({ t, model, ui }: { t: SpTheme; model: SongVariantModel; ui: PageUi }) {
  const tr = useVariantT()
  const current = model.lines.primaryScript
  return (
    <SpSheet t={t} visible={ui.sheet === "script"} onClose={() => ui.setSheet(null)} label={tr("songVariant.script.title")}>
      <Text style={[styles.title, { color: t.ink900 }]}>{tr("songVariant.script.title")}</Text>
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
            accessibilityLabel={`${scriptName(tr, id)}${has ? "" : `. ${tr("songVariant.script.missing")}`}`}
            accessibilityState={{ selected: on, disabled: !has }}
            style={styles.row}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowName, { color: has ? t.ink900 : t.ink500 }]}>{scriptName(tr, id)}</Text>
              {has ? null : <Text style={[styles.rowSub, { color: t.ink500 }]}>{tr("songVariant.script.missing")}</Text>}
            </View>
            {on ? <SpIcon name="check" size={22} color={t.orange500} strokeWidth={2.4} /> : null}
          </SpPress>
        )
      })}
      <View style={{ height: 8 }} />
    </SpSheet>
  )
}

function ContentSheet({ t, visible, onClose, title, children }: { t: SpTheme; visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <SpSheet t={t} visible={visible} onClose={onClose} label={title}>
      <Text style={[styles.title, { color: t.ink900 }]}>{title}</Text>
      {children}
      <View style={{ height: 16 }} />
    </SpSheet>
  )
}

/** Every sheet of the page. Which of them can open depends on the variant (A and B open only More, Share, Script, Meaning language). */
export function PageSheets({ t, model, ui }: { t: SpTheme; model: SongVariantModel; ui: PageUi }) {
  const tr = useVariantT()
  const song = model.song
  if (!song) return null
  const close = () => ui.setSheet(null)
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
        visible={ui.sheet === "meaning"}
        onClose={close}
        rows={model.meaningRows}
        selected={model.meaning.wanted}
        onPick={(code) => model.setMeaningLanguage(code)}
      />
      <ContentSheet t={t} visible={ui.sheet === "about"} onClose={close} title={tr("songVariant.about.title")}>
        <AboutBody t={t} model={model} />
      </ContentSheet>
      <ContentSheet t={t} visible={ui.sheet === "play"} onClose={close} title={tr("songVariant.play.title")}>
        <PlayPanel t={t} model={model} />
      </ContentSheet>
      <ContentSheet t={t} visible={ui.sheet === "watch"} onClose={close} title={tr("songVariant.watch.title")}>
        <WatchPanel t={t} model={model} />
      </ContentSheet>
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
