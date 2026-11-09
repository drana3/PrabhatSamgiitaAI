import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { KPress } from "@/components/kirtan/KPress"
import { CORNER, Hint } from "@/components/song-chords/parts"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { kindHasCharts } from "@/lib/recordingChords/kinds"
import { draftProblem, isBlankDraft, newSheetDraft } from "@/lib/recordingChords/rules"
import { chartDraftHref } from "@/lib/recordingExtras/links"
import { countChords } from "@/lib/songChords/draft"
import { href } from "@/utils/href"
import { draftProblemText, sheetFailureText } from "@/lib/recordingChords/words"
import { useAuthStore } from "@/stores/authStore"
import { useRecordingChordsPendingStore } from "@/stores/recordingChordsPendingStore"

import { ChordFields } from "./ChordFields"

/**
 * "Do you know the chords? Add guitar chords": the optional, collapsed-by-default question at upload time (a queue row,
 * a track of a playlist). The chords go with the recording once it is published; they are never a condition of it.
 * Before the send it shows the form; after the send the row says whether the chords arrived and offers a retry.
 */
export function ChordsPrompt({ theme, rowKey, title, locked, kind }: { theme: SongsTheme; rowKey: string; title: string; locked?: boolean; kind?: string | null }) {
  const t = useT()
  const router = useRouter()
  const chart = useRecordingChordsPendingStore((s) => s.chartDrafts[rowKey])
  const setChartDraft = useRecordingChordsPendingStore((s) => s.setChartDraft)
  const [open, setOpen] = useState(false)
  const draft = useRecordingChordsPendingStore((s) => s.drafts[rowKey])
  const result = useRecordingChordsPendingStore((s) => s.results[rowKey])
  const setDraft = useRecordingChordsPendingStore((s) => s.setDraft)
  const retry = useRecordingChordsPendingStore((s) => s.retry)
  const name = useAuthStore((s) => (s.mode === "signed_in" ? s.displayName : ""))

  if (result?.status === "sent") {
    return (
      <View style={s.line}>
        <Hint theme={theme}>{t("recChordsForm.afterUpload.sent", { title })}</Hint>
      </View>
    )
  }
  if (result?.status === "failed") {
    return (
      <View style={s.line}>
        <Hint theme={theme} tone="danger">{t("recChordsForm.afterUpload.failed", { reason: sheetFailureText(t, result.failure ?? "server") })}</Hint>
        <KPress accessibilityRole="button" accessibilityLabel={t("recChordsForm.afterUpload.retry")} onPress={() => void retry(rowKey)} pressedScale={0.97} style={[s.retry, { borderColor: theme.line }]}>
          <Text style={[s.retryText, { color: theme.textHeading }]}>{t("recChordsForm.afterUpload.retry")}</Text>
        </KPress>
      </View>
    )
  }
  if (locked) return null

  // a Bhajan and a Spiritual song: the words first, then a chord over every word, on the same screen as a published recording
  if (kindHasCharts(kind)) {
    const open = () => router.push(href(chartDraftHref({ row: rowKey, kind: kind ?? undefined, title })))
    return (
      <View style={s.root}>
        <KPress
          accessibilityRole="button"
          accessibilityLabel={t(chart ? "recChordsForm.words.change" : "recChordsForm.words.add")}
          onPress={open}
          pressedScale={0.98}
          style={[s.toggle, { borderColor: theme.line, backgroundColor: theme.card }]}
        >
          <Text style={[s.toggleText, { color: theme.textHeading }]}>{t(chart ? "recChordsForm.words.added" : "recChordsForm.words.closed")}</Text>
        </KPress>
        {chart ? (
          <View style={s.line}>
            <Hint theme={theme}>
              {t("recChordsForm.words.summary", { instrument: t(`chordOffer.instrument.${chart.instrument}` as never), lines: chart.text.filter(Boolean).length, chords: countChords(chart) })}
            </Hint>
            <View style={s.actions}>
              <KPress accessibilityRole="button" accessibilityLabel={t("recChordsForm.words.change")} onPress={open} pressedScale={0.97} style={[s.retry, { borderColor: theme.line }]}>
                <Text style={[s.retryText, { color: theme.textHeading }]}>{t("recChordsForm.words.change")}</Text>
              </KPress>
              <KPress accessibilityRole="button" accessibilityLabel={t("recChordsForm.words.remove")} onPress={() => setChartDraft(rowKey, null)} pressedScale={0.97} style={[s.retry, { borderColor: theme.line }]}>
                <Text style={[s.retryText, { color: theme.textHeading }]}>{t("recChordsForm.words.remove")}</Text>
              </KPress>
            </View>
          </View>
        ) : (
          <Hint theme={theme}>{t("recChordsForm.words.hint")}</Hint>
        )}
      </View>
    )
  }

  const value = draft ?? newSheetDraft("guitar")
  const blank = isBlankDraft(value)
  const problem = blank ? null : draftProblem(value)
  const problemText = problem ? draftProblemText(t, problem) : null

  return (
    <View style={s.root}>
      <KPress
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t(open ? "recChordsForm.prompt.open" : "recChordsForm.prompt.closed")}
        onPress={() => setOpen((v) => !v)}
        pressedScale={0.98}
        style={[s.toggle, { borderColor: theme.line, backgroundColor: theme.card }]}
      >
        <Text style={[s.toggleText, { color: theme.textHeading }]}>{t(open ? "recChordsForm.prompt.open" : !blank ? "recChordsForm.prompt.added" : "recChordsForm.prompt.closed")}</Text>
      </KPress>
      {open ? (
        <View style={s.form}>
          <Hint theme={theme}>{t("recChordsForm.prompt.hint")}</Hint>
          <ChordFields theme={theme} draft={value} onChange={(next) => setDraft(rowKey, next)} name={name} problem={problemText} review />
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 12 },
  line: { gap: 8, paddingTop: 4 },
  toggle: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, borderRadius: CORNER, borderWidth: 1.5, justifyContent: "center" },
  toggleText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  form: { gap: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  retry: { minHeight: 44, paddingHorizontal: 16, borderRadius: 9999, borderWidth: 1.5, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  retryText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
})
