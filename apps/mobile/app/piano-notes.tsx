import { useEffect, useMemo, useState } from "react"
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { SheetTopBar } from "@/components/common/SheetTopBar"
import { PianoReader } from "@/components/piano/PianoReader"
import { ActionButton, Chip, Hint } from "@/components/song-chords/parts"
import { Reveal } from "@/components/today/motion"
import { amFonts } from "@/constants/tokens/amTypography"
import { usePianoSheets } from "@/hooks/usePianoSheets"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { pianoEditHref, targetFromParams } from "@/lib/pianoNotes/links"
import { forgetPianoRecordingIds } from "@/lib/pianoNotes/shelf"
import type { PianoReportReason, PianoSheet } from "@/lib/pianoNotes/types"
import { pianoFailureText } from "@/lib/pianoNotes/words"
import { recordingPageHref } from "@/lib/recordingExtras/links"
import { href } from "@/utils/href"

const REPORT_REASONS: readonly PianoReportReason[] = ["wrong_notes", "offensive", "spam"]

/**
 * The piano notes of a recording or a Prabhat Samgiita song (docs/piano-notation.md). Reading: pick a sheet, pick Sa
 * (easy keys, Sa on C, are on), light the keys step by step or play them. Writing: "Add your notes" opens the editor;
 * your own waiting or turned-down notes can be changed, live ones are offered again as a changed copy, other people's
 * notes can be a starting point. Stage 0 songs (1, 2, 27) carry the booklet's notes with no server at all.
 */
export default function PianoNotesScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const bottomInset = useScrollBottomInset(24)
  const params = useLocalSearchParams<{ recording?: string; song?: string; title?: string; sheet?: string }>()
  const target = useMemo(() => targetFromParams(params), [params.recording, params.song]) // eslint-disable-line react-hooks/exhaustive-deps
  const title = typeof params.title === "string" ? params.title : ""
  const sheets = usePianoSheets(target)
  const { state } = sheets
  const [pickedId, setPickedId] = useState<string | null>(typeof params.sheet === "string" ? params.sheet : null)
  const [reporting, setReporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const items = state.items
  const sheet: PianoSheet | null = items.find((s) => s.id === pickedId) ?? items[0] ?? null
  useEffect(() => {
    setMessage(null)
    setReporting(false)
  }, [sheet?.id])

  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href(target?.kind === "recording" ? recordingPageHref(target.id) : target ? `/song-v2/ps-${target.number}` : "/kiirtan"))
  }
  const edit = (kind: "edit" | "copy" | "from", id: string) => target && router.push(href(pianoEditHref({ target, title, [kind]: id })))
  const subtitle = title || (target?.kind === "song" ? t("piano.song", { number: target.number }) : "")

  const remove = async (id: string) => {
    const failure = await sheets.remove(id)
    forgetPianoRecordingIds()
    setMessage(failure ? pianoFailureText(t, failure) : t("piano.deleted"))
    setPickedId(null)
  }
  const report = async (reason: PianoReportReason) => {
    if (!sheet) return
    setReporting(false)
    const result = await sheets.report(sheet.id, reason)
    setMessage(result.ok ? t(result.status === "already_reported" ? "piano.reported.again" : "piano.reported") : pianoFailureText(t, result.failure))
  }

  const byLine = (s: PianoSheet): string => {
    if (s.fromBooklet) return t("piano.by.booklet")
    if (s.mine) return t(s.status === "published" ? "piano.by.you" : s.status === "pending" ? "piano.by.youWaiting" : "piano.by.youRejected")
    if (s.author) return t(s.byRecordingAuthor ? "piano.by.recordingAuthor" : "piano.by.name", { name: s.author.name })
    return t("piano.by.anonymous")
  }
  const label = (s: PianoSheet, index: number): string => (s.fromBooklet ? t("piano.version.booklet") : t("piano.version", { n: index + (items[0]?.fromBooklet ? 0 : 1) }))

  return (
    <View style={[s0.root, { backgroundColor: theme.page }]}>
      <SheetTopBar closeLabel={t("piano.close")} onClose={back} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[s0.content, { paddingBottom: bottomInset }]}>
        <Reveal index={0} style={s0.head}>
          {subtitle ? <Text style={[s0.over, { color: theme.accent }]} numberOfLines={2}>{subtitle}</Text> : null}
          <Text style={[s0.h1, { color: theme.textHeading }]} accessibilityRole="header">{t("piano.title")}</Text>
        </Reveal>

        {!target ? <Hint theme={theme} tone="danger">{t("piano.missing")}</Hint> : null}
        {state.status === "loading" && items.length === 0 ? <Hint theme={theme}>{t("piano.loading")}</Hint> : null}
        {(state.status === "error" || state.status === "offline") && items.length === 0 ? (
          <View style={s0.stack}>
            <Hint theme={theme} tone="danger">{t(state.status === "offline" ? "piano.offline" : "piano.error")}</Hint>
            <ActionButton theme={theme} tone="quiet" label={t("piano.retry")} onPress={() => void sheets.reload()} />
          </View>
        ) : null}
        {state.status === "ready" && items.length === 0 ? <Hint theme={theme}>{t("piano.none")}</Hint> : null}

        {items.length > 1 ? (
          <Reveal index={1}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s0.chips} accessibilityRole="tablist">
              {items.map((item, index) => (
                <Chip key={item.id} theme={theme} label={label(item, index)} on={item.id === sheet?.id} onPress={() => setPickedId(item.id)} />
              ))}
            </ScrollView>
          </Reveal>
        ) : null}

        {sheet ? (
          <Reveal index={2} style={s0.stack}>
            <View style={s0.info}>
              <Text style={[s0.by, { color: theme.textHeading }]}>{byLine(sheet)}</Text>
              {sheet.basedOn ? <Text style={[s0.meta, { color: theme.textBody }]}>{sheet.basedOn.name ? t("piano.basedOn", { name: sheet.basedOn.name }) : t("piano.basedOn.unnamed")}</Text> : null}
              {sheet.note ? <Text style={[s0.meta, { color: theme.textBody }]}>{sheet.note}</Text> : null}
              {sheet.mine && sheet.status === "pending" ? <Hint theme={theme}>{t("piano.status.pending")}</Hint> : null}
              {sheet.mine && sheet.status === "rejected" ? <Hint theme={theme} tone="danger">{t("piano.status.rejected", { reason: sheet.rejectedReason ?? "" })}</Hint> : null}
              {sheet.replaces ? <Hint theme={theme}>{t("piano.status.replaces")}</Hint> : null}
            </View>

            <PianoReader theme={theme} sheet={sheet} />

            {sheet.linkUrl ? <ActionButton theme={theme} tone="quiet" label={t("piano.link")} onPress={() => void Linking.openURL(sheet.linkUrl!)} /> : null}
            {sheet.fromBooklet ? <Hint theme={theme}>{t("piano.booklet.note")}</Hint> : <Hint theme={theme}>{t("piano.honest")}</Hint>}

            <View style={s0.stack}>
              {sheet.mine && sheet.status !== "published" ? (
                <View style={s0.row}>
                  <ActionButton theme={theme} tone="quiet" label={t("piano.edit")} onPress={() => edit("edit", sheet.id)} style={s0.flex} />
                  <ActionButton theme={theme} tone="quiet" label={t("piano.delete")} onPress={() => void remove(sheet.id)} style={s0.flex} />
                </View>
              ) : null}
              {sheet.mine && sheet.status === "published" ? (
                <View style={s0.row}>
                  <ActionButton theme={theme} tone="quiet" label={t("piano.change")} onPress={() => edit("copy", sheet.id)} style={s0.flex} />
                  <ActionButton theme={theme} tone="quiet" label={t("piano.delete")} onPress={() => void remove(sheet.id)} style={s0.flex} />
                </View>
              ) : null}
              {!sheet.mine && !sheet.fromBooklet && sheet.status === "published" ? (
                <View style={s0.row}>
                  <ActionButton theme={theme} tone="quiet" label={t("piano.from")} onPress={() => edit("from", sheet.id)} style={s0.flex} />
                  <ActionButton theme={theme} tone="quiet" label={t("piano.report")} onPress={() => setReporting((v) => !v)} style={s0.flex} />
                </View>
              ) : null}
              {sheet.fromBooklet ? <ActionButton theme={theme} tone="quiet" label={t("piano.from.booklet")} onPress={() => edit("from", sheet.id)} /> : null}
              {reporting ? (
                <View style={s0.chips} accessibilityRole="tablist">
                  {REPORT_REASONS.map((reason) => (
                    <Chip key={reason} theme={theme} role="button" label={t(`piano.reason.${reason}`)} onPress={() => void report(reason)} />
                  ))}
                </View>
              ) : null}
              {message ? <Hint theme={theme}>{message}</Hint> : null}
            </View>
          </Reveal>
        ) : null}

        {target ? (
          <ActionButton theme={theme} label={t("piano.add")} onPress={() => router.push(href(pianoEditHref({ target, title })))} />
        ) : null}
      </ScrollView>
    </View>
  )
}

const s0 = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 20, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  head: { gap: 8 },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  h1: { fontFamily: amFonts.display, fontSize: 56, lineHeight: 54, letterSpacing: -1.1, textTransform: "uppercase" },
  stack: { gap: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  info: { gap: 4 },
  by: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  meta: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
})
