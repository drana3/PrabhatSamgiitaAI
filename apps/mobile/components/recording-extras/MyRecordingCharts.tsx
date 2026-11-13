import { useCallback, useEffect, useRef, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { KPress } from "@/components/kirtan/KPress"
import { ActionButton, CORNER, Hint } from "@/components/song-chords/parts"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { sheetFailure, sheetsBackend } from "@/lib/recordingChords/backend"
import type { RecordingSheet } from "@/lib/recordingChords/types"
import { sheetFailureText } from "@/lib/recordingChords/words"
import { isChart } from "@/lib/recordingChords/chart"
import { isCycle } from "@/lib/recordingChords/cycle"
import { recordingPageHref, sheetFormHref } from "@/lib/recordingExtras/links"
import { href } from "@/utils/href"

/**
 * "Your recording chords" on the Upload hub, under "Your chord charts" (which is about songs, and is untouched): the
 * charts the member wrote for recordings, each with where it stands (live, waiting for the team, not published),
 * the team's reason when it was not, and what can be done (open the recording, change a waiting or rejected one,
 * delete). Every state is said: loading, could not load, nothing yet.
 */
export function MyRecordingCharts({ theme, reloadKey }: { theme: SongsTheme; reloadKey: number }) {
  const t = useT()
  const router = useRouter()
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; items: RecordingSheet[] }>({ status: "loading", items: [] })
  const [asking, setAsking] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading" }))
    try {
      const items = await sheetsBackend().mine()
      if (alive.current) setState({ status: "ready", items })
    } catch {
      if (alive.current) setState((s) => ({ ...s, status: "error" }))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load, reloadKey])

  const remove = async (id: string) => {
    try {
      await sheetsBackend().remove(id)
    } catch (error) {
      const failure = sheetFailure(error)
      if (failure !== "gone") {
        setMessage(sheetFailureText(t, failure))
        return
      }
    }
    if (!alive.current) return
    setAsking(null)
    setMessage(t("recChordsHub.deleted"))
    setState((s) => ({ ...s, items: s.items.filter((x) => x.id !== id) }))
  }

  return (
    <View style={s.stack} testID="my-recording-charts">
      {state.status === "loading" && state.items.length === 0 ? <Hint theme={theme}>{t("recChordsHub.loading")}</Hint> : null}
      {state.status === "error" ? (
        <>
          <Hint theme={theme} tone="danger">{t("recChordsHub.error")}</Hint>
          <ActionButton theme={theme} tone="quiet" label={t("recChordsHub.retry")} onPress={() => void load()} />
        </>
      ) : null}
      {state.status === "ready" && state.items.length === 0 ? <Hint theme={theme}>{t("recChordsHub.empty")}</Hint> : null}
      {message ? <Hint theme={theme}>{message}</Hint> : null}
      {state.items.map((sheet) => (
        <View key={sheet.id} style={[s.row, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={2}>
            {sheet.recordingTitle ?? t("recPage.openPage")}
          </Text>
          <Text style={[s.meta, { color: theme.textBody }]}>{t("recChordsHub.meta", { instrument: t(`recChords.instrument.${sheet.instrument}`), chords: sheet.chordsCount })}</Text>
          <Text style={[s.status, { color: sheet.status === "rejected" ? theme.dangerText : sheet.status === "published" ? theme.oliveText : theme.accent }]}>{t(`recChordsHub.status.${sheet.status}`)}</Text>
          {sheet.status === "rejected" && sheet.rejectedReason ? <Hint theme={theme} tone="danger">{t("recChords.reason", { reason: sheet.rejectedReason })}</Hint> : null}
          <View style={s.actions}>
            <Mini theme={theme} label={t("recChordsHub.open")} onPress={() => router.push(href(recordingPageHref(sheet.recordingId)))} />
            {sheet.status !== "published" ? <Mini theme={theme} label={t("recChords.change")} onPress={() => router.push(href(sheetFormHref({ chart: isChart(sheet), cycle: isCycle(sheet), recordingId: sheet.recordingId, title: sheet.recordingTitle ?? undefined, edit: sheet.id })))} /> : null}
            {asking === sheet.id ? (
              <>
                <Mini theme={theme} tone="danger" label={t("recChords.delete.yes")} onPress={() => void remove(sheet.id)} />
                <Mini theme={theme} label={t("recChords.delete.keep")} onPress={() => setAsking(null)} />
              </>
            ) : (
              <Mini theme={theme} tone="danger" label={t("recChords.delete")} onPress={() => setAsking(sheet.id)} />
            )}
          </View>
          {asking === sheet.id ? <Hint theme={theme}>{t("recChords.delete.body")}</Hint> : null}
        </View>
      ))}
    </View>
  )
}

function Mini({ theme, label, onPress, tone = "quiet" }: { theme: SongsTheme; label: string; onPress: () => void; tone?: "quiet" | "danger" }) {
  return (
    <KPress accessibilityRole="button" accessibilityLabel={label} onPress={onPress} pressedScale={0.96} style={[s.mini, { borderColor: tone === "danger" ? theme.dangerText : theme.line, backgroundColor: theme.card }]}>
      <Text style={[s.miniText, { color: tone === "danger" ? theme.dangerText : theme.textHeading }]}>{label}</Text>
    </KPress>
  )
}

const s = StyleSheet.create({
  stack: { gap: 12 },
  row: { borderRadius: CORNER, borderWidth: 1, padding: 16, gap: 6 },
  title: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  meta: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  status: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18, letterSpacing: 0.52, textTransform: "uppercase" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 8 },
  mini: { minHeight: 44, paddingHorizontal: 16, borderRadius: 9999, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  miniText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20 },
})
