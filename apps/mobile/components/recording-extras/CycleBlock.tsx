import { useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"

import { Button } from "@/components/comments/CommentsView"
import { BlockStack, Section } from "@/components/common/Layout"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { SCREEN_SIDE } from "@/lib/layout"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { isCycle, tuneLine, tuneNumbered } from "@/lib/recordingChords/cycle"
import type { RecordingSheet, SheetCycleTune, SheetInstrument, SheetReportReason } from "@/lib/recordingChords/types"
import { sheetFailureText } from "@/lib/recordingChords/words"

import { CycleRing } from "./CycleRing"
import { DeletePanel, ReportPanel } from "./Panels"
import { Note, R_ROUND } from "./ui"
import type { SheetsController } from "./useRecordingSheets"

const REASONS: SheetReportReason[] = ["wrong_chords", "offensive", "spam", "other"]
const INSTRUMENTS: SheetInstrument[] = ["guitar", "harmonium"]
const MAX_RING = 288
/** past this many tunes the tabs show only the number */
const MANY = 6

/**
 * The chord cycle of a Kiirtan, at the bottom of its page (docs/kiirtan-cycle.md): every tune of the recording as a ring,
 * a switcher between the tunes, who added it, and the member's own actions (add, fix, change a copy, delete; report a
 * live one that is somebody else's). Nothing is highlighted as "playing now" and the words say so. A Kiirtan's older
 * plain-text sheets stay one tap away (`onOpenText`).
 */
export function CycleBlock({
  t,
  title,
  sheets,
  onAdd,
  onChange,
  onCopy,
  onFrom,
  onOpenText,
}: {
  t: SpTheme
  title: string
  sheets: SheetsController
  onAdd: () => void
  onChange: (sheet: RecordingSheet) => void
  onCopy: (sheet: RecordingSheet) => void
  /** start from this cycle; `tune` is the number of a tune that has no chords yet and is being added */
  onFrom: (sheet: RecordingSheet, tune?: number) => void
  onOpenText: () => void
}) {
  const tr = useT()
  const { width } = useWindowDimensions()
  const { state } = sheets
  const cycles = useMemo(() => state.items.filter(isCycle), [state.items])
  const text = state.items.filter((s) => !isCycle(s) && !s.lines)
  const [instrument, setInstrument] = useState<SheetInstrument>("guitar")
  const [version, setVersion] = useState(0)
  const [tuneNo, setTuneNo] = useState(1)
  const [panel, setPanel] = useState<null | "report" | "delete">(null)
  const [note, setNote] = useState<string | null>(null)

  const present = useMemo(() => INSTRUMENTS.filter((i) => cycles.some((s) => s.instrument === i)), [cycles])
  useEffect(() => {
    if (present.length > 0 && !present.includes(instrument)) setInstrument(present[0] as SheetInstrument)
  }, [present, instrument])
  const list = cycles.filter((s) => s.instrument === instrument)
  const sheet = list[Math.min(version, Math.max(0, list.length - 1))] ?? null
  const cycle = sheet?.cycle ?? null
  const tuneCount = cycle?.tuneCount ?? 0
  const picked = Math.min(Math.max(1, tuneNo), Math.max(1, tuneCount))
  const tune: SheetCycleTune | null = cycle ? (tuneNumbered(cycle, picked) ?? null) : null

  const tabsRef = useRef<ScrollView>(null)
  const tabX = useRef<Record<number, number>>({})
  const pickTune = (n: number) => {
    setTuneNo(n)
    // keep the chosen tab in view (a little of the one before it shows too)
    const x = tabX.current[n]
    if (x !== undefined) tabsRef.current?.scrollTo({ x: Math.max(0, x - 56), animated: true })
  }

  const reset = (next: () => void) => {
    next()
    setTuneNo(1)
    setPanel(null)
    setNote(null)
  }
  const size = Math.min(MAX_RING, Math.min(width, 640) - 2 * SCREEN_SIDE)
  const by = !sheet ? "" : sheet.mine ? tr("recChords.by.you") : sheet.author ? tr("recChords.by", { name: sheet.author.name }) : tr("recChords.by.anonymous")
  const tuneName = (n: number) => {
    const f = cycle ? tuneNumbered(cycle, n) : undefined
    return f?.name ? tr("recCycle.block.tuneNamed", { n, name: f.name }) : tr("recCycle.block.tune", { n })
  }

  return (
    <Section title={title}>
      <View testID="recording-cycle">
        <BlockStack gap={12}>
          <Note t={t} tone="body">{tr("recCycle.block.intro")}</Note>
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
          {state.status === "ready" && cycles.length === 0 ? <Text style={[styles.empty, { color: t.ink500 }]}>{tr("recCycle.block.none")}</Text> : null}
          {MOCKUP_DATA && cycles.length > 0 ? <Note t={t}>{tr("recChordsForm.preview")}</Note> : null}

          {present.length > 1 ? (
            <View style={styles.chips} accessibilityRole="radiogroup">
              {present.map((i) => (
                <Pill key={i} t={t} on={i === instrument} label={tr(`recChords.instrument.${i}`)} onPress={() => reset(() => (setInstrument(i), setVersion(0)))} />
              ))}
            </View>
          ) : null}
          {list.length > 1 ? (
            <View style={styles.chips} accessibilityRole="radiogroup">
              {list.map((s, n) => (
                <Pill key={s.id} t={t} on={s.id === sheet?.id} label={tr("recCycle.block.version", { n: n + 1 })} onPress={() => reset(() => setVersion(n))} />
              ))}
            </View>
          ) : null}

          {sheet && cycle ? (
            <BlockStack gap={12}>
              {sheet.status !== "published" ? (
                <View style={styles.meta}>
                  <View style={[styles.badge, { backgroundColor: t.sand300 }]}>
                    <Text style={[styles.badgeText, { color: t.ink900 }]}>{tr(sheet.status === "pending" ? "recChords.status.pending" : "recChords.status.rejected")}</Text>
                  </View>
                </View>
              ) : null}
              {sheet.status === "rejected" && sheet.rejectedReason ? <Note t={t} tone="body">{tr("recChords.reason", { reason: sheet.rejectedReason })}</Note> : null}

              {tuneCount > 1 ? (
                // many tunes (up to 30): one row that scrolls sideways and keeps the chosen tune in view, never a wall of pills
                <ScrollView
                  ref={tabsRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tabs}
                  accessibilityRole="tablist"
                  accessibilityLabel={tr("recCycle.block.tabs")}
                  testID="cycle-tabs"
                >
                  {Array.from({ length: tuneCount }, (_, i) => i + 1).map((n) => (
                    <Pill
                      key={n}
                      t={t}
                      on={n === picked}
                      dim={!tuneNumbered(cycle, n)}
                      role="tab"
                      label={tuneCount > MANY ? String(n) : tr("recCycle.block.tune", { n })}
                      a11y={tuneName(n) + (tuneNumbered(cycle, n) ? "" : `, ${tr("recCycle.review.noChords")}`)}
                      onLayout={(x) => (tabX.current[n] = x)}
                      onPress={() => pickTune(n)}
                    />
                  ))}
                </ScrollView>
              ) : null}
              {tuneCount > MANY ? <Text style={[styles.position, { color: t.ink500 }]}>{tr("recCycle.block.position", { n: picked, total: tuneCount })}</Text> : null}

              {tune ? (
                <>
                  {tune.name || tuneCount > 1 ? <Text style={[styles.tuneName, { color: t.ink900 }]}>{tuneName(picked)}</Text> : null}
                  <CycleRing
                    t={t}
                    chords={tune.chords}
                    start={tune.start}
                    size={size}
                    centre={tune.times ? `×${tune.times}` : undefined}
                    label={tr("recCycle.ring.a11y", { n: picked, chords: tune.chords.join(", "), start: tune.chords[tune.start] ?? "" })}
                  />
                  <View style={styles.summary}>
                    <Text selectable style={[styles.line, { color: t.ink900 }]} testID="cycle-line">
                      {tuneLine(tune)}
                    </Text>
                    <Text style={[styles.facts, { color: t.ink800 }]}>
                      {[tune.key ? tr("recCycle.block.key", { key: tune.key }) : "", tr("recCycle.block.starts", { chord: tune.chords[tune.start] ?? "" }), tune.times ? tr("recCycle.block.times", { count: tune.times }) : ""].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.summary} testID="cycle-no-chords">
                  <Text style={[styles.tuneName, { color: t.ink900 }]}>{tuneName(picked)}</Text>
                  <Text style={[styles.facts, { color: t.ink800 }]}>{tr("recCycle.block.noChords")}</Text>
                  {!sheet.mine && sheet.status === "published" ? <Button t={t} variant="quiet" label={tr("recCycle.block.addTune", { n: picked })} onPress={() => onFrom(sheet, picked)} /> : null}
                </View>
              )}

              {sheet.note ? (
                <Text selectable style={[styles.sheetNote, { color: t.ink800 }]}>
                  {sheet.note}
                </Text>
              ) : null}
              <Note t={t}>{by}</Note>
              {sheet.mine && sheet.replaces && sheet.status !== "published" ? <Note t={t} tone="body">{tr("recCycle.replaces")}</Note> : null}
              <Note t={t}>{tr("recCycle.block.noTiming")}</Note>
              <Note t={t}>{tr("recChords.unchecked")}</Note>

              <View style={styles.actions}>
                {!sheet.mine && sheet.status === "published" ? <Button t={t} variant="quiet" label={tr("recCycle.startFrom")} onPress={() => onFrom(sheet)} /> : null}
                {sheet.mine && sheet.status === "published" ? <Button t={t} variant="quiet" label={tr("recCycle.editCopy")} onPress={() => onCopy(sheet)} /> : null}
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
                    setVersion(0)
                    return null
                  }}
                />
              ) : null}
              {note ? <Note t={t} tone="body">{note}</Note> : null}
            </BlockStack>
          ) : null}

          <View style={styles.actions}>
            <Button t={t} variant={cycles.length > 0 ? "quiet" : "solid"} label={tr(cycles.length > 0 ? "recCycle.block.addMore" : "recCycle.block.add")} onPress={onAdd} />
            {text.length > 0 ? <Button t={t} variant="quiet" label={tr("recCycle.block.textSheets", { count: text.length })} onPress={onOpenText} /> : null}
          </View>
        </BlockStack>
      </View>
    </Section>
  )
}

function Pill({ t, on, label, onPress, role = "radio", a11y, dim, onLayout }: { t: SpTheme; on: boolean; label: string; onPress: () => void; role?: "radio" | "tab"; a11y?: string; dim?: boolean; onLayout?: (x: number) => void }) {
  const pill = (
    <SpPress
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected: on }}
      pressedScale={0.96}
      style={[styles.pill, { backgroundColor: on ? t.action : "transparent", borderColor: on ? t.action : dim ? t.ink500 : t.ink800 }, dim && !on ? styles.dim : null]}
    >
      <Text style={[styles.pillText, { color: on ? t.onAction : dim ? t.ink500 : t.ink900 }]}>{label}</Text>
    </SpPress>
  )
  return onLayout ? <View onLayout={(e) => onLayout(e.nativeEvent.layout.x)}>{pill}</View> : pill
}

const styles = StyleSheet.create({
  status: { gap: 12, alignItems: "flex-start" },
  empty: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tabs: { flexDirection: "row", gap: 8, paddingRight: 16 },
  dim: { borderStyle: "dashed" },
  position: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, textAlign: "center" },
  pill: { minWidth: 44, minHeight: 44, paddingHorizontal: 16, borderRadius: R_ROUND, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: R_ROUND },
  badgeText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18 },
  summary: { gap: 4, alignItems: "center" },
  tuneName: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 24, textAlign: "center" },
  line: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 28, textAlign: "center" },
  facts: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, textAlign: "center" },
  sheetNote: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
})
