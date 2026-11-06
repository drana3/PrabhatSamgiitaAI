import { useCallback, useEffect, useState } from "react"
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ChartPreview } from "@/components/song-chords/ChartPreview"
import { ActionButton, CORNER, Chip, Hint } from "@/components/song-chords/parts"
import { KPress } from "@/components/kirtan/KPress"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongLyrics } from "@/hooks/useSongLyrics"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { useT } from "@/lib/i18n"
import { chordFailure, chordsBackend } from "@/lib/songChords/backend"
import type { ReviewFilter, ReviewItem } from "@/lib/songChords/types"
import { keyLabel } from "@/lib/songPage/spChords"
import { href } from "@/utils/href"

const FILTERS: readonly ReviewFilter[] = ["pending", "reported", "published", "rejected"]

/**
 * The team's review screen: charts that wait for a first look, reported ones, live ones and rejected ones. Each card
 * opens into the chart as the song page will draw it (a waiting chart is not on the song page for anyone but its
 * author), then Publish / Reject (with a reason the author reads) / Publish again / Take down.
 */
export default function ChordsReviewScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const top = Platform.OS === "web" ? 24 : Math.max(insets.top, 16)
  const [filter, setFilter] = useState<ReviewFilter>("pending")
  const [state, setState] = useState<{ status: "loading" | "ready" | "error" | "denied"; items: ReviewItem[] }>({ status: "loading", items: [] })

  const load = useCallback(() => {
    let active = true
    setState((s0) => ({ status: "loading", items: s0.items }))
    chordsBackend()
      .reviewQueue(filter)
      .then((queue) => {
        if (active) setState({ status: "ready", items: queue.items })
      })
      .catch((error) => {
        if (active) setState({ status: chordFailure(error) === "forbidden" ? "denied" : "error", items: [] })
      })
    return () => {
      active = false
    }
  }, [filter])
  useEffect(() => load(), [load])

  const replace = (item: ReviewItem) => setState((s0) => ({ ...s0, items: s0.items.filter((p) => p.id !== item.id) }))

  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <View style={[s.bar, { paddingTop: top }]}>
        <KPress accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace(href("/upload")))} pressedScale={0.95} style={[s.back, { borderColor: theme.line, backgroundColor: theme.card }]}>
          <Text style={[s.backText, { color: theme.textHeading }]}>{t("common.back")}</Text>
        </KPress>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 16) + 48 }]}>
        <View>
          <Text style={[s.over, { color: theme.accent }]}>{t("chordReview.over")}</Text>
          <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {t("chordReview.title")}
          </Text>
        </View>
        <View style={s.chips} accessibilityRole="tablist" accessibilityLabel={t("chordReview.filter.a11y")}>
          {FILTERS.map((f) => (
            <Chip key={f} theme={theme} label={t(`chordReview.filter.${f}` as "chordReview.filter.pending")} on={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>
        {state.status === "loading" && state.items.length === 0 ? <Hint theme={theme}>{t("chordReview.loading")}</Hint> : null}
        {state.status === "error" ? <Hint theme={theme} tone="danger">{t("chordReview.error")}</Hint> : null}
        {state.status === "denied" ? <Hint theme={theme} tone="danger">{t("chordReview.denied")}</Hint> : null}
        {state.status === "ready" && state.items.length === 0 ? <Hint theme={theme}>{t("chordReview.empty")}</Hint> : null}
        {state.items.map((item) => (
          <ReviewCard key={item.id} item={item} filter={filter} onDone={replace} />
        ))}
      </ScrollView>
    </View>
  )
}

function ReviewCard({ item, filter, onDone }: { item: ReviewItem; filter: ReviewFilter; onDone: (item: ReviewItem) => void }) {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const spTheme = useSpTheme()
  const [open, setOpen] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const lyrics = useSongLyrics(open ? item.songId : null)

  const run = async (work: () => Promise<ReviewItem>) => {
    setBusy(true)
    setProblem(null)
    try {
      const done = await work()
      // the filter decides whether the card still belongs in this list
      onDone(done)
    } catch {
      setProblem(t("chordReview.failed"))
    } finally {
      setBusy(false)
    }
  }
  const backend = chordsBackend()
  const meta =
    item.instrument === "guitar"
      ? item.capo > 0
        ? t("chordOffer.meta.guitar", { capo: item.capo, key: keyLabel(item.baseKey) })
        : t("chordOffer.meta.guitarNoCapo", { key: keyLabel(item.baseKey) })
      : t("chordOffer.meta.harmonium", { key: keyLabel(item.baseKey) })
  const live = item.status === "published"
  const rejectedNow = item.status === "rejected"
  const tooShort = reason.trim().length < 3
  void filter

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Text style={[s.title, { color: theme.textHeading }]}>{t("chordOffer.song", { number: item.songId })}</Text>
      <Text style={[s.meta, { color: theme.textBody }]}>{meta}</Text>
      <Text style={[s.meta, { color: theme.textBody }]}>{item.isAnonymous ? t("chordReview.authorAnonymous", { name: item.authorName }) : t("chordReview.author", { name: item.authorName })}</Text>
      {item.reportsCount > 0 ? <Text style={[s.meta, { color: theme.dangerText }]}>{t("chordReview.reports", { count: item.reportsCount })}</Text> : null}
      {item.note ? <Text style={[s.meta, { color: theme.textHeading }]}>{t("chordSong.note", { note: item.note })}</Text> : null}
      {rejectedNow && item.rejectedReason ? <Hint theme={theme} tone="danger">{t("chordOffer.rejectedWhy", { reason: item.rejectedReason })}</Hint> : null}

      <View style={s.row}>
        <ActionButton theme={theme} tone="quiet" label={open ? t("chordReview.hide") : t("chordReview.look")} onPress={() => setOpen((v) => !v)} style={s.half} />
        <ActionButton theme={theme} tone="quiet" label={t("upload.mine.open")} onPress={() => router.push(href(`/song-v2/ps-${item.songId}`))} style={s.half} />
      </View>

      {open ? (
        lyrics.status === "ready" ? (
          <ChartPreview t={spTheme} romanLines={lyrics.lines} proposal={item} capo={item.instrument === "guitar" ? item.capo : 0} harmoniumKey={item.baseKey} />
        ) : lyrics.status === "loading" ? (
          <Hint theme={theme}>{t("chordOffer.lyrics.loading")}</Hint>
        ) : (
          <Hint theme={theme} tone="danger">{lyrics.status === "none" ? t("chordOffer.lyrics.none") : t("chordOffer.lyrics.error")}</Hint>
        )
      ) : null}

      {rejecting ? (
        <View style={s.reject}>
          <Text style={[s.meta, { color: theme.textHeading }]}>{t("chordReview.reason.label")}</Text>
          <View style={[s.input, { backgroundColor: theme.page, borderColor: theme.line }]}>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={t("chordReview.reason.placeholder")}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t("chordReview.reason.label")}
              multiline
              maxLength={500}
              style={[s.inputText, { color: theme.textHeading }]}
            />
          </View>
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
  back: { minHeight: 44, paddingHorizontal: 16, borderRadius: CORNER, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
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
  reject: { gap: 8 },
  input: { borderWidth: 1.5, borderRadius: CORNER, paddingHorizontal: 12, minHeight: 80, borderColor: amColors.sand400 },
  inputText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 10, minHeight: 80, textAlignVertical: "top", outlineStyle: "none" as never },
})
