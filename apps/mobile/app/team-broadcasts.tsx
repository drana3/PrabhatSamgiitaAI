import { useCallback, useEffect, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { DecisionRow, ReviewBroadcastCard, SuggestionCard } from "@/components/broadcasts/ReviewBroadcastCard"
import { KPress } from "@/components/kirtan/KPress"
import { ActionButton, Chip, Hint, PILL } from "@/components/song-chords/parts"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { broadcastReviewBackend, broadcastReviewFailure } from "@/lib/broadcastReview/backend"
import type { ReviewAction } from "@/lib/broadcastReview/rules"
import type { Decision, ReviewedBroadcast, Suggestion } from "@/lib/broadcastReview/types"
import { useT } from "@/lib/i18n"
import { badgeLabel } from "@/lib/teamReview/rules"
import { href } from "@/utils/href"

type Tab = "queue" | "recordings" | "hidden" | "removed" | "history"
const TABS: readonly Tab[] = ["queue", "recordings", "hidden", "removed", "history"]
type Status = "loading" | "ready" | "error" | "offline" | "denied"
type Rows = { broadcasts: ReviewedBroadcast[]; suggestions: Suggestion[]; decisions: Decision[] }
const EMPTY: Rows = { broadcasts: [], suggestions: [], decisions: [] }

/**
 * The team's desk for live broadcasts, patterned on the review and claims desks: the queue (broadcasts with reports, the
 * anonymous ones that did not count shown as such, and the ones the reports hid), recordings members suggested, what the team
 * hid or removed, and the history of verdicts. Keep, Hide and Remove (with a reason the author reads). A link is shown as text
 * with an Open button, never embedded. Team only: the server decides, and a refusal shows the "only the team" sentence.
 * Opened from the Upload hub's team row (docs/broadcasts.md).
 */
export default function TeamBroadcastsScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const top = useScreenTop()
  const [tab, setTab] = useState<Tab>("queue")
  const [state, setState] = useState<{ status: Status; rows: Rows }>({ status: "loading", rows: EMPTY })
  const [counts, setCounts] = useState({ queue: 0, recordings: 0 })
  const [reload, setReload] = useState(0)

  const refreshCounts = useCallback(() => {
    const backend = broadcastReviewBackend()
    void Promise.all([backend.queue("queue"), backend.suggestions()])
      .then(([queue, recordings]) => setCounts({ queue: queue.total, recordings: recordings.total }))
      .catch(() => undefined)
  }, [])
  useEffect(() => refreshCounts(), [refreshCounts])

  useEffect(() => {
    let active = true
    setState((before) => ({ status: "loading", rows: before.rows }))
    const backend = broadcastReviewBackend()
    const load = async (): Promise<Rows> => {
      if (tab === "history") return { ...EMPTY, decisions: (await backend.decisions()).items }
      if (tab === "recordings") return { ...EMPTY, suggestions: (await backend.suggestions()).items }
      return { ...EMPTY, broadcasts: (await backend.queue(tab)).items }
    }
    load().then(
      (rows) => active && setState({ status: "ready", rows }),
      (error: unknown) => {
        if (!active) return
        const failure = broadcastReviewFailure(error)
        setState({ status: failure === "denied" ? "denied" : failure === "network" ? "offline" : "error", rows: EMPTY })
      },
    )
    return () => {
      active = false
    }
  }, [tab, reload])

  const problemText = (failure: ReturnType<typeof broadcastReviewFailure>) => t(failure === "gone" ? "bc.rv.failed.gone" : failure === "conflict" ? "bc.rv.failed.conflict" : failure === "network" ? "teamReview.failed.offline" : failure === "reasonNeeded" ? "bc.rv.reason.short" : "teamReview.failed")

  const act = useCallback(
    async (item: ReviewedBroadcast, action: ReviewAction, reason?: string): Promise<string | null> => {
      const backend = broadcastReviewBackend()
      try {
        if (action === "keep") await backend.keep(item.id)
        else if (action === "hide") await backend.hide(item.id, reason ?? "")
        else await backend.remove(item.id, reason ?? "")
        setState((before) => ({ ...before, rows: { ...before.rows, broadcasts: before.rows.broadcasts.filter((b) => b.id !== item.id) } }))
        refreshCounts()
        return null
      } catch (error) {
        const failure = broadcastReviewFailure(error)
        if (failure === "gone" || failure === "conflict") {
          setState((before) => ({ ...before, rows: { ...before.rows, broadcasts: before.rows.broadcasts.filter((b) => b.id !== item.id) } }))
          refreshCounts()
        }
        return problemText(failure)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshCounts, t],
  )

  const decide = useCallback(
    async (item: Suggestion, accept: boolean): Promise<string | null> => {
      const backend = broadcastReviewBackend()
      try {
        if (accept) await backend.acceptSuggestion(item.id)
        else await backend.rejectSuggestion(item.id)
        setState((before) => ({ ...before, rows: { ...before.rows, suggestions: before.rows.suggestions.filter((x) => x.id !== item.id) } }))
        refreshCounts()
        return null
      } catch (error) {
        const failure = broadcastReviewFailure(error)
        if (failure === "gone" || failure === "conflict") {
          setState((before) => ({ ...before, rows: { ...before.rows, suggestions: before.rows.suggestions.filter((x) => x.id !== item.id) } }))
          refreshCounts()
        }
        return problemText(failure)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshCounts, t],
  )

  const shown = tab === "recordings" ? state.rows.suggestions.length : tab === "history" ? state.rows.decisions.length : state.rows.broadcasts.length
  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <View style={[s.bar, { paddingTop: top }]}>
        <KPress accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace(href("/upload")))} pressedScale={0.95} style={[s.back, { borderColor: theme.line, backgroundColor: theme.card }]}>
          <Text style={[s.backText, { color: theme.textHeading }]}>{t("common.back")}</Text>
        </KPress>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 16) + 48 }]}>
        <View>
          <Text style={[s.over, { color: theme.accent }]}>{t("bc.rv.over")}</Text>
          <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {t("bc.rv.title")}
          </Text>
        </View>
        <View style={s.chips} accessibilityRole="tablist" accessibilityLabel={t("bc.rv.tabs.a11y")}>
          {TABS.map((id) => {
            const badge = id === "queue" ? badgeLabel(counts.queue) : id === "recordings" ? badgeLabel(counts.recordings) : null
            const label = t(`bc.rv.tab.${id}` as "bc.rv.tab.queue")
            return <Chip key={id} theme={theme} role="radio" label={badge ? `${label}  ${badge}` : label} a11y={badge ? `${label}, ${badge}` : label} on={tab === id} onPress={() => setTab(id)} />
          })}
        </View>

        {state.status === "loading" && shown === 0 ? <Hint theme={theme}>{t("teamReview.loading")}</Hint> : null}
        {state.status === "denied" ? <Hint theme={theme} tone="danger">{t("teamReview.denied")}</Hint> : null}
        {state.status === "error" || state.status === "offline" ? (
          <View style={s.gap}>
            <Hint theme={theme} tone="danger">{t(state.status === "offline" ? "teamReview.offline" : "teamReview.error")}</Hint>
            <ActionButton theme={theme} tone="quiet" label={t("teamReview.retry")} onPress={() => setReload((n) => n + 1)} />
          </View>
        ) : null}
        {state.status === "ready" && shown === 0 ? <Hint theme={theme}>{t(`bc.rv.empty.${tab}` as "bc.rv.empty.queue")}</Hint> : null}
        {tab === "recordings" ? state.rows.suggestions.map((item) => <SuggestionCard key={item.id} item={item} onDecide={decide} />) : null}
        {tab === "history" ? state.rows.decisions.map((item) => <DecisionRow key={item.id} item={item} />) : null}
        {tab === "queue" || tab === "hidden" || tab === "removed" ? state.rows.broadcasts.map((item) => <ReviewBroadcastCard key={item.id} item={item} which={tab} onAct={act} />) : null}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { paddingHorizontal: 24, paddingBottom: 6, flexDirection: "row" },
  back: { minHeight: 44, paddingHorizontal: 16, borderRadius: PILL, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  backText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  content: { paddingHorizontal: 24, gap: 16, paddingTop: 12, maxWidth: 560, width: "100%", alignSelf: "center" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 6 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gap: { gap: 8 },
})
