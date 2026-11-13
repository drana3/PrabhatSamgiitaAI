import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { SCRIPT_LABEL, type ScriptChoice, type ScriptId } from "@/lib/songPage/scripts"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { LYRIC_LANGUAGES } from "@/lib/songPage/lyricLanguages"
import type { Coverage } from "@/lib/songPage/translations"
import { versionDetail, type SongVersion } from "@/lib/songPage/versions"
import { useDownloadState } from "@/hooks/useDownloadState"
import { downloadPillLabel, type DownloadItem } from "@/lib/offline/downloadModel"

import { SpIcon } from "./SpIcon"
import { useT } from "@/lib/i18n"
import { SpSheet } from "./SpSheet"
import { note, over } from "./spType"
import { SpMark, SpPill, SpPress } from "./SpUi"

/** `.group`: white block, 20 radius, hairline, rows divided by a hairline. */
function Group({ t, children }: { t: SpTheme; children: ReactNode }) {
  return <View style={[styles.group, { backgroundColor: t.white, borderColor: t.sand300 }]}>{children}</View>
}

export function ShTitle({
  t,
  label,
  right,
  topPad,
}: {
  t: SpTheme
  label: string
  right?: ReactNode
  topPad?: boolean
}) {
  return (
    <View style={[styles.shTitle, topPad && { paddingTop: 20 }]}>
      <Text style={over(t)}>{label}</Text>
      {right}
    </View>
  )
}

export function DoneLink({ t, onPress }: { t: SpTheme; onPress: () => void }) {
  const tr = useT()
  return (
    <SpPress onPress={onPress} accessibilityLabel={tr("common.done")} style={styles.doneBtn}>
      <Text style={{ fontFamily: amFonts.semi, fontSize: 15, color: t.ink800 }}>{tr("common.done")}</Text>
    </SpPress>
  )
}

function Row({
  t,
  name,
  sub,
  on,
  kind,
  muted,
  action,
  onAction,
  last,
  onPress,
}: {
  t: SpTheme
  name: string
  sub: string
  on: boolean
  kind: "check" | "radio"
  muted?: boolean
  /** `.rq`: the orange word before the mark, e.g. "Request" */
  action?: string
  /** Makes the action word its own button, apart from the row (the row itself still selects) */
  onAction?: () => void
  last?: boolean
  onPress: () => void
}) {
  if (onAction && action) {
    return (
      <View style={[styles.lrow, !last && { borderBottomWidth: 1, borderBottomColor: t.sand300 }]}>
        <SpPress
          onPress={onPress}
          accessibilityLabel={`${name}. ${sub}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: on }}
          style={styles.lmPress}
        >
          <View style={styles.lm}>
            <Text style={[styles.lmB, { color: muted ? t.ink500 : t.ink800 }]}>{name}</Text>
            <Text style={[styles.lmS, { color: t.ink500 }]}>{sub}</Text>
          </View>
        </SpPress>
        <SpPress onPress={onAction} accessibilityLabel={`${action} ${name}`} style={styles.rqBtn}>
          <Text style={[styles.rq, { color: t.orange700 }]}>{action}</Text>
        </SpPress>
        <SpPress onPress={onPress} accessibilityLabel={`${name}. ${sub}`} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={styles.markPress}>
          <SpMark t={t} on={on} kind={kind} />
        </SpPress>
      </View>
    )
  }
  return (
    <SpPress
      onPress={onPress}
      accessibilityLabel={`${name}. ${sub}`}
      accessibilityRole={kind === "radio" ? "radio" : "checkbox"}
      accessibilityState={{ checked: on }}
      style={[styles.lrow, !last && { borderBottomWidth: 1, borderBottomColor: t.sand300 }]}
    >
      <View style={styles.lm}>
        <Text style={[styles.lmB, { color: muted ? t.ink500 : t.ink800 }]}>{name}</Text>
        <Text style={[styles.lmS, { color: t.ink500 }]}>{sub}</Text>
      </View>
      {action !== undefined ? <Text style={[styles.rq, { color: t.orange700 }]}>{action}</Text> : null}
      <SpMark t={t} on={on} kind={kind} />
    </SpPress>
  )
}

const STATE_TEXT: Record<Coverage, string> = {
  full: "Lines and word meanings",
  lines: "Lines only",
  meaning: "Meaning only",
  none: "Not added yet",
}

/** Language sheet: script rows (radio), then the one list of lyric languages (check, up to two), the note, Done. */
export function SpLanguageSheet({
  t,
  visible,
  onClose,
  scripts,
  script,
  onScript,
  selected,
  coverage,
  onToggleLanguage,
  onMissingScript,
  requested,
  onRequest,
}: {
  t: SpTheme
  visible: boolean
  onClose: () => void
  scripts: ScriptId[]
  script: ScriptChoice
  onScript: (choice: ScriptChoice) => void
  selected: string[]
  /** what this song has per language; a language that is not in it counts as not added */
  coverage: Record<string, Coverage>
  onToggleLanguage: (code: string) => void
  onMissingScript: (name: string) => void
  /** Languages the reader asked for, which this song does not have yet */
  requested: string[]
  /** Ask for a language this song does not have yet (`Request`) */
  onRequest: (code: string) => void
}) {
  const scriptRows: Array<{ id: ScriptChoice; name: string; sub: string; missing?: boolean }> = [
    { id: "roman", name: "Roman", sub: "Latin letters, for example Bandhu, Álo" },
    { id: "devanagari", name: "देवनागरी", sub: "Devanagari" },
    { id: "bengali", name: "বাংলা", sub: scripts.includes("bengali") ? "Bengali" : "Bengali, not added yet" },
  ]
  // The prototype has no Both row (its boards show Roman or Devanagari only), so the preview leaves it out.
  const hasBoth = !MOCKUP_DATA && scripts.length > 1 && scripts.includes("roman")
  return (
    <SpSheet t={t} visible={visible} onClose={onClose} label="Script and translations" testID="sp-lang-sheet">
      <ShTitle t={t} label="Script" />
      <Group t={t}>
        {scriptRows.map((row, i) => {
          const present = scripts.includes(row.id as ScriptId)
          return (
            <Row
              key={row.id}
              t={t}
              name={row.name}
              sub={row.sub}
              on={script === row.id}
              kind="radio"
              muted={!present}
              last={i === scriptRows.length - 1 && !hasBoth}
              onPress={() => (present ? onScript(row.id) : onMissingScript(row.name))}
            />
          )
        })}
        {hasBoth ? (
          <Row
            t={t}
            name={SCRIPT_LABEL.both}
            sub="Roman and the second script under each line"
            on={script === "both"}
            kind="radio"
            last
            onPress={() => onScript("both")}
          />
        ) : null}
      </Group>

      <ShTitle
        t={t}
        topPad
        label="Translation under each line"
        right={<Text style={[note(t), { textAlign: "right" }]}>Up to 2</Text>}
      />
      <Group t={t}>
        {LYRIC_LANGUAGES.map((language, i) => {
          const state = coverage[language.code] ?? "none"
          const missing = state === "none"
          const asked = requested.includes(language.code)
          return (
            <Row
              key={language.code}
              t={t}
              name={language.name}
              sub={`${language.native} · ${missing ? (asked ? "Requested" : "Not available for this song yet") : STATE_TEXT[state]}`}
              on={selected.includes(language.code)}
              kind="check"
              muted={missing}
              action={missing && !asked ? "Request" : undefined}
              onAction={missing && !asked ? () => onRequest(language.code) : undefined}
              last={i === LYRIC_LANGUAGES.length - 1}
              onPress={() => onToggleLanguage(language.code)}
            />
          )
        })}
      </Group>
      <Text style={[note(t), { paddingHorizontal: 20, paddingTop: 12 }]}>
        Word meanings use the same languages, chosen on the Words card. A language this song does not have yet is
        shown in English, with a note.
      </Text>
      <View style={styles.pad}>
        <SpPill t={t} label="Done" onPress={onClose} style={{ width: "100%" }} />
      </View>
    </SpSheet>
  )
}

/** Versions sheet (`recsOpen`): `.vrow` rows with a check on the playing one, then the Download pill. */
export function SpRecordingsSheet({
  t,
  visible,
  onClose,
  versions,
  selectedUrl,
  onPick,
  downloadItem,
  sizeText,
}: {
  t: SpTheme
  visible: boolean
  onClose: () => void
  versions: SongVersion[]
  selectedUrl: string | null
  onPick: (version: SongVersion) => void
  /** The recording the Download pill acts on (the shared control); no pill without audio. */
  downloadItem: DownloadItem | null
  /** File size shown on the idle pill: `Download · 3.7 MB` */
  sizeText?: string
}) {
  const dl = useDownloadState(downloadItem)
  const dlText = downloadPillLabel(dl.view, { signedIn: dl.signedIn, sizeText })
  return (
    <SpSheet t={t} visible={visible} onClose={onClose} label="Recordings" testID="sp-recordings-sheet">
      <ShTitle t={t} label="Versions" right={<DoneLink t={t} onPress={onClose} />} />
      <View style={styles.vlist}>
        {versions.length === 0 ? (
          <Text style={[styles.empty, { color: t.ink500 }]}>This song has no recording in the app yet.</Text>
        ) : (
          versions.map((version) => {
            const on = version.url === selectedUrl
            const meta = versionDetail(version)
            return (
              <SpPress
                key={version.id}
                onPress={() => onPick(version)}
                accessibilityLabel={`${version.performer}. ${versionDetail(version)}${on ? ". Playing" : ""}`}
                accessibilityState={{ selected: on }}
                style={[styles.vrow, on && { backgroundColor: t.orange100 }]}
              >
                <View style={styles.vn}>
                  {/* the prototype's `.vrow .vn span` rule also restyles the span inside <b>: the name is 14/500 grey in an 18 line */}
                  <Text style={[styles.vnB, { color: t.ink800 }]} numberOfLines={2}>
                    <Text style={[styles.vnS, { color: t.ink500, lineHeight: 20.3 }]}>{version.performer}</Text>
                  </Text>
                  <Text style={[styles.vnS, { color: t.ink500, lineHeight: 20.3 }]} numberOfLines={1}>
                    {meta}
                  </Text>
                </View>
                {on ? <SpIcon name="check" size={22} color={t.orange500} strokeWidth={2.4} /> : <View style={{ width: 22 }} />}
              </SpPress>
            )
          })
        )}
      </View>
      {dl.view.visible && versions.length ? (
        <View style={styles.shPad}>
          <SpPill
            t={t}
            label={dlText}
            variant={dl.view.status === "done" ? "brand" : "ink"}
            onPress={dl.press}
            style={{ width: "100%" }}
          />
        </View>
      ) : null}
    </SpSheet>
  )
}

export type SpPlaylistRow = { id: string; name: string; meta: string; has: boolean }

/** Playlist sheet: the song title, a check row per playlist, and the sand "New playlist" pill. */
export function SpPlaylistSheet({
  t,
  visible,
  onClose,
  songTitle,
  rows,
  onToggle,
  onNew,
}: {
  t: SpTheme
  visible: boolean
  onClose: () => void
  songTitle: string
  rows: SpPlaylistRow[]
  onToggle: (id: string) => void
  onNew: () => void
}) {
  return (
    <SpSheet t={t} visible={visible} onClose={onClose} label="Add to playlist" testID="sp-playlist-sheet">
      <ShTitle t={t} label="Add to playlist" right={<DoneLink t={t} onPress={onClose} />} />
      <Text style={[styles.plsong, { color: t.ink500 }]} numberOfLines={2}>
        {songTitle}
      </Text>
      {rows.length ? (
        <Group t={t}>
          {rows.map((row, i) => (
            <Row
              key={row.id}
              t={t}
              name={row.name}
              sub={row.meta}
              on={row.has}
              kind="check"
              last={i === rows.length - 1}
              onPress={() => onToggle(row.id)}
            />
          ))}
        </Group>
      ) : null}
      <View style={styles.pad}>
        <SpPill t={t} label="New playlist" variant="sand" icon="plusThin" onPress={onNew} style={{ width: "100%" }} />
      </View>
    </SpSheet>
  )
}

const styles = StyleSheet.create({
  group: { marginHorizontal: 10, borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  shTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingLeft: 20,
    paddingRight: 10,
    paddingBottom: 12,
  },
  doneBtn: { height: 44, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  lrow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 56,
    paddingVertical: 6,
    paddingLeft: 20,
    paddingRight: 16,
  },
  lm: { flexShrink: 1, minWidth: 0 },
  lmB: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  lmS: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  rq: { fontFamily: amFonts.semi, fontSize: 13 },
  lmPress: { flex: 1, minWidth: 0, minHeight: 56, justifyContent: "center" },
  rqBtn: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  markPress: { minHeight: 44, minWidth: 24, alignItems: "center", justifyContent: "center" },
  pad: { paddingHorizontal: 20, paddingTop: 16 },
  shPad: { paddingHorizontal: 20, paddingBottom: 24 },
  vlist: { paddingHorizontal: 10, paddingBottom: 4 },
  vrow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  vn: { flex: 1, minWidth: 0, gap: 2 },
  vnB: { fontFamily: amFonts.semi, fontSize: 18, lineHeight: 22 },
  vnS: { fontFamily: amFonts.medium, fontSize: 14 },
  empty: { fontFamily: amFonts.regular, fontSize: 17, lineHeight: 26, padding: 20 },
  plsong: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 21, paddingHorizontal: 20, paddingBottom: 12 },
})
