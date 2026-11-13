import { useEffect, useRef } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"

import { SpSheet } from "@/components/song-v2/SpSheet"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { scrollOffsetFor, TUNE_ROW, TUNE_ROWS_SHOWN } from "@/lib/recordingChords/tuneList"

/**
 * Two pop-up sheets of the chord cycle screen (docs/kiirtan-cycle.md), so the page never carries a grid of 30 numbers:
 *  - `TunePickSheet`: how many tunes are played in the recording. A list of numbers that scrolls, five rows at a time,
 *    opening on the current one; a tap picks it and closes the sheet.
 *  - `TuneChooseSheet`: which of the tunes have chords. The same scrolling list with a tick on each row, "All" and "None" at
 *    the top and "Done" at the bottom.
 * Both sit over the whole screen (SpSheet), animated by spring and closed by a drag down.
 */
export function TunePickSheet({ t, visible, value, max, onPick, onClose }: { t: SpTheme; visible: boolean; value: number; max: number; onPick: (n: number) => void; onClose: () => void }) {
  const tr = useT()
  const list = useRef<ScrollView>(null)
  useEffect(() => {
    if (!visible) return undefined
    const timer = setTimeout(() => list.current?.scrollTo({ y: scrollOffsetFor(value, max), animated: false }), 60)
    return () => clearTimeout(timer)
  }, [visible, value, max])
  return (
    <SpSheet t={t} visible={visible} onClose={onClose} label={tr("kPage.tunes.sheet")} testID="tune-pick-sheet">
      <View style={styles.body}>
        <Text style={[styles.title, { color: t.ink900 }]} accessibilityRole="header">
          {tr("kPage.tunes.sheet")}
        </Text>
        <Text style={[styles.hint, { color: t.ink800 }]}>{tr("kPage.tunes.sheetHint", { max })}</Text>
        <ScrollView ref={list} style={[styles.list, { height: TUNE_ROW * TUNE_ROWS_SHOWN, backgroundColor: t.sand100, borderColor: t.sand400 }]} nestedScrollEnabled showsVerticalScrollIndicator testID="tune-pick-list">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
            const on = n === value
            return (
              <SpPress
                key={n}
                onPress={() => onPick(n)}
                accessibilityRole="radio"
                accessibilityLabel={tr("kPage.tunes.optionA11y", { count: n })}
                accessibilityState={{ selected: on }}
                pressedScale={0.98}
                testID={`tune-pick-${n}`}
                style={[styles.row, { backgroundColor: on ? t.action : "transparent" }]}
              >
                <Text style={[styles.num, { color: on ? t.onAction : t.ink900 }]}>{tr("kPage.tunes.option", { count: n })}</Text>
              </SpPress>
            )
          })}
        </ScrollView>
      </View>
    </SpSheet>
  )
}

export function TuneChooseSheet({
  t,
  visible,
  total,
  chosen,
  onToggle,
  onAll,
  onNone,
  onClose,
  allLabel,
  noneLabel,
  tuneLabel,
}: {
  t: SpTheme
  visible: boolean
  total: number
  /** the chosen tunes as places in the list (0-based) */
  chosen: readonly number[]
  onToggle: (index: number) => void
  onAll: () => void
  onNone: () => void
  onClose: () => void
  allLabel: string
  noneLabel: string
  /** the words of one row ("Tune 3") */
  tuneLabel: (n: number) => string
}) {
  const tr = useT()
  return (
    <SpSheet t={t} visible={visible} onClose={onClose} label={tr("kPage.which.sheet")} testID="tune-choose-sheet">
      <View style={styles.body}>
        <Text style={[styles.title, { color: t.ink900 }]} accessibilityRole="header">
          {tr("kPage.which.sheet")}
        </Text>
        <Text style={[styles.hint, { color: t.ink800 }]}>{tr("kPage.which.sheetHint")}</Text>
        <View style={styles.pills}>
          <Pill t={t} label={allLabel} onPress={onAll} />
          <Pill t={t} label={noneLabel} onPress={onNone} />
        </View>
        <ScrollView style={[styles.list, { height: TUNE_ROW * TUNE_ROWS_SHOWN, backgroundColor: t.sand100, borderColor: t.sand400 }]} nestedScrollEnabled showsVerticalScrollIndicator testID="tune-choose-list">
          {Array.from({ length: total }, (_, i) => i).map((i) => {
            const on = chosen.includes(i)
            return (
              <SpPress
                key={i}
                onPress={() => onToggle(i)}
                accessibilityRole="checkbox"
                accessibilityLabel={tuneLabel(i + 1)}
                accessibilityState={{ checked: on }}
                pressedScale={0.98}
                testID={`tune-choose-${i + 1}`}
                style={styles.row}
              >
                <Text style={[styles.num, { color: t.ink900 }]}>{tuneLabel(i + 1)}</Text>
                <View style={[styles.box, { borderColor: on ? t.action : t.ink800, backgroundColor: on ? t.action : "transparent" }]}>
                  {on ? <Text style={[styles.tick, { color: t.onAction }]}>✓</Text> : null}
                </View>
              </SpPress>
            )
          })}
        </ScrollView>
        <Pill t={t} label={tr("kPage.tunes.done")} onPress={onClose} solid />
      </View>
    </SpSheet>
  )
}

function Pill({ t, label, onPress, solid }: { t: SpTheme; label: string; onPress: () => void; solid?: boolean }) {
  return (
    <SpPress onPress={onPress} accessibilityLabel={label} pressedScale={0.96} style={[styles.pill, { backgroundColor: solid ? t.action : "transparent", borderColor: solid ? t.action : t.ink800 }]}>
      <Text style={[styles.pillText, { color: solid ? t.onAction : t.ink900 }]}>{label}</Text>
    </SpPress>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, gap: 12, paddingBottom: 8 },
  title: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 28 },
  hint: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  list: { borderWidth: 1, borderRadius: 20, flexGrow: 0 },
  row: { height: TUNE_ROW, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 20 },
  num: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 26 },
  box: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  tick: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 22 },
  pills: { flexDirection: "row", gap: 8 },
  pill: { minHeight: 48, minWidth: 96, paddingHorizontal: 20, borderRadius: 9999, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
})
