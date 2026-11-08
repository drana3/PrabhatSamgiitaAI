import { useCallback, useEffect, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { KPress } from "@/components/kirtan/KPress"
import { ReviewCard } from "@/components/team-review/ReviewCard"
import { ActionButton, Chip, Hint, PILL } from "@/components/song-chords/parts"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { reviewFailure, teamReviewBackend } from "@/lib/teamReview/backend"
import { badgeLabel } from "@/lib/teamReview/rules"
import { REVIEW_TABS, type Counts, type ReviewAction, type ReviewItem, type ReviewList, type ReviewTab } from "@/lib/teamReview/types"
import { href } from "@/utils/href"

type Status = "loading" | "ready" | "error" | "offline" | "denied"

/**
 * The team's review desk: one screen, three tabs (chord sheets of recordings waiting for a first look, reported
 * comments of songs and recordings, reported video links). Each tab has the open list and the removed list; every
 * item can be approved (it stays and leaves the queue), removed (with a reason) or restored. Team only: the server
 * decides, and a refusal shows the "only the team" sentence. Opened from the Upload hub's team row.
 */
export default function TeamReviewScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const top = useScreenTop()
  const [tab, setTab] = useState<ReviewTab>("sheets")
  const [list, setList] = useState<ReviewList>("open")
  const [state, setState] = useState<{ status: Status; items: ReviewItem[] }>({ status: "loading", items: [] })
  const [reload, setReload] = useState(0)
  const [counts, setCounts] = useState<Counts>({ sheets: 0, comments: 0, videos: 0 })

  const refreshCounts = useCallback(() => {
    teamReviewBackend()
      .counts()
      .then(setCounts)
      .catch(() => undefined)
  }, [])
  useEffect(() => {
    let active = true
    setState((s0) => ({ status: "loading", items: s0.items }))
    teamReviewBackend()
      .list(tab, list)
      .then((page) => {
        if (active) setState({ status: "ready", items: page.items })
      })
      .catch((error: unknown) => {
        if (!active) return
        const failure = reviewFailure(error)
        setState({ status: failure === "denied" ? "denied" : failure === "network" ? "offline" : "error", items: [] })
      })
    return () => {
      active = false
    }
  }, [tab, list, reload])
  useEffect(() => refreshCounts(), [refreshCounts])

  const act = useCallback(
    async (item: ReviewItem, action: ReviewAction, reason?: string): Promise<string | null> => {
      try {
        await teamReviewBackend().act(item, action, reason)
        setState((s0) => ({ ...s0, items: s0.items.filter((i) => i.key !== item.key) }))
        refreshCounts()
        return null
      } catch (error) {
        const failure = reviewFailure(error)
        if (failure === "gone" || failure === "conflict") {
          setState((s0) => ({ ...s0, items: s0.items.filter((i) => i.key !== item.key) }))
          refreshCounts()
        }
        return t(failure === "gone" ? "teamReview.failed.gone" : failure === "conflict" ? "teamReview.failed.conflict" : failure === "network" ? "teamReview.failed.offline" : failure === "reasonNeeded" ? "teamReview.reason.short" : "teamReview.failed")
      }
    },
    [refreshCounts, t],
  )

  const openLabel = tab === "sheets" ? "teamReview.list.waiting" : "teamReview.list.reported"
  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <View style={[s.bar, { paddingTop: top }]}>
        <KPress accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace(href("/upload")))} pressedScale={0.95} style={[s.back, { borderColor: theme.line, backgroundColor: theme.card }]}>
          <Text style={[s.backText, { color: theme.textHeading }]}>{t("common.back")}</Text>
        </KPress>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 16) + 48 }]}>
        <View>
          <Text style={[s.over, { color: theme.accent }]}>{t("teamReview.over")}</Text>
          <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {t("teamReview.title")}
          </Text>
        </View>
        <View style={s.chips} accessibilityRole="tablist" accessibilityLabel={t("teamReview.tabs.a11y")}>
          {REVIEW_TABS.map((id) => {
            const badge = badgeLabel(counts[id])
            const label = t(`teamReview.tab.${id}` as "teamReview.tab.sheets")
            return (
              <Chip
                key={id}
                theme={theme}
                role="radio"
                label={badge ? `${label}  ${badge}` : label}
                a11y={badge ? `${label}, ${t("teamReview.badge", { count: counts[id] })}` : label}
                on={tab === id}
                onPress={() => {
                  setTab(id)
                  setList("open")
                }}
              />
            )
          })}
        </View>
        <View style={s.chips} accessibilityRole="tablist" accessibilityLabel={t("teamReview.list.a11y")}>
          <Chip theme={theme} label={t(openLabel)} on={list === "open"} onPress={() => setList("open")} />
          <Chip theme={theme} label={t("teamReview.list.removed")} on={list === "removed"} onPress={() => setList("removed")} />
        </View>

        {state.status === "loading" && state.items.length === 0 ? <Hint theme={theme}>{t("teamReview.loading")}</Hint> : null}
        {state.status === "denied" ? <Hint theme={theme} tone="danger">{t("teamReview.denied")}</Hint> : null}
        {state.status === "error" || state.status === "offline" ? (
          <View style={s.gap}>
            <Hint theme={theme} tone="danger">{t(state.status === "offline" ? "teamReview.offline" : "teamReview.error")}</Hint>
            <ActionButton theme={theme} tone="quiet" label={t("teamReview.retry")} onPress={() => setReload((n) => n + 1)} />
          </View>
        ) : null}
        {state.status === "ready" && state.items.length === 0 ? <Hint theme={theme}>{t(list === "removed" ? "teamReview.empty.removed" : (`teamReview.empty.${tab}` as "teamReview.empty.sheets"))}</Hint> : null}
        {state.items.map((item) => (
          <ReviewCard key={item.key} item={item} onAct={act} />
        ))}
        <ActionButton theme={theme} tone="quiet" label={t("pianoReview.entry")} onPress={() => router.push(href("/piano-review"))} />
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
