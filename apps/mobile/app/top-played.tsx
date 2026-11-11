import { useCallback, useEffect, useState } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { KindChips, PeriodChips, TopFooter, TopMessage, TopRow, TopSkeleton } from "@/components/topPlayed/TopPlayedParts"
import { SpRound } from "@/components/song-v2/SpUi"
import { Toast } from "@/components/songs-v2/Toast"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { useTopPlayed } from "@/hooks/useTopPlayed"
import { formatDate, useT } from "@/lib/i18n"
import { parseTopParams } from "@/lib/kirtan/charts"
import { showSince } from "@/lib/topPlayed/model"
import { playTopItem } from "@/lib/topPlayed/play"
import { href } from "@/utils/href"

/**
 * Top Played: the tracks people played most, counted by the server (docs/radio-mixing.md). Period switch (Week, Month, All time) and category chips narrow the list; a row plays the list from that track down. States: loading, the chart,
 * nothing yet, could not load (with a retry). Reached from Today, from the Radio and from the Charts cards of the Kiirtan tab
 * (`?period=7d&scope=kiirtan`: that period, counted over the Kiirtan page's kinds, so the category chips give way to a note).
 */
export default function TopPlayedScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const sp = useSpTheme()
  const inset = useScreenTop()
  const bottomInset = useScrollBottomInset()
  const params = useLocalSearchParams<{ period?: string; scope?: string }>()
  const preset = parseTopParams(params)
  const scoped = preset.scope.length > 0
  const { state, view, setPeriod, setKind, retry, more } = useTopPlayed(undefined, { period: preset.period, scope: preset.scope })
  const [toast, setToast] = useState<string | null>(null)

  // every loaded row belonged to a blocked author: nothing to scroll, so ask for the next page ourselves
  useEffect(() => {
    if (state.status === "ready" && view.items.length === 0 && state.hasMore && !state.loadingMore && !state.moreFailed) more()
  }, [state.status, state.hasMore, state.loadingMore, state.moreFailed, view.items.length, more])

  const back = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/today")))

  const play = useCallback(
    (index: number) => {
      const message = playTopItem(view.items, index)
      if (!message) return
      setToast(message)
      setTimeout(() => setToast((current) => (current === message ? null : current)), 2200)
    },
    [view.items],
  )

  const header = (
    <View style={s.header}>
      <PeriodChips theme={theme} value={state.period} onChange={setPeriod} />
      {scoped ? (
        <Text style={[s.rule, { color: theme.textBody }]}>{t("kh.chart.scope")}</Text>
      ) : (
        <KindChips theme={theme} value={state.kind} onChange={setKind} />
      )}
      <Text style={[s.rule, { color: theme.textBody }]}>{t("top.rule")}</Text>
      {showSince(state) && state.since ? (
        <Text style={[s.since, { color: theme.textMuted }]}>{t("top.since", { date: formatDate(Date.parse(state.since), "medium") })}</Text>
      ) : null}
    </View>
  )

  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <View style={[s.bar, { paddingTop: inset, backgroundColor: theme.page }]}>
        <View style={s.titleRow}>
          <SpRound t={sp} icon="back" label={t("common.back")} onPress={back} />
          <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={2} accessibilityRole="header">
            {scoped ? t("kh.chart.title") : t("top.title")}
          </Text>
        </View>
      </View>
      <FlatList
        data={state.status === "ready" ? view.items : []}
        keyExtractor={(item) => `${item.ref}:${item.id}`}
        renderItem={({ item, index }) => <TopRow theme={theme} item={item} onPlay={() => play(index)} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          state.status === "loading" ? (
            <TopSkeleton theme={theme} />
          ) : state.status === "error" ? (
            <TopMessage theme={theme} title={t("top.error.title")} body={t("top.error.body")} action={t("top.retry")} onAction={retry} />
          ) : (
            <TopMessage theme={theme} title={t("top.empty.title")} body={t("top.empty.body", { min: state.minPlays || 5 })} />
          )
        }
        ListFooterComponent={<TopFooter theme={theme} hasMore={state.status === "ready" && state.hasMore} loading={state.loadingMore} failed={state.moreFailed} onMore={more} />}
        onEndReached={more}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        initialNumToRender={12}
        windowSize={7}
      />
      <Toast message={toast} theme={theme} />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { zIndex: 5 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 10, paddingRight: 16, minHeight: 56 },
  title: { flex: 1, fontFamily: amFonts.display, fontSize: 26, lineHeight: 29, letterSpacing: -0.5, textTransform: "uppercase" },
  header: { gap: 12, paddingTop: 6, paddingBottom: 16 },
  rule: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingHorizontal: 20 },
  since: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17, paddingHorizontal: 20 },
})
