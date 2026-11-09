import { StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/comments/CommentsView"
import { SectionTitle } from "@/components/song-page/ui"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"

import { Note } from "./ui"
import type { SheetsController } from "./useRecordingSheets"

/**
 * "Chords" on the recording page: how many charts members wrote, for which instrument, and the two buttons (open the
 * sheet, add your own). The chart itself opens in the sheet, where it can be moved up or down.
 */
export function ChordsBlock({ t, sheets, onOpen, onAdd }: { t: SpTheme; sheets: SheetsController; onOpen: () => void; onAdd: () => void }) {
  const tr = useT()
  const { state } = sheets
  const live = state.items.filter((s) => s.status === "published")
  const waiting = state.items.filter((s) => s.mine && s.status !== "published")
  const instruments = (["harmonium", "piano", "guitar"] as const).filter((i) => state.items.some((s) => s.instrument === i))
  return (
    <View testID="recording-chords">
      <SectionTitle t={t}>{tr("recChords.title")}</SectionTitle>
      <View style={styles.pad}>
        <Note t={t} tone="body">{tr("recChords.intro")}</Note>
        {state.status === "loading" && state.items.length === 0 ? <Note t={t}>{tr("recChords.loading")}</Note> : null}
        {state.status === "error" || state.status === "offline" ? (
          <>
            <Note t={t} tone="body">{tr(state.status === "offline" ? "recChords.offline" : "recChords.error")}</Note>
            <View style={styles.row}>
              <Button t={t} variant="quiet" label={tr("recChords.retry")} onPress={() => void sheets.reload()} />
            </View>
          </>
        ) : null}
        {state.status === "ready" && state.items.length === 0 ? <Text style={[styles.empty, { color: t.ink500 }]}>{tr("recChords.none")}</Text> : null}
        {state.items.length > 0 ? (
          <Text style={[styles.count, { color: t.ink900 }]}>
            {[tr("recChords.count", { count: live.length + waiting.length }), instruments.map((i) => tr(`recChords.instrument.${i}`)).join(", ")].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        {waiting.length > 0 ? <Note t={t}>{tr("recChords.status.pending")}</Note> : null}
        <View style={styles.row}>
          {state.items.length > 0 ? <Button t={t} label={tr("recChords.view")} onPress={onOpen} /> : null}
          <Button t={t} variant={state.items.length > 0 ? "quiet" : "solid"} label={tr("recChords.add")} onPress={onAdd} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20, gap: 8 },
  empty: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24 },
  count: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 8 },
})
