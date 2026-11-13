import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import Svg, { Path } from "react-native-svg"

import { PianoNotesField } from "@/components/kirtan/add/PianoNotesField"
import { KPress } from "@/components/kirtan/KPress"
import { ChordFields } from "@/components/recording-extras/ChordFields"
import { CORNER, Chip, Hint, Label } from "@/components/song-chords/parts"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { chordsFormMode, filledList, FORM_INSTRUMENTS, FORM_NOTES_KEY, formChordKey } from "@/lib/kirtan/uploadChords"
import { useUx } from "@/lib/kirtan/useUx"
import { isBlankPianoUpload } from "@/lib/pianoNotes/uploadDraft"
import { draftProblem, isBlankDraft, newSheetDraft } from "@/lib/recordingChords/rules"
import type { SheetInstrument } from "@/lib/recordingChords/types"
import { draftProblemText, sheetFailureText } from "@/lib/recordingChords/words"
import { chartDraftHref } from "@/lib/recordingExtras/links"
import { countChords } from "@/lib/songChords/draft"
import { useAuthStore } from "@/stores/authStore"
import { usePianoNotesPendingStore } from "@/stores/pianoNotesPendingStore"
import { useRecordingChordsPendingStore } from "@/stores/recordingChordsPendingStore"
import { href } from "@/utils/href"

type PianoMode = "chords" | "notes"

/**
 * "Chords (optional)": the one collapsed section of the Add Recording form for the chords and piano notes of the recording (Dada, 13 Nov 2026).
 * Always there for every kind that takes chords (not Dance music or Baba's Audio); never required, and never blocks the upload: left empty it
 * sends nothing, and what is typed goes to the recording after it is published, with an honest line and "Send again" if it could not be sent.
 *
 * Three round chips choose which instrument forms are open (Guitar, Harmonium, Piano; one is enough, two are allowed):
 *  - Kiirtan and Prabhat Samgiita: the chords typed as plain text right here (the same fields as the upload prompt of before);
 *  - Bhajan and Spiritual song: the words with a chord over each word, on the "Words and chords" screen, one chart per instrument;
 *  - Piano also has the notes (Sa Re Ga), typed here with the parser of the piano notes editor.
 * Everything waits under the keys of lib/kirtan/uploadChords.ts and is sent with the FIRST file (`multi` says so in words).
 */
export function ChordsSection({ theme, kind, locked, title, multi }: { theme: SongsTheme; kind: string; locked?: boolean; title: string; multi: boolean }) {
  const t = useT()
  const ux = useUx()
  const router = useRouter()
  const mode = chordsFormMode(kind)
  const name = useAuthStore((s) => (s.mode === "signed_in" ? s.displayName : ""))
  const drafts = useRecordingChordsPendingStore((s) => s.drafts)
  const charts = useRecordingChordsPendingStore((s) => s.chartDrafts)
  const results = useRecordingChordsPendingStore((s) => s.results)
  const setDraft = useRecordingChordsPendingStore((s) => s.setDraft)
  const setChartDraft = useRecordingChordsPendingStore((s) => s.setChartDraft)
  const retry = useRecordingChordsPendingStore((s) => s.retry)
  const notes = usePianoNotesPendingStore((s) => s.drafts[FORM_NOTES_KEY])
  const notesResult = usePianoNotesPendingStore((s) => s.results[FORM_NOTES_KEY])

  const has = Object.fromEntries(FORM_INSTRUMENTS.map((i) => [i, mode === "chart" ? Boolean(charts[formChordKey(i)]) : Boolean(drafts[formChordKey(i)] && !isBlankDraft(drafts[formChordKey(i)]!))])) as Record<SheetInstrument, boolean>
  const hasNotes = !isBlankPianoUpload(notes)
  const anything = FORM_INSTRUMENTS.some((i) => has[i] || results[formChordKey(i)]) || hasNotes || Boolean(notesResult)
  const [open, setOpen] = useState(anything)
  const [picked, setPicked] = useState<readonly SheetInstrument[]>(() => FORM_INSTRUMENTS.filter((i) => has[i] || results[formChordKey(i)] || (i === "piano" && (hasNotes || notesResult))))
  const [pianoMode, setPianoMode] = useState<PianoMode>(hasNotes && !has.piano ? "notes" : "chords")
  if (!mode) return null

  const instrumentLabel = (i: SheetInstrument) => ux(`ux.inst.${i}`)
  const summary = filledList(has, instrumentLabel, hasNotes, ux("ux.piano.notes"))
  const toggle = (i: SheetInstrument) => setPicked((now) => (now.includes(i) ? now.filter((x) => x !== i) : [...now, i]))
  // what is typed but cannot go yet: said in the header too, so a collapsed section never hides it
  const waiting = FORM_INSTRUMENTS.map((i) => {
    const draft = drafts[formChordKey(i)]
    const problem = mode === "text" && draft && !isBlankDraft(draft) ? draftProblem(draft) : null
    return problem ? draftProblemText(t, problem) : null
  }).find(Boolean)

  const chordPanel = (i: SheetInstrument) => {
    const key = formChordKey(i)
    const result = results[key]
    if (result?.status === "sent") return <Hint theme={theme}>{t("recChordsForm.afterUpload.sent", { title: result.title })}</Hint>
    if (result?.status === "failed") {
      return (
        <View style={s.group}>
          <Hint theme={theme} tone="danger">{t("recChordsForm.afterUpload.failed", { reason: sheetFailureText(t, result.failure ?? "server") })}</Hint>
          <KPress accessibilityRole="button" accessibilityLabel={t("recChordsForm.afterUpload.retry")} onPress={() => void retry(key)} pressedScale={0.97} style={[s.retry, { borderColor: theme.line }]}>
            <Text style={[s.retryText, { color: theme.textHeading }]}>{t("recChordsForm.afterUpload.retry")}</Text>
          </KPress>
        </View>
      )
    }
    if (mode === "chart") {
      const chart = charts[key]
      const go = () => router.push(href(chartDraftHref({ row: key, kind, title, instrument: i })))
      return (
        <View style={s.group}>
          <KPress accessibilityRole="button" accessibilityLabel={t(chart ? "recChordsForm.words.change" : "recChordsForm.words.add")} onPress={() => !locked && go()} pressedScale={0.98} style={[s.toggle, { borderColor: theme.line, backgroundColor: theme.card }]} testID={`chart-${i}`}>
            <Text style={[s.toggleText, { color: theme.textHeading }]}>{t(chart ? "recChordsForm.words.added" : "recChordsForm.words.closed")}</Text>
          </KPress>
          {chart ? (
            <>
              <Hint theme={theme}>{t("recChordsForm.words.summary", { instrument: t(`chordOffer.instrument.${chart.instrument}` as never), lines: chart.text.filter(Boolean).length, chords: countChords(chart) })}</Hint>
              <View style={s.actions}>
                <KPress accessibilityRole="button" accessibilityLabel={t("recChordsForm.words.change")} onPress={go} pressedScale={0.97} style={[s.retry, { borderColor: theme.line }]}>
                  <Text style={[s.retryText, { color: theme.textHeading }]}>{t("recChordsForm.words.change")}</Text>
                </KPress>
                <KPress accessibilityRole="button" accessibilityLabel={t("recChordsForm.words.remove")} onPress={() => setChartDraft(key, null)} pressedScale={0.97} style={[s.retry, { borderColor: theme.line }]}>
                  <Text style={[s.retryText, { color: theme.textHeading }]}>{t("recChordsForm.words.remove")}</Text>
                </KPress>
              </View>
            </>
          ) : (
            <Hint theme={theme}>{t("recChordsForm.words.hint")}</Hint>
          )}
        </View>
      )
    }
    const draft = drafts[key] ?? newSheetDraft(i)
    const problem = isBlankDraft(draft) ? null : draftProblem(draft)
    return <ChordFields theme={theme} draft={draft} onChange={(next) => setDraft(key, { ...next, instrument: i })} name={name} problem={problem ? draftProblemText(t, problem) : null} disabled={locked} compact review />
  }

  return (
    <View style={s.root} testID="chords-section">
      <KPress
        accessibilityRole="button"
        accessibilityLabel={ux("ux.chords.title")}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((was) => !was)}
        pressedScale={0.99}
        style={[s.head, { borderColor: theme.line, backgroundColor: theme.card }]}
        testID="chords-head"
      >
        <View style={s.headText}>
          <Text style={[s.label, { color: theme.textHeading }]}>{ux("ux.chords.title")}</Text>
          {!open || summary ? <Text style={[s.hint, { color: waiting ? theme.dangerText : theme.textBody }]}>{waiting ? ux("ux.chords.problem", { reason: waiting }) : summary ? ux("ux.chords.filled", { list: summary }) : ux("ux.chords.closed")}</Text> : null}
        </View>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <Path d="M6 9l6 6 6-6" stroke={theme.textBody} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </KPress>

      {open ? (
        <View style={s.body}>
          <View style={s.group}>
            <Label theme={theme}>{ux("ux.chords.pick")}</Label>
            <View style={s.chips} accessibilityRole="radiogroup">
              {FORM_INSTRUMENTS.map((i) => (
                <Chip key={i} theme={theme} label={instrumentLabel(i)} on={picked.includes(i)} role="checkbox" onPress={() => toggle(i)} minWidth={96} />
              ))}
            </View>
            <Hint theme={theme}>{ux("ux.chords.pickHint")}</Hint>
          </View>

          {FORM_INSTRUMENTS.filter((i) => picked.includes(i)).map((i) => (
            <View key={i} style={[s.panel, { borderColor: theme.line }]} testID={`chords-panel-${i}`}>
              <Label theme={theme}>{instrumentLabel(i)}</Label>
              {i === "piano" ? (
                <View style={s.chips} accessibilityRole="radiogroup">
                  <Chip theme={theme} label={ux("ux.piano.chords")} on={pianoMode === "chords"} onPress={() => setPianoMode("chords")} minWidth={96} />
                  <Chip theme={theme} label={ux("ux.piano.notes")} on={pianoMode === "notes"} onPress={() => setPianoMode("notes")} />
                </View>
              ) : null}
              {i === "piano" && pianoMode === "notes" ? <PianoNotesField theme={theme} storeKey={FORM_NOTES_KEY} title={title} locked={locked} /> : chordPanel(i)}
            </View>
          ))}

          <Hint theme={theme}>{ux("ux.chords.skip")}</Hint>
          {multi ? <Hint theme={theme}>{ux("ux.chords.first", { title })}</Hint> : null}
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 12 },
  head: { minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  body: { gap: 16, paddingTop: 4 },
  group: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  panel: { gap: 12, borderTopWidth: 1, paddingTop: 16 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  toggle: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, borderRadius: CORNER, borderWidth: 1.5, justifyContent: "center" },
  toggleText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  retry: { minHeight: 44, paddingHorizontal: 16, borderRadius: 9999, borderWidth: 1.5, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  retryText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
})
