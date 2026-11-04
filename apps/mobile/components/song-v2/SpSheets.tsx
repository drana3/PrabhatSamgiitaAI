import { useMemo, useState, type ReactNode } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { localeOptions, type LocaleOption } from "@/constants/languages"
import { SCRIPT_LABEL, type ScriptChoice, type ScriptId } from "@/lib/songPage/scripts"
import { groupLanguages, type Coverage } from "@/lib/songPage/translations"
import { versionDetail, type DownloadPhase, type SongVersion } from "@/lib/songPage/versions"

import { SpIcon } from "./SpIcon"
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
  return (
    <SpPress onPress={onPress} accessibilityLabel="Done" style={styles.doneBtn}>
      <Text style={{ fontFamily: amFonts.semi, fontSize: 15, color: t.ink800 }}>Done</Text>
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
  last?: boolean
  onPress: () => void
}) {
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
      {action ? <Text style={[styles.rq, { color: t.orange700 }]}>{action}</Text> : null}
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

/** Language sheet: script rows (radio), translation search and rows (check, up to two), the note, Done. */
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
  options,
  searchCount,
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
  coverage: Record<string, Coverage>
  onToggleLanguage: (code: string) => void
  onMissingScript: (name: string) => void
  /** Languages to list; all of them when left out */
  options?: LocaleOption[]
  /** Number in the search placeholder; the length of `options` when left out */
  searchCount?: number
  /** Languages the reader asked for, which have no translation yet */
  requested: string[]
  /** Ask for a language that has no translation yet (`Request`) */
  onRequest: (code: string) => void
}) {
  const [query, setQuery] = useState("")
  const pool = options ?? localeOptions
  const rows = useMemo(
    () => groupLanguages(coverage, query, pool).flatMap((group) => group.rows),
    [coverage, query, pool],
  )
  const scriptRows: Array<{ id: ScriptChoice; name: string; sub: string; missing?: boolean }> = [
    { id: "roman", name: "Roman", sub: "Latin letters, for example Bandhu, Álo" },
    { id: "devanagari", name: "देवनागरी", sub: "Devanagari" },
    { id: "bengali", name: "বাংলা", sub: scripts.includes("bengali") ? "Bengali" : "Bengali, not added yet" },
  ]
  const hasBoth = scripts.length > 1 && scripts.includes("roman")
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
      <View style={[styles.search, { backgroundColor: t.white, borderColor: t.sand300 }]}>
        <SpIcon name="search" size={20} color={t.ink500} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${searchCount ?? pool.length} languages`}
          placeholderTextColor={t.ink500}
          accessibilityLabel="Search languages"
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          style={[styles.searchInput, { color: t.ink800 }]}
        />
      </View>
      <Group t={t}>
        {rows.map((row, i) => (
          <Row
            key={row.option.code}
            t={t}
            name={row.option.label}
            sub={`${row.option.nativeLabel} · ${
              row.coverage === "none" && requested.includes(row.option.code) ? "Requested" : STATE_TEXT[row.coverage]
            }`}
            on={selected.includes(row.option.code)}
            kind="check"
            muted={row.coverage === "none"}
            action={row.coverage === "none" && !requested.includes(row.option.code) ? "Request" : undefined}
            last={i === rows.length - 1}
            onPress={() =>
              row.coverage === "none" ? onRequest(row.option.code) : onToggleLanguage(row.option.code)
            }
          />
        ))}
      </Group>
      <Text style={[note(t), { paddingHorizontal: 20, paddingTop: 12 }]}>
        Word meanings can be shown in the same languages. Where a language has lines only, word meanings stay in English.
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
  phase,
  progress,
  showDownload,
  onDownload,
  sizeText,
}: {
  t: SpTheme
  visible: boolean
  onClose: () => void
  versions: SongVersion[]
  selectedUrl: string | null
  onPick: (version: SongVersion) => void
  phase: DownloadPhase
  progress: number
  showDownload: boolean
  onDownload: () => void
  /** File size shown on the idle pill: `Download · 3.7 MB` */
  sizeText?: string
}) {
  const dlText =
    phase === "saved"
      ? "Downloaded"
      : phase === "downloading"
        ? `Downloading ${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`
        : sizeText
          ? `Download · ${sizeText}`
          : "Download"
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
                  <Text style={[styles.vnB, { color: t.ink800 }]} numberOfLines={2}>
                    {version.performer}
                  </Text>
                  <Text style={[styles.vnS, { color: t.ink500 }]} numberOfLines={1}>
                    {meta}
                  </Text>
                </View>
                {on ? <SpIcon name="check" size={22} color={t.orange500} strokeWidth={2.4} /> : <View style={{ width: 22 }} />}
              </SpPress>
            )
          })
        )}
      </View>
      {showDownload && versions.length ? (
        <View style={styles.shPad}>
          <SpPill
            t={t}
            label={dlText}
            variant={phase === "saved" ? "peach" : "brand"}
            onPress={onDownload}
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
  lm: { flex: 1, minWidth: 0 },
  lmB: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  lmS: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  rq: { fontFamily: amFonts.semi, fontSize: 13 },
  search: {
    marginHorizontal: 20,
    marginBottom: 12,
    height: 48,
    borderRadius: 70,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    fontFamily: amFonts.medium,
    fontSize: 16,
    // web: no focus ring box inside the pill
    ...({ outlineStyle: "none" } as object),
  },
  pad: { paddingHorizontal: 20, paddingTop: 16 },
  shPad: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 4 },
  vlist: { paddingHorizontal: 10, paddingBottom: 4 },
  vrow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  vn: { flex: 1, minWidth: 0, gap: 2 },
  vnB: { fontFamily: amFonts.semi, fontSize: 18, lineHeight: 22 },
  vnS: { fontFamily: amFonts.medium, fontSize: 14 },
  empty: { fontFamily: amFonts.regular, fontSize: 17, lineHeight: 26, padding: 20 },
  plsong: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 21, paddingHorizontal: 20, paddingBottom: 12 },
})
