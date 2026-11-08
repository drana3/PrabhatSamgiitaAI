import { useCallback, useRef } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { Button } from "@/components/comments/CommentsView"
import { Note } from "@/components/recording-extras/ui"
import { SectionTitle } from "@/components/song-page/ui"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { usePianoSheets } from "@/hooks/usePianoSheets"
import { useT } from "@/lib/i18n"
import { pianoEditHref, pianoHref } from "@/lib/pianoNotes/links"
import type { PianoTarget } from "@/lib/pianoNotes/types"
import { href } from "@/utils/href"

/**
 * "Piano" on the recording page: how many piano sheets members wrote, and the two buttons (open them, add your own).
 * The sheets open on their own screen, where the keyboard lights the keys. Self-contained: it loads its own sheets and
 * reloads when the page is shown again (coming back from "Add notes").
 */
export function PianoBlock({ t, target, title }: { t: SpTheme; target: PianoTarget; title: string }) {
  const tr = useT()
  const router = useRouter()
  const sheets = usePianoSheets(target)
  const { state } = sheets
  const mine = state.items.filter((s) => s.mine && s.status !== "published")
  const live = state.items.filter((s) => s.status === "published")
  const first = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (!first.current) void sheets.reload()
      first.current = false
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  )
  const hasAny = live.length + mine.length > 0
  return (
    <View testID="recording-piano">
      <SectionTitle t={t}>{tr("piano.block.title")}</SectionTitle>
      <View style={styles.pad}>
        <Note t={t} tone="body">{tr("piano.block.intro")}</Note>
        {state.status === "loading" && state.items.length === 0 ? <Note t={t}>{tr("piano.loading")}</Note> : null}
        {state.status === "error" || state.status === "offline" ? (
          <>
            <Note t={t} tone="body">{tr(state.status === "offline" ? "piano.offline" : "piano.error")}</Note>
            <View style={styles.row}>
              <Button t={t} variant="quiet" label={tr("piano.retry")} onPress={() => void sheets.reload()} />
            </View>
          </>
        ) : null}
        {state.status === "ready" && !hasAny ? <Text style={[styles.empty, { color: t.ink500 }]}>{tr("piano.none")}</Text> : null}
        {hasAny ? <Text style={[styles.count, { color: t.ink900 }]}>{tr("piano.block.count", { count: live.length + mine.length })}</Text> : null}
        {mine.length > 0 ? <Note t={t}>{tr("piano.status.pending")}</Note> : null}
        <View style={styles.row}>
          {hasAny ? <Button t={t} label={tr("piano.block.open")} onPress={() => router.push(href(pianoHref(target, title)))} /> : null}
          <Button t={t} variant={hasAny ? "quiet" : "solid"} label={tr("piano.add")} onPress={() => router.push(href(pianoEditHref({ target, title })))} />
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
