import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import { SpSheet } from "@/components/song-v2/SpSheet"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { PRON_SOURCES } from "@/data/pronunciation"
import type { PronLanguage, PronRule, PronSample } from "@/data/pronunciation/types"
import { useT, type MessageKey } from "@/lib/i18n"
import { clipKind, playClip, stopClip, usePlayingClip } from "@/lib/pronunciation/audio"
import { buildMemo } from "@/lib/pronunciation/memo"
import { songPronLanguage } from "@/lib/pronunciation/songLanguage"

import type { PageUi } from "./state"
import { ChevronRow, Segmented } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/**
 * "How to pronounce": a memo of the Roman letters in the song's language, with a sound to tap for every example
 * word. It opens as a bottom sheet (SpSheet) from the Aa options and from the About area. Nothing plays by itself.
 *
 * Order: the basics of the language, then the letters that occur in THIS song, then all the others. The language is
 * the one the song seems to be in (lib/pronunciation/songLanguage.ts); a switch at the top always offers the other,
 * so a wrong guess is one tap, never hidden. The sounds are a computer voice until native recordings are dropped in
 * (docs/pronunciation.md), and the sheet says so.
 */

type LangItem = { id: PronLanguage; label: string }

type Say = (key: string, params?: Record<string, string | number>) => string

function useSay(): Say {
  const t = useT()
  return (key, params) => (t as unknown as (k: MessageKey | string, p?: Record<string, string | number>) => string)(key, params)
}

/** The small row that opens the memo: in the Aa options and in the About area. */
export function PronunciationRow({ t, ui, onOpen, last }: { t: SpTheme; ui: PageUi; onOpen?: () => void; last?: boolean }) {
  const say = useSay()
  return (
    <ChevronRow
      t={t}
      title={say("pron.entry")}
      subtitle={say("pron.entry.sub")}
      last={last}
      onPress={() => {
        onOpen?.()
        ui.setSheet("pronounce")
      }}
    />
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
      <MemoBody t={t} model={model} />
    </SpSheet>
  )
}

function MemoBody({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const say = useSay()
  const number = model.song?.number
  const roman = useMemo(() => model.sources.roman.join("\n"), [model.sources.roman])
  const guess = useMemo(() => songPronLanguage(number, roman), [number, roman])
  const [language, setLanguage] = useState<PronLanguage>(guess === "sanskrit" ? "sanskrit" : "bengali")
  useEffect(() => {
    setLanguage(guess === "sanskrit" ? "sanskrit" : "bengali")
  }, [guess, number])
  const memo = useMemo(() => buildMemo(language, roman), [language, roman])
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
  const needsComputerNote = [...memo.general, ...memo.inSong, ...memo.others].some((rule) => rule.samples.some((s) => clipKind(s.audio) === "computer"))
  return (
    <View testID="pronunciation-memo">
      <Text style={[styles.title, { color: t.ink900 }]} accessibilityRole="header">
        {say("pron.title")}
      </Text>
      <Text style={[styles.intro, { color: t.ink800 }]}>{say(`pron.intro.${language}`)}</Text>
      <View style={styles.pad}>
        <Segmented t={t} items={items} value={language} onChange={setLanguage} label={say("pron.lang.a11y")} role="radio" equal />
      </View>
      <Text style={[styles.note, { color: t.ink500 }]}>{say(`pron.guess.${guess}`)}</Text>
      {needsComputerNote ? (
        <View style={[styles.banner, { borderColor: t.sand400, backgroundColor: t.sand100 }]}>
          <Text style={[styles.bannerText, { color: t.ink800 }]}>{say("pron.audio.computer")}</Text>
          {language === "sanskrit" ? <Text style={[styles.bannerText, { color: t.ink800 }]}>{say("pron.audio.sanskrit")}</Text> : null}
          <Text style={[styles.bannerText, { color: t.ink800 }]}>{say("pron.unchecked")}</Text>
        </View>
      ) : null}

      <Section t={t} title={say("pron.section.general")} />
      {memo.general.map((rule) => (
        <RuleRow key={rule.id} t={t} rule={rule} />
      ))}

      <Section t={t} title={say("pron.section.inSong")} />
      {memo.inSong.length ? (
        memo.inSong.map((rule) => <RuleRow key={rule.id} t={t} rule={rule} />)
      ) : (
        <Text style={[styles.note, { color: t.ink500 }]}>{say("pron.section.none")}</Text>
      )}

      <Section t={t} title={say("pron.section.all")} />
      {memo.others.map((rule) => (
        <RuleRow key={rule.id} t={t} rule={rule} />
      ))}

      <Section t={t} title={say("pron.sources")} />
      <Text style={[styles.note, { color: t.ink500 }]}>{say("pron.sources.body")}</Text>
      <Text style={[styles.sourceList, { color: t.ink500 }]}>{PRON_SOURCES.filter((s) => s.id !== "ps-data").map((s) => s.title).join("\n")}</Text>
      <View style={styles.foot} />
    </View>
  )
}

function Section({ t, title }: { t: SpTheme; title: string }) {
  return (
    <View style={[styles.section, { borderBottomColor: t.sand400 }]}>
      <Text style={[styles.sectionText, { color: t.ink900 }]} accessibilityRole="header">
        {title}
      </Text>
    </View>
  )
}

/** One rule: its symbols, the letters of the script, a plain sentence, the closest sound, and words to hear. */
function RuleRow({ t, rule }: { t: SpTheme; rule: PronRule }) {
  const say = useSay()
  const script = rule.language === "bengali" ? amFonts.bengali : amFonts.devanagari
  return (
    <View style={[styles.rule, { borderBottomColor: t.sand300 }]} testID={`pron-rule-${rule.id}`}>
      <View style={styles.ruleHead}>
        <Text style={[styles.symbols, { color: t.ink900 }]} accessibilityLabel={rule.symbols.join(", ")}>
          {rule.symbols.join("  ")}
        </Text>
        {rule.group !== "general" ? <Text style={[styles.group, { color: t.ink500 }]}>{say(`pron.group.${rule.group}`)}</Text> : null}
      </View>
      {rule.script.length || rule.ipa ? (
        <View style={styles.metaRow}>
          {rule.script.length ? <Text style={[styles.scriptLetters, { color: t.ink800, fontFamily: script }]}>{rule.script.join("  ")}</Text> : null}
          {rule.ipa ? <Text style={[styles.ipa, { color: t.ink500 }]}>{`${say("pron.ipa")}  ${rule.ipa}`}</Text> : null}
        </View>
      ) : null}
      <Text style={[styles.text, { color: t.ink800 }]}>{say(`pron.${rule.id}.text`)}</Text>
      {rule.like ? (
        <Text style={[styles.like, { color: t.ink800 }]}>
          <Text style={{ color: t.ink500 }}>{`${say("pron.like")}: `}</Text>
          {say(`pron.${rule.id}.like`)}
        </Text>
      ) : null}
      {rule.status === "needs-native-check" ? (
        <View style={[styles.check, { borderColor: t.accentText }]}>
          <Text style={[styles.checkText, { color: t.accentText }]}>{say("pron.check")}</Text>
        </View>
      ) : null}
      {rule.samples.map((sample) => (
        <SampleRow key={sample.audio} t={t} sample={sample} language={rule.language} />
      ))}
    </View>
  )
}

/** One word to hear: the button plays its clip; tapping it again stops it. */
function SampleRow({ t, sample, language }: { t: SpTheme; sample: PronSample; language: PronLanguage }) {
  const say = useSay()
  const playing = usePlayingClip() === sample.audio
  const [failed, setFailed] = useState(false)
  const script = language === "bengali" ? amFonts.bengali : amFonts.devanagari
  const press = async () => {
    setFailed(false)
    const result = await playClip(sample.audio)
    if (result !== "played") setFailed(true)
  }
  return (
    <View>
      <SpPress
        onPress={press}
        accessibilityLabel={say(playing ? "pron.stop" : "pron.play", { word: sample.roman })}
        accessibilityState={{ selected: playing }}
        pressedScale={0.98}
        style={styles.sample}
        testID={`pron-play-${sample.audio}`}
      >
        <View style={[styles.play, { backgroundColor: playing ? t.action : t.white, borderColor: playing ? t.action : t.sand400 }]}>
          <SpIcon name={playing ? "pause" : "play"} size={18} color={playing ? t.onAction : t.ink900} strokeWidth={2} />
        </View>
        <View style={styles.sampleText}>
          <Text style={[styles.word, { color: t.ink900 }]}>{sample.roman}</Text>
          <Text style={[styles.wordScript, { color: t.ink800, fontFamily: script }]}>{sample.script}</Text>
        </View>
        <Text style={[styles.songNo, { color: t.ink500 }]}>{say("pron.songNumber", { number: sample.song })}</Text>
      </SpPress>
      {failed ? <Text style={[styles.error, { color: t.dangerText }]}>{say("pron.error")}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { height: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: 9999, borderWidth: 1 },
  chipText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18 },
  title: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 30, paddingHorizontal: 20, paddingTop: 4 },
  intro: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  pad: { paddingHorizontal: 20 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 19, paddingHorizontal: 20, paddingTop: 10 },
  banner: { marginHorizontal: 20, marginTop: 12, borderWidth: 1, borderRadius: 2, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  bannerText: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 19 },
  section: { marginHorizontal: 20, marginTop: 24, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  rule: { marginHorizontal: 20, paddingVertical: 14, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  ruleHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  symbols: { flexShrink: 1, fontFamily: amFonts.display, fontSize: 28, lineHeight: 34 },
  group: { fontFamily: amFonts.bold, fontSize: 11, lineHeight: 16, letterSpacing: 0.88, textTransform: "uppercase" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 16, rowGap: 2 },
  scriptLetters: { fontSize: 20, lineHeight: 32 },
  ipa: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  text: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  like: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
  check: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 2, paddingHorizontal: 8, paddingVertical: 2 },
  checkText: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.3 },
  sample: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 },
  play: { width: 44, height: 44, borderRadius: 2, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sampleText: { flex: 1, flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 10 },
  word: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 24 },
  wordScript: { fontSize: 18, lineHeight: 28 },
  songNo: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16 },
  error: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingLeft: 56 },
  sourceList: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 18, paddingHorizontal: 20, paddingTop: 8 },
  foot: { height: 8 },
})
