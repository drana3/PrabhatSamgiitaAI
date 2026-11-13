import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { KPress } from "@/components/kirtan/KPress"
import { PianoKeyboard } from "@/components/piano/PianoKeyboard"
import { ActionButton, CORNER, Chip, Hint, PILL } from "@/components/song-chords/parts"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { pianoBackend, pianoFailure } from "@/lib/pianoNotes/backend"
import { EASY_SA, keyMidi, windowFor } from "@/lib/pianoNotes/keys"
import { pianoHref } from "@/lib/pianoNotes/links"
import { midisOf } from "@/lib/pianoNotes/rules"
import { formatSargamLine } from "@/lib/pianoNotes/sargamText"
import type { PianoHand, PianoReviewFilter, PianoReviewItem } from "@/lib/pianoNotes/types"
import { href } from "@/utils/href"

const FILTERS: readonly PianoReviewFilter[] = ["pending", "reported", "published", "rejected"]

/**
 * The team's review screen for piano notes: notes that wait for a first look, reported ones, live ones and rejected ones.
 * Each card shows the notes as text and on the keyboard (Sa on C), then Publish / Reject (with a reason the author
 * reads) / Publish again / Take down. Team only: the server decides, and a refusal shows the "only the team" sentence.
 */
export default function PianoReviewScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const top = useScreenTop()
  const [filter, setFilter] = useState<PianoReviewFilter>("pending")
  const [state, setState] = useState<{ status: "loading" | "ready" | "error" | "denied"; items: PianoReviewItem[] }>({ status: "loading", items: [] })

  const load = useCallback(() => {
    let active = true
    setState((s0) => ({ status: "loading", items: s0.items }))
    pianoBackend()
      .reviewQueue(filter)
      .then((items) => {
        if (active) setState({ status: "ready", items })
      })
      .catch((error) => {
        if (active) setState({ status: pianoFailure(error) === "forbidden" || pianoFailure(error) === "signin" ? "denied" : "error", items: [] })
      })
    return () => {
      active = false
    }
  }, [filter])
  useEffect(() => load(), [load])

  const leave = (item: PianoReviewItem) => setState((s0) => ({ ...s0, items: s0.items.filter((p) => p.id !== item.id) }))

  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <View style={[s.bar, { paddingTop: top }]}>
        <KPress accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace(href("/upload")))} pressedScale={0.95} style={[s.back, { borderColor: theme.line, backgroundColor: theme.card }]}>
          <Text style={[s.backText, { color: theme.textHeading }]}>{t("common.back")}</Text>
        </KPress>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 16) + 48 }]}>
        <View>
          <Text style={[s.over, { color: theme.accent }]}>{t("pianoReview.over")}</Text>
          <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">{t("pianoReview.title")}</Text>
        </View>
        <View style={s.chips} accessibilityRole="tablist" accessibilityLabel={t("pianoReview.filter.a11y")}>
          {FILTERS.map((f) => (
            <Chip key={f} theme={theme} label={t(`pianoReview.filter.${f}` as "pianoReview.filter.pending")} on={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>
        {state.status === "loading" && state.items.length === 0 ? <Hint theme={theme}>{t("piano.loading")}</Hint> : null}
        {state.status === "error" ? <Hint theme={theme} tone="danger">{t("pianoReview.error")}</Hint> : null}
        {state.status === "denied" ? <Hint theme={theme} tone="danger">{t("pianoReview.denied")}</Hint> : null}
        {state.status === "ready" && state.items.length === 0 ? <Hint theme={theme}>{t("pianoReview.empty")}</Hint> : null}
        {state.items.map((item) => (
          <ReviewCard key={item.id} item={item} onDone={leave} />
        ))}
      </ScrollView>
    </View>
  )
}

function ReviewCard({ item, onDone }: { item: PianoReviewItem; onDone: (item: PianoReviewItem) => void }) {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const [open, setOpen] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const backend = pianoBackend()
  const live = item.status === "published"
  const rejectedNow = item.status === "rejected"
  const tooShort = reason.trim().length < 3
  const window = useMemo(() => windowFor(midisOf(item.rows, EASY_SA)), [item.rows])
  const lit = useMemo(() => {
    const map = new Map<number, PianoHand>()
    for (const row of item.rows) for (const step of row.steps) for (const k of step.k) map.set(keyMidi(k, EASY_SA), row.hand)
    return map
  }, [item.rows])
  const where = item.target.kind === "recording" ? (item.recordingTitle ?? t("pianoReview.recording")) : t("piano.song", { number: item.target.number })

  const run = async (work: () => Promise<PianoReviewItem>) => {
    setBusy(true)
    setProblem(null)
    try {
      onDone(await work())
    } catch {
      setProblem(t("pianoReview.failed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Text style={[s.title, { color: theme.textHeading }]}>{where}</Text>
      <Text style={[s.meta, { color: theme.textBody }]}>{t(item.isAnonymous ? "pianoReview.authorAnonymous" : "pianoReview.author", { name: item.authorName })}</Text>
      <Text style={[s.meta, { color: theme.textBody }]}>{t("pianoReview.meta", { sa: item.saKey, count: item.stepsCount })}</Text>
      {item.reportsCount > 0 ? <Text style={[s.meta, { color: theme.dangerText }]}>{t("pianoReview.reports", { count: item.reportsCount })}</Text> : null}
      {item.note ? <Text style={[s.meta, { color: theme.textHeading }]}>{item.note}</Text> : null}
      {item.linkUrl ? <Text style={[s.meta, { color: theme.textHeading }]} selectable>{item.linkUrl}</Text> : null}
      {rejectedNow && item.rejectedReason ? <Hint theme={theme} tone="danger">{t("piano.status.rejected", { reason: item.rejectedReason })}</Hint> : null}

      <View style={s.row}>
        <ActionButton theme={theme} tone="quiet" label={open ? t("pianoReview.hide") : t("pianoReview.look")} onPress={() => setOpen((v) => !v)} style={s.half} />
        <ActionButton theme={theme} tone="quiet" label={t("pianoReview.open")} onPress={() => router.push(href(pianoHref(item.target, item.recordingTitle ?? undefined, item.id)))} style={s.half} />
      </View>

      {open ? (
        <View style={s.gap}>
          {item.rows.map((row, index) => (
            <Text key={index} style={[s.meta, { color: theme.textHeading }]} selectable>
              {`${row.label ?? index + 1}${row.hand === "left" ? ` (${t("piano.leftHand")})` : ""}${row.repeat > 1 ? ` ×${row.repeat}` : ""}: ${formatSargamLine(row.steps)}`}
            </Text>
          ))}
          <PianoKeyboard theme={theme} window={window} sa={EASY_SA} lit={lit} />
        </View>
      ) : null}

      {rejecting ? (
        <View style={s.gap}>
          <Text style={[s.meta, { color: theme.textHeading }]}>{t("chordReview.reason.label")}</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t("chordReview.reason.placeholder")}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={t("chordReview.reason.label")}
            multiline
            maxLength={500}
            style={[s.input, { backgroundColor: theme.page, borderColor: theme.line, color: theme.textHeading }]}
          />
          {reason.length > 0 && tooShort ? <Hint theme={theme} tone="danger">{t("chordReview.reason.short")}</Hint> : null}
          <View style={s.row}>
            <ActionButton theme={theme} tone="quiet" label={t("chordReview.reason.cancel")} onPress={() => setRejecting(false)} style={s.half} />
            <ActionButton theme={theme} label={t("chordReview.reason.send")} disabled={busy || tooShort} busy={busy} onPress={() => void run(() => backend.reject(item.id, reason.trim()))} style={s.half} />
          </View>
        </View>
      ) : (
        <View style={s.row}>
          {!live ? <ActionButton theme={theme} label={rejectedNow ? t("chordReview.restore") : t("chordReview.approve")} disabled={busy} busy={busy} onPress={() => void run(() => (rejectedNow ? backend.restore(item.id) : backend.approve(item.id)))} style={s.half} /> : null}
          {!rejectedNow ? <ActionButton theme={theme} tone="quiet" label={live ? t("chordReview.takeDown") : t("chordReview.reject")} disabled={busy} onPress={() => setRejecting(true)} style={s.half} /> : null}
        </View>
      )}
      {problem ? <Hint theme={theme} tone="danger">{problem}</Hint> : null}
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { paddingHorizontal: 24, paddingBottom: 6, flexDirection: "row" },
  back: { minHeight: 44, paddingHorizontal: 16, borderRadius: PILL, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  backText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  content: { paddingHorizontal: 24, gap: 20, paddingTop: 12, maxWidth: 560, width: "100%", alignSelf: "center" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 6 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { borderWidth: 1.5, borderRadius: CORNER, padding: 14, gap: 8 },
  title: { fontFamily: amFonts.bold, fontSize: 19, lineHeight: 24 },
  meta: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", gap: 8, marginTop: 4 },
  half: { flex: 1 },
  gap: { gap: 8 },
  input: { borderWidth: 1.5, borderRadius: CORNER, paddingHorizontal: 12, minHeight: 80, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 10, textAlignVertical: "top", outlineStyle: "none" as never },
})
