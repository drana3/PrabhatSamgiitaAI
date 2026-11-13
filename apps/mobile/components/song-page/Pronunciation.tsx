import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import { SpSheet } from "@/components/song-v2/SpSheet"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { PRON_SOURCES } from "@/data/pronunciation"
import type { PronLanguage, PronSample } from "@/data/pronunciation/types"
import { useT, type MessageKey } from "@/lib/i18n"
import { clipKind, playClip, stopClip, usePlayingClip } from "@/lib/pronunciation/audio"
import { buildCheatSheet, firstSentence, type CheatGroup, type CheatRow } from "@/lib/pronunciation/cheatSheet"
import { songPronLanguage } from "@/lib/pronunciation/songLanguage"

import { OptionRow, OptionValue } from "./OptionRow"
import type { PageUi } from "./state"
import { Segmented } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/**
 * "How to pronounce": a cheat-sheet of the Roman letters in the song's language. Left: what you see. Right: what
 * it sounds like, and a speaker button to hear a real word of the lyrics. Six groups (vowels, consonants, nose
 * sounds, s and sh sounds, special signs, good to know); the vowels are open, the others open with a tap, and the
 * letters that occur in THIS song come first in each group and are shaded. A row opens for the script letters, the
 * whole rule and every example word. It opens as a bottom sheet (SpSheet) from the chip and from the Aa options and
 * the About area. Nothing plays by itself.
 *
 * The language is the one the song seems to be in (lib/pronunciation/songLanguage.ts); a switch at the top always
 * offers the other, so a wrong guess is one tap, never hidden. The sounds are a computer voice until native
 * recordings are dropped in (docs/pronunciation.md). A rule that a native speaker has still to confirm says
 * "being checked" in small type on its row; the sheet never hides that. All the words come from the rules'
 * texts (locales/pronunciation.ts); lib/pronunciation/cheatSheet.ts only orders them.
 */

type LangItem = { id: PronLanguage; label: string }

type Say = (key: string, params?: Record<string, string | number>) => string

function useSay(): Say {
  const t = useT()
  return (key, params) => (t as unknown as (k: MessageKey | string, p?: Record<string, string | number>) => string)(key, params)
}

/** The small row that opens the memo, in the Aa window: the same grid as its other rows (name left, arrow right). */
export function PronunciationRow({ t, ui, onOpen }: { t: SpTheme; ui: PageUi; onOpen?: () => void }) {
  const say = useSay()
  return (
    <OptionRow
      t={t}
      label={say("pron.entry")}
      a11y={`${say("pron.entry")}. ${say("pron.entry.sub")}`}
      onPress={() => {
        onOpen?.()
        ui.setSheet("pronounce")
      }}
    >
      <OptionValue t={t} text="" />
    </OptionRow>
  )
}

/** The visible entry in the header of the text block, beside the Aa button: one clear tap to the memo. */
export function PronunciationChip({ t, ui }: { t: SpTheme; ui: PageUi }) {
  const say = useSay()
  return (
    <SpPress
      onPress={() => ui.setSheet("pronounce")}
      accessibilityRole="button"
      accessibilityLabel={say("pron.chip.a11y")}
      pressedScale={0.94}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[styles.chip, { backgroundColor: t.white, borderColor: t.sand400 }]}
    >
      <SpIcon name="play" size={11} color={t.action} filled />
      <Text style={[styles.chipText, { color: t.ink900 }]} numberOfLines={1}>
        {say("pron.chip")}
      </Text>
    </SpPress>
  )
}

/** The bottom sheet. Its body is only built while the sheet is open. */
export function PronunciationSheet({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const say = useSay()
  const open = ui.sheet === "pronounce"
  // a clip stops with the sheet: no sound is left playing behind a closed sheet
  useEffect(() => {
    if (!open) void stopClip()
  }, [open])
  return (
    <SpSheet t={t} visible={open} onClose={() => ui.setSheet(null)} label={say("pron.title")}>
      <CheatSheetBody t={t} model={model} />
    </SpSheet>
  )
}

function CheatSheetBody({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const say = useSay()
  const number = model.song?.number
  const roman = useMemo(() => model.sources.roman.join("\n"), [model.sources.roman])
  const guess = useMemo(() => songPronLanguage(number, roman), [number, roman])
  const [language, setLanguage] = useState<PronLanguage>(guess === "sanskrit" ? "sanskrit" : "bengali")
  const [openGroups, setOpenGroups] = useState<string[]>(["vowel"])
  const [openRule, setOpenRule] = useState<string | null>(null)
  useEffect(() => {
    setLanguage(guess === "sanskrit" ? "sanskrit" : "bengali")
  }, [guess, number])
  // another language is another list: nothing stays opened from the first one
  useEffect(() => {
    setOpenRule(null)
  }, [language])
  const sheet = useMemo(() => buildCheatSheet(language, roman), [language, roman])
  useEffect(
    () => () => {
      void stopClip()
    },
    [],
  )

  const items: LangItem[] = [
    { id: "bengali", label: say("pron.lang.bengali") },
    { id: "sanskrit", label: say("pron.lang.sanskrit") },
  ]
  const needsComputerNote = sheet.groups.some((group) => group.rows.some((row) => row.rule.samples.some((s) => clipKind(s.audio) === "computer")))
  const toggleGroup = (id: string) => setOpenGroups((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]))
  return (
    <View testID="pronunciation-memo">
      <Text style={[styles.title, { color: t.ink900 }]} accessibilityRole="header">
        {say("pron.title")}
      </Text>
      <Text style={[styles.intro, { color: t.ink800 }]}>{say(`pron.intro.${language}`)}</Text>
      <View style={styles.pad}>
        <Segmented t={t} items={items} value={language} onChange={setLanguage} label={say("pron.lang.a11y")} role="radio" equal />
      </View>
      {guess === "both" ? <Text style={[styles.note, { color: t.ink500 }]}>{say("pron.guess.both")}</Text> : null}
      {needsComputerNote ? (
        <Text style={[styles.note, { color: t.ink500 }]}>
          {say("pron.cs.voice")}
          {language === "sanskrit" ? ` ${say("pron.audio.sanskrit")}` : ""}
        </Text>
      ) : null}

      <View style={styles.columns} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[styles.columnHead, styles.colYou, { color: t.ink500 }]}>{say("pron.cs.you")}</Text>
        <Text style={[styles.columnHead, styles.colSounds, { color: t.ink500 }]}>{say("pron.cs.sounds")}</Text>
      </View>
      {sheet.groups.map((group) => (
        <GroupCard
          key={group.id}
          t={t}
          group={group}
          open={openGroups.includes(group.id)}
          onToggle={() => toggleGroup(group.id)}
          openRule={openRule}
          onOpenRule={(id) => setOpenRule((now) => (now === id ? null : id))}
        />
      ))}

      <Text style={[styles.note, { color: t.ink500 }]}>{say("pron.cs.footer", { count: sheet.checking, total: sheet.total })}</Text>
      <Text style={[styles.sourceList, { color: t.ink500 }]}>
        {`${say("pron.sources")}: ${PRON_SOURCES.filter((s) => s.id !== "ps-data").map((s) => s.title).join(", ")}`}
      </Text>
      <View style={styles.foot} />
    </View>
  )
}

/** One of the six groups: a header that opens it, then its rows. */
function GroupCard({
  t,
  group,
  open,
  onToggle,
  openRule,
  onOpenRule,
}: {
  t: SpTheme
  group: CheatGroup
  open: boolean
  onToggle: () => void
  openRule: string | null
  onOpenRule: (id: string) => void
}) {
  const say = useSay()
  const title = say(`pron.cs.group.${group.id}`)
  return (
    <View style={[styles.card, { backgroundColor: t.white, borderColor: t.sand400 }]} testID={`pron-group-${group.id}`}>
      <SpPress
        onPress={onToggle}
        accessibilityLabel={say("pron.cs.group.a11y", { group: title, count: group.rows.length })}
        accessibilityState={{ selected: open }}
        pressedScale={0.99}
        style={styles.groupHead}
        testID={`pron-group-head-${group.id}`}
      >
        <Text style={[styles.groupTitle, { color: t.ink900 }]}>{title}</Text>
        {group.inSong ? <Text style={[styles.groupSong, { color: t.accentText }]}>{say("pron.cs.inSong", { count: group.inSong })}</Text> : null}
        <View style={open ? styles.chevOpen : undefined}>
          <SpIcon name="chevDown" size={20} color={t.ink500} />
        </View>
      </SpPress>
      {open
        ? group.rows.map((row) => <CheatRowView key={row.rule.id} t={t} row={row} opened={openRule === row.rule.id} onOpen={() => onOpenRule(row.rule.id)} />)
        : null}
    </View>
  )
}

/**
 * One rule. Collapsed: the letters, the closest sound in one line, a speaker. Opened: the script letters, the
 * whole rule and every example word.
 */
function CheatRowView({ t, row, opened, onOpen }: { t: SpTheme; row: CheatRow; opened: boolean; onOpen: () => void }) {
  const say = useSay()
  const { rule } = row
  const script = rule.language === "bengali" ? amFonts.bengali : amFonts.devanagari
  const text = say(`pron.${rule.id}.text`)
  const line = rule.like ? say(`pron.${rule.id}.like`) : firstSentence(text)
  // opened: the rest of the rule. With a "close to" line that is the whole text; without one the first sentence is already the line.
  const more = rule.like ? text : text.slice(line.length).trim()
  const letters = `${row.shown.join("  ")}${row.more ? " …" : ""}`
  const [failed, setFailed] = useState(false)
  return (
    <View
      style={[styles.row, { borderTopColor: t.sand300 }, row.inSong ? { backgroundColor: t.sand100 } : null]}
      testID={`pron-rule-${rule.id}`}
    >
      <View style={styles.rowMain}>
        <SpPress
          onPress={onOpen}
          accessibilityLabel={say("pron.cs.row.a11y", { symbols: rule.symbols.join(", ") })}
          accessibilityState={{ selected: opened }}
          pressedScale={0.99}
          style={styles.rowTap}
          testID={`pron-row-${rule.id}`}
        >
          <Text style={[styles.symbols, styles.colYou, { color: t.ink900 }, letters.length > 12 ? styles.symbolsSmall : null]}>{letters}</Text>
          <View style={styles.colSounds}>
            <Text style={[styles.line, { color: t.ink800 }]} numberOfLines={opened ? undefined : 3}>
              {line}
            </Text>
            {row.checking ? <Text style={[styles.checking, { color: t.ink500 }]}>{say("pron.cs.checking")}</Text> : null}
          </View>
        </SpPress>
        {row.first ? <PlayButton t={t} sample={row.first} onResult={setFailed} /> : <View style={styles.playSpace} />}
      </View>
      {failed ? <Text style={[styles.error, { color: t.dangerText }]}>{say("pron.error")}</Text> : null}
      {opened ? (
        <View style={styles.detail}>
          {rule.script.length || rule.ipa ? (
            <View style={styles.metaRow}>
              {rule.script.length ? <Text style={[styles.scriptLetters, { color: t.ink800, fontFamily: script }]}>{rule.script.join("  ")}</Text> : null}
              {rule.ipa ? <Text style={[styles.ipa, { color: t.ink500 }]}>{`${say("pron.ipa")}  ${rule.ipa}`}</Text> : null}
            </View>
          ) : null}
          {more ? <Text style={[styles.text, { color: t.ink800 }]}>{more}</Text> : null}
          {row.checking ? <Text style={[styles.checkNote, { color: t.ink500 }]}>{say("pron.check")}</Text> : null}
          {rule.samples.length ? <Text style={[styles.hear, { color: t.ink500 }]}>{say("pron.cs.hear")}</Text> : null}
          {rule.samples.map((sample) => (
            <SampleRow key={sample.audio} t={t} sample={sample} language={rule.language} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** The speaker button: it plays a clip; tapping it again stops it. */
function PlayButton({ t, sample, onResult }: { t: SpTheme; sample: PronSample; onResult?: (failed: boolean) => void }) {
  const say = useSay()
  const playing = usePlayingClip() === sample.audio
  const press = async () => {
    onResult?.(false)
    const result = await playClip(sample.audio)
    if (result !== "played") onResult?.(true)
  }
  return (
    <SpPress
      onPress={press}
      accessibilityLabel={say(playing ? "pron.stop" : "pron.play", { word: sample.roman })}
      accessibilityState={{ selected: playing }}
      pressedScale={0.94}
      style={[styles.play, { backgroundColor: playing ? t.action : t.white, borderColor: playing ? t.action : t.sand400 }]}
      testID={`pron-play-${sample.audio}`}
    >
      <SpIcon name={playing ? "pause" : "play"} size={18} color={playing ? t.onAction : t.ink900} strokeWidth={2} />
    </SpPress>
  )
}

/** One example word, in a row of an opened rule: the word, its script, the song it comes from, and the speaker. */
function SampleRow({ t, sample, language }: { t: SpTheme; sample: PronSample; language: PronLanguage }) {
  const say = useSay()
  const [failed, setFailed] = useState(false)
  const script = language === "bengali" ? amFonts.bengali : amFonts.devanagari
  return (
    <View>
      <View style={styles.sample}>
        <View style={styles.sampleText}>
          <Text style={[styles.word, { color: t.ink900 }]}>{sample.roman}</Text>
          <Text style={[styles.wordScript, { color: t.ink800, fontFamily: script }]}>{sample.script}</Text>
          <Text style={[styles.songNo, { color: t.ink500 }]}>{say("pron.songNumber", { number: sample.song })}</Text>
        </View>
        <PlayButton t={t} sample={sample} onResult={setFailed} />
      </View>
      {failed ? <Text style={[styles.error, { color: t.dangerText }]}>{say("pron.error")}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { height: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: 9999, borderWidth: 1 },
  chipText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18 },
  title: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 30, paddingHorizontal: 20, paddingTop: 4 },
  intro: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 },
  pad: { paddingHorizontal: 20 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 19, paddingHorizontal: 20, paddingTop: 10 },
  columns: { flexDirection: "row", paddingHorizontal: 32, paddingTop: 16, paddingBottom: 6, gap: 12 },
  columnHead: { fontFamily: amFonts.bold, fontSize: 11, lineHeight: 16, letterSpacing: 0.88, textTransform: "uppercase" },
  colYou: { width: 100 },
  colSounds: { flex: 1 },
  card: { marginHorizontal: 20, marginTop: 8, borderWidth: 1, borderRadius: 20, overflow: "hidden" },
  groupHead: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 12, paddingRight: 8 },
  groupTitle: { flex: 1, fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  groupSong: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16 },
  chevOpen: { transform: [{ rotate: "180deg" }] },
  row: { borderTopWidth: StyleSheet.hairlineWidth },
  rowMain: { flexDirection: "row", alignItems: "center", paddingLeft: 12, paddingRight: 8, gap: 4 },
  rowTap: { flex: 1, minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  symbols: { fontFamily: amFonts.display, fontSize: 22, lineHeight: 28 },
  symbolsSmall: { fontSize: 15, lineHeight: 20 },
  line: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  checking: { fontFamily: amFonts.medium, fontSize: 11, lineHeight: 16, letterSpacing: 0.3, paddingTop: 2 },
  playSpace: { width: 44, height: 44 },
  detail: { paddingLeft: 12, paddingRight: 8, paddingBottom: 12, gap: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 16, rowGap: 2 },
  scriptLetters: { fontSize: 20, lineHeight: 32 },
  ipa: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  text: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20 },
  checkNote: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16 },
  hear: { fontFamily: amFonts.bold, fontSize: 11, lineHeight: 16, letterSpacing: 0.88, textTransform: "uppercase", paddingTop: 4 },
  sample: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 },
  play: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sampleText: { flex: 1, flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 10 },
  word: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 24 },
  wordScript: { fontSize: 18, lineHeight: 28 },
  songNo: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16 },
  error: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingHorizontal: 12, paddingBottom: 6 },
  sourceList: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 18, paddingHorizontal: 20, paddingTop: 8 },
  foot: { height: 8 },
})
