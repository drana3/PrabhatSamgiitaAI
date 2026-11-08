import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"

import { KPress } from "@/components/kirtan/KPress"
import { ActionButton, CheckRow, Chip, Hint } from "@/components/song-chords/parts"
import { PianoKeyboard } from "@/components/piano/PianoKeyboard"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { SA_NAMES, effectiveSa, keyMidi, windowFor } from "@/lib/pianoNotes/keys"
import { momentsOf, midisOf } from "@/lib/pianoNotes/rules"
import { stepLabel } from "@/lib/pianoNotes/sargamText"
import type { PianoHand, PianoLevel, PianoSheet } from "@/lib/pianoNotes/types"
import { playPianoKey, stopPiano, warmPiano } from "@/lib/pianoPlayback"
import { BPM_MAX, BPM_MIN, usePianoReaderStore } from "@/stores/pianoReaderStore"

/**
 * One piano sheet to read and play: the keyboard lights the keys of the step you are on, the strip below shows the
 * steps row by row, and Play walks through them at the chosen speed with the piano sound. Easy keys (Sa on C) are ON by
 * default; switching them off lets the reader pick the Sa that suits their voice. A sheet with a left hand shows it on
 * request ("Two hands"); the default is one finger.
 */
export function PianoReader({ theme, sheet }: { theme: SongsTheme; sheet: PianoSheet }) {
  const t = useT()
  const { easy, sa: pickedSa, twoHands, bpm, setEasy, setSa, setTwoHands, setBpm } = usePianoReaderStore()
  const sa = effectiveSa({ easy, sa: pickedSa })
  const level: PianoLevel = sheet.level === "two_hands" && twoHands ? "two_hands" : "one_finger"
  const moments = useMemo(() => momentsOf(sheet.rows, level), [sheet.rows, level])
  const [cursor, setCursor] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const releases = useRef<Array<() => void>>([])
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm

  const shownRows = useMemo(() => sheet.rows.filter((row) => level === "two_hands" || row.hand === "right"), [sheet.rows, level])
  const window = useMemo(() => windowFor(midisOf(shownRows, sa)), [shownRows, sa])

  const letGo = useCallback(() => {
    releases.current.forEach((release) => release())
    releases.current = []
  }, [])
  const halt = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setPlaying(false)
    letGo()
  }, [letGo])
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      releases.current.forEach((release) => release())
      void stopPiano()
    },
    [],
  )
  // a different sheet or level starts again from the top
  useEffect(() => {
    halt()
    setCursor(-1)
  }, [sheet.id, level, halt])
  useEffect(() => {
    void warmPiano().catch(() => undefined)
  }, [])

  const sound = useCallback(
    (index: number) => {
      letGo()
      const moment = moments[index]
      if (!moment) return
      for (const key of moment.keys) {
        void playPianoKey(keyMidi(key.k, sa)).then((release) => releases.current.push(release))
      }
    },
    [moments, sa, letGo],
  )

  const go = useCallback(
    (index: number) => {
      setCursor(index)
      sound(index)
    },
    [sound],
  )

  const tick = useCallback(
    (index: number) => {
      const moment = moments[index]
      if (!moment) {
        halt()
        setCursor(-1)
        return
      }
      go(index)
      timer.current = setTimeout(() => tick(index + 1), moment.dur * (60_000 / bpmRef.current))
    },
    [moments, go, halt],
  )

  const toggle = () => {
    if (playing) {
      halt()
      return
    }
    setPlaying(true)
    tick(cursorRef.current >= moments.length - 1 ? 0 : Math.max(0, cursorRef.current))
  }
  const step = (by: 1 | -1) => {
    halt()
    go(Math.min(moments.length - 1, Math.max(0, cursor + by)))
  }

  const lit = useMemo(() => {
    const map = new Map<number, PianoHand>()
    const moment = moments[cursor]
    if (moment) for (const key of moment.keys) map.set(keyMidi(key.k, sa), key.hand)
    return map
  }, [moments, cursor, sa])
  const current = new Set((moments[cursor]?.spots ?? []).map((spot) => `${spot.row}:${spot.step}`))

  // a key tapped on the keyboard just sounds: the keyboard is also an instrument to try the tune on
  const tapKey = useCallback((midi: number) => void playPianoKey(midi), [])

  return (
    <View style={s.gap} testID="piano-reader">
      <View style={s.settings}>
        <CheckRow theme={theme} on={easy} label={t("piano.easy")} onToggle={() => setEasy(!easy)} />
        <Text style={[s.hint, { color: theme.textBody }]}>{t(easy ? "piano.easy.on" : "piano.easy.off")}</Text>
        {!easy ? (
          <View style={s.gap6}>
            <Text style={[s.label, { color: theme.textHeading }]}>{t("piano.saOn")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} accessibilityRole="tablist">
              {SA_NAMES.map((name) => (
                <Chip key={name} theme={theme} label={name} on={pickedSa === name} onPress={() => setSa(name)} minWidth={52} />
              ))}
            </ScrollView>
          </View>
        ) : null}
        {sheet.level === "two_hands" ? <CheckRow theme={theme} on={twoHands} label={t("piano.twoHands")} onToggle={() => setTwoHands(!twoHands)} /> : null}
      </View>

      <PianoKeyboard theme={theme} window={window} sa={sa} lit={lit} onPressKey={tapKey} />

      <View accessibilityLiveRegion="polite" style={s.readout}>
        <Text style={[s.big, { color: theme.textHeading }]}>{cursor >= 0 ? (moments[cursor]?.keys.map((key) => stepLabel({ k: [key.k], b: 1 })).join(" ") ?? "") : "–"}</Text>
        <Text style={[s.small, { color: theme.textBody }]}>{moments.length > 0 ? t("piano.step", { n: Math.max(0, cursor + 1), total: moments.length }) : ""}</Text>
      </View>

      <View style={s.row}>
        <ActionButton theme={theme} tone="quiet" label={t("piano.prev")} onPress={() => step(-1)} disabled={cursor <= 0} style={s.flex} />
        <ActionButton theme={theme} label={t(playing ? "piano.pause" : "piano.play")} onPress={toggle} disabled={moments.length === 0} style={s.flexWide} />
        <ActionButton theme={theme} tone="quiet" label={t("piano.next")} onPress={() => step(1)} disabled={cursor >= moments.length - 1} style={s.flex} />
      </View>

      <View style={s.row} accessibilityRole="adjustable" accessibilityLabel={t("piano.speed", { bpm })}>
        <Chip theme={theme} role="button" label="−" a11y={t("piano.slower")} onPress={() => setBpm(bpm - 8)} minWidth={52} />
        <Text style={[s.speed, { color: theme.textHeading }]}>{t("piano.speed", { bpm })}</Text>
        <Chip theme={theme} role="button" label="+" a11y={t("piano.faster")} onPress={() => setBpm(bpm + 8)} minWidth={52} />
      </View>
      {bpm <= BPM_MIN || bpm >= BPM_MAX ? <Hint theme={theme}>{t(bpm <= BPM_MIN ? "piano.slowest" : "piano.fastest")}</Hint> : null}

      <View style={s.gap}>
        {sheet.rows.map((row, rowIndex) => {
          if (level === "one_finger" && row.hand === "left") return null
          return (
            <View key={rowIndex} style={s.rowBox}>
              <Text style={[s.rowTitle, { color: theme.ink300 }]}>
                {[row.label, row.hand === "left" ? t("piano.leftHand") : null, row.repeat > 1 ? t("piano.repeat", { count: row.repeat }) : null].filter(Boolean).join(" · ") || t("piano.row", { n: rowIndex + 1 })}
              </Text>
              <View style={s.steps}>
                {row.steps.map((stepItem, stepIndex) => {
                  const on = current.has(`${rowIndex}:${stepIndex}`)
                  return (
                    <KPress
                      key={stepIndex}
                      accessibilityRole="button"
                      accessibilityLabel={`${stepLabel(stepItem)}, ${stepItem.b}`}
                      accessibilityState={{ selected: on }}
                      onPress={() => {
                        halt()
                        const at = moments.findIndex((m) => m.spots.some((spot) => spot.row === rowIndex && spot.step === stepIndex))
                        if (at >= 0) go(at)
                      }}
                      pressedScale={0.95}
                      style={[s.step, { backgroundColor: on ? (row.hand === "left" ? theme.ink900 : amColors.orange700) : theme.card, borderColor: on ? "transparent" : theme.line, minWidth: 30 + Math.min(3, stepItem.b - 1) * 14 }]}
                    >
                      <Text style={[s.stepText, { color: on ? "#FFFFFF" : theme.textHeading }]}>{stepLabel(stepItem)}</Text>
                    </KPress>
                  )
                })}
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  gap: { gap: 14 },
  gap6: { gap: 6 },
  settings: { gap: 4 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingLeft: 40 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  chips: { flexDirection: "row", gap: 8, paddingRight: 8 },
  readout: { flexDirection: "row", alignItems: "baseline", gap: 12, minHeight: 44 },
  big: { fontFamily: amFonts.display, fontSize: 32, lineHeight: 34, textTransform: "uppercase" },
  small: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  flexWide: { flex: 1.6 },
  speed: { flex: 1, textAlign: "center", fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  rowBox: { gap: 6 },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: "uppercase" },
  steps: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  step: { minHeight: 44, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  stepText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18 },
})
