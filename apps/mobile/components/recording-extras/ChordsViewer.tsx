import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/comments/CommentsView"
import { ChartBody, ChartCreditLine, ChartMeta, type ChartLike } from "@/components/song-chords/ChartBody"
import { SpPress } from "@/components/song-v2/SpUi"
import { SpSheet } from "@/components/song-v2/SpSheet"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { sheetFailureText } from "@/lib/recordingChords/words"
import { MAX_SHIFT, clampShift, shiftedKey, transposeSheet } from "@/lib/recordingChords/transpose"
import type { RecordingSheet, SheetInstrument, SheetReportReason } from "@/lib/recordingChords/types"

import { DeletePanel, ReportPanel } from "./Panels"
import { ChartText, Note, R_ROUND, Stepper } from "./ui"
import type { SheetsController } from "./useRecordingSheets"

const REASONS: SheetReportReason[] = ["wrong_chords", "offensive", "spam", "other"]
const INSTRUMENTS: SheetInstrument[] = ["guitar", "harmonium"]

/** "+2", "-3" (a real minus sign), never "0": the label of a shifted chart. */
function stepsLabel(n: number): string {
  return `${n > 0 ? "+" : "−"}${Math.abs(n)}`
}

/**
 * The chord sheet of a recording: a spring sheet over the page (SpSheet) with the member-written charts for each
 * instrument, a transpose stepper (moving a chart is done on the way to the screen and never stored), the chart in
 * a fixed-pitch face with the chords in the accent, and who added it. The words are honest about what is checked:
 * the team looks that a chart holds chords, not that every chord is right, and a plain chart is not synced to the
 * audio. A member's own waiting or rejected chart shows its state and can be changed or deleted; a live chart can be
 * reported by others, deleted by its author or the team.
 */
export function ChordsViewer({
  t,
  visible,
  onClose,
  sheets,
  onAdd,
  onChange,
  onCopy,
  onFrom,
}: {
  t: SpTheme
  visible: boolean
  onClose: () => void
  sheets: SheetsController
  onAdd: () => void
  onChange: (sheet: RecordingSheet) => void
  /** a chart of the member's own that is live: make a changed copy of it (only charts over words have one) */
  onCopy?: (sheet: RecordingSheet) => void
  /** somebody else's published chart: "Start from this chart" */
  onFrom?: (sheet: RecordingSheet) => void
}) {
  const tr = useT()
  const { state } = sheets
  const [instrument, setInstrument] = useState<SheetInstrument>("guitar")
  const [index, setIndex] = useState(0)
  const [shift, setShift] = useState(0)
  const [panel, setPanel] = useState<null | "report" | "delete">(null)
  const [note, setNote] = useState<string | null>(null)

  const present = useMemo(() => INSTRUMENTS.filter((i) => state.items.some((s) => s.instrument === i)), [state.items])
  // follow the data: the first instrument that has a chart when the chosen one has none
  useEffect(() => {
    if (present.length > 0 && !present.includes(instrument)) setInstrument(present[0] as SheetInstrument)
  }, [present, instrument])
  const list = state.items.filter((s) => s.instrument === instrument)
  const sheet = list[Math.min(index, Math.max(0, list.length - 1))] ?? null

  const pick = (next: () => void) => {
    next()
    setShift(0)
    setPanel(null)
    setNote(null)
  }

  const key = sheet ? shiftedKey(sheet.chartKey, shift, sheet.body) : null
  const shown = useMemo(() => (sheet ? transposeSheet(sheet.body, shift, sheet.chartKey) : ""), [sheet, shift])

  // a chart over the words (a Bhajan, a Spiritual song) is drawn by the Prabhat Samgiita chart view, with its own capo or Sa control
  const chart: ChartLike | null = sheet && sheet.lines && sheet.lines.length > 0 ? { id: sheet.id, instrument: sheet.instrument, baseKey: sheet.chartKey ?? "C", capo: sheet.capo ?? 0, strum: sheet.strum ?? null, lines: sheet.lines, status: sheet.status, basedOn: sheet.basedOn } : null

  const by = !sheet ? "" : sheet.mine ? tr("recChords.by.you") : sheet.author ? tr("recChords.by", { name: sheet.author.name }) : tr("recChords.by.anonymous")

  return (
    <SpSheet t={t} visible={visible} onClose={onClose} label={tr("recChords.sheet.label")} testID="recording-chords-sheet">
      <View style={styles.body}>
        <View style={styles.head}>
          <Text accessibilityRole="header" style={[styles.title, { color: t.ink900 }]}>
            {tr("recChords.title")}
          </Text>
          <SpPress onPress={onClose} accessibilityLabel={tr("recChords.close")} style={styles.close}>
            <Text style={[styles.closeText, { color: t.accentText }]}>{tr("recChords.close")}</Text>
          </SpPress>
        </View>

        {state.status === "loading" && state.items.length === 0 ? (
          <View style={styles.status} accessibilityLiveRegion="polite">
            <ActivityIndicator color={t.ink500} />
            <Note t={t}>{tr("recChords.loading")}</Note>
          </View>
        ) : null}
        {state.status === "error" || state.status === "offline" ? (
          <View style={styles.status} accessibilityLiveRegion="polite">
            <Note t={t} tone="body">{tr(state.status === "offline" ? "recChords.offline" : "recChords.error")}</Note>
            <Button t={t} variant="quiet" label={tr("recChords.retry")} onPress={() => void sheets.reload()} />
          </View>
        ) : null}
        {state.status === "ready" && state.items.length === 0 ? <Note t={t} tone="body">{tr("recChords.none")}</Note> : null}
        {MOCKUP_DATA ? <Note t={t}>{tr("recChordsForm.preview")}</Note> : null}

        {present.length > 1 ? (
          <View style={styles.chips} accessibilityRole="radiogroup">
            {present.map((i) => (
              <Pill key={i} t={t} on={i === instrument} label={tr(`recChords.instrument.${i}`)} onPress={() => pick(() => (setInstrument(i), setIndex(0)))} />
            ))}
          </View>
        ) : null}
        {list.length > 1 ? (
          <View style={styles.chips} accessibilityRole="radiogroup">
            {list.map((s, n) => (
              <Pill key={s.id} t={t} on={s.id === sheet?.id} label={tr("recChords.chart", { n: n + 1 })} onPress={() => pick(() => setIndex(n))} />
            ))}
          </View>
        ) : null}

        {sheet ? (
          <View style={styles.sheet}>
            <View style={styles.meta}>
              <Text style={[styles.key, { color: t.ink900 }]}>{key ? tr("recChords.key", { key }) : tr("recChords.keyUnknown")}</Text>
              {sheet.status !== "published" ? (
                <View style={[styles.status2, { backgroundColor: t.sand300 }]}>
                  <Text style={[styles.status2Text, { color: t.ink900 }]}>{tr(sheet.status === "pending" ? "recChords.status.pending" : "recChords.status.rejected")}</Text>
                </View>
              ) : null}
            </View>
            {sheet.status === "rejected" && sheet.rejectedReason ? <Note t={t} tone="body">{tr("recChords.reason", { reason: sheet.rejectedReason })}</Note> : null}

            {chart && sheet?.lines ? (
              <View style={styles.bleed}>
                <View style={styles.bleedPad}>
                  <ChartCreditLine t={t} chart={chart} />
                  <ChartMeta t={t} chart={chart} />
                </View>
                <ChartBody t={t} chart={chart} romanLines={sheet.lines.map((l) => l.text)} />
              </View>
            ) : (
              <>
                <Stepper
                  t={t}
                  label={tr("recChords.transpose")}
                  value={shift === 0 ? tr("recChords.original") : tr("recChords.shifted", { steps: stepsLabel(shift) })}
                  downLabel={tr("recChords.down")}
                  upLabel={tr("recChords.up")}
                  canDown={shift > -MAX_SHIFT}
                  canUp={shift < MAX_SHIFT}
                  onDown={() => setShift((s) => clampShift(s - 1))}
                  onUp={() => setShift((s) => clampShift(s + 1))}
                />
                <ChartText t={t} body={shown} />
              </>
            )}
            {sheet.note ? (
              <Text selectable style={[styles.sheetNote, { color: t.ink800 }]}>
                {sheet.note}
              </Text>
            ) : null}
            <Note t={t}>{by}</Note>
            {sheet.mine && sheet.replaces && sheet.status !== "published" ? <Note t={t} tone="body">{tr("recChart.replaces")}</Note> : null}
            <Note t={t}>{tr("recChords.noTiming")}</Note>
            <Note t={t}>{tr("recChords.unchecked")}</Note>

            <View style={styles.actions}>
              {chart && !sheet.mine && sheet.status === "published" && onFrom ? <Button t={t} variant="quiet" label={tr("recChart.startFrom")} onPress={() => onFrom(sheet)} /> : null}
              {chart && sheet.mine && sheet.status === "published" && onCopy ? <Button t={t} variant="quiet" label={tr("recChart.editCopy")} onPress={() => onCopy(sheet)} /> : null}
              {!sheet.mine && sheet.status === "published" ? <Button t={t} variant="quiet" label={tr("recChords.report")} onPress={() => setPanel(panel === "report" ? null : "report")} /> : null}
              {sheet.mine && sheet.status !== "published" ? <Button t={t} variant="quiet" label={tr("recChords.change")} onPress={() => onChange(sheet)} /> : null}
              {sheet.mine || sheet.canReview ? <Button t={t} variant="quiet" tone="danger" label={tr("recChords.delete")} onPress={() => setPanel(panel === "delete" ? null : "delete")} /> : null}
            </View>

            {panel === "report" ? (
              <ReportPanel
                t={t}
                title={tr("recChords.report.title")}
                reasons={REASONS.map((r) => ({ id: r, label: tr(`recChords.report.${r}`) }))}
                sendLabel={tr("recChords.report.send")}
                sendingLabel={tr("recChordsForm.sending")}
                cancelLabel={tr("recChords.report.cancel")}
                onCancel={() => setPanel(null)}
                onSend={async (reason) => {
                  const result = await sheets.report(sheet.id, reason as SheetReportReason)
                  if (!result.ok) return sheetFailureText(tr, result.failure)
                  setNote(tr(MOCKUP_DATA ? "recChords.report.demo" : result.status === "already_reported" ? "recChords.report.already" : "recChords.report.sent"))
                  setPanel(null)
                  return null
                }}
              />
            ) : null}
            {panel === "delete" ? (
              <DeletePanel
                t={t}
                title={tr("recChords.delete.ask")}
                body={tr("recChords.delete.body")}
                confirmLabel={tr("recChords.delete.yes")}
                cancelLabel={tr("recChords.delete.keep")}
                onCancel={() => setPanel(null)}
                onConfirm={async () => {
                  const failure = await sheets.remove(sheet.id)
                  if (failure) return sheetFailureText(tr, failure)
                  setPanel(null)
                  setIndex(0)
                  return null
                }}
              />
            ) : null}
            {note ? <Note t={t} tone="body">{note}</Note> : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Button t={t} label={tr(state.items.length > 0 ? "recChords.addMore" : "recChords.add")} onPress={onAdd} />
        </View>
      </View>
    </SpSheet>
  )
}

function Pill({ t, on, label, onPress }: { t: SpTheme; on: boolean; label: string; onPress: () => void }) {
  return (
    <SpPress onPress={onPress} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected: on }} pressedScale={0.96} style={[styles.pill, { backgroundColor: on ? t.action : "transparent", borderColor: on ? t.action : t.ink800 }]}>
      <Text style={[styles.pillText, { color: on ? t.onAction : t.ink900 }]}>{label}</Text>
    </SpPress>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: amFonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.64 },
  close: { minHeight: 44, minWidth: 44, alignItems: "flex-end", justifyContent: "center" },
  closeText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  status: { gap: 12, alignItems: "flex-start", paddingVertical: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { minHeight: 44, paddingHorizontal: 16, borderRadius: R_ROUND, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  sheet: { gap: 12 },
  // the chart view pads its own sides: take back the sheet's padding so the letters sit where they do on the song page
  bleed: { marginHorizontal: -20, gap: 8 },
  bleedPad: { paddingHorizontal: 20 },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  key: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 24 },
  status2: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: R_ROUND },
  status2Text: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18 },
  sheetNote: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footer: { paddingTop: 8, alignItems: "flex-start" },
})
