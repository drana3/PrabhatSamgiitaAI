import { ScrollView, StyleSheet, Text, View } from "react-native"

import { KindMark } from "@/components/listening/KindMark"
import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { historySubline } from "@/lib/listening/labels"
import { RADIO_CATEGORIES } from "@/lib/radio/categories"
import { categoryName } from "@/lib/radio/labels"
import { formatCount, type TopKind } from "@/lib/topPlayed/model"
import { TOP_PERIODS, type TopItem, type TopPeriod } from "@/lib/topPlayed/types"

const SIDE = 16

/** A round chip: on = filled with the accent line. Feedback on touch-down (Press springs from the screen value). */
function Chip({ theme, label, on, onPress, a11y }: { theme: SongsTheme; label: string; on: boolean; onPress: () => void; a11y: string }) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      pressedScale={0.95}
      style={[s.chip, { borderColor: on ? theme.accent : theme.line, backgroundColor: on ? theme.peach : theme.card }]}
    >
      <Text style={[s.chipText, { color: on ? theme.accent : theme.textHeading }]} numberOfLines={1}>
        {label}
      </Text>
    </Press>
  )
}

/** All time / 30 days / 7 days. */
export function PeriodChips({ theme, value, onChange }: { theme: SongsTheme; value: TopPeriod; onChange: (p: TopPeriod) => void }) {
  const t = useT()
  return (
    <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel={t("top.period.a11y")}>
      {TOP_PERIODS.map((p) => (
        <Chip key={p} theme={theme} label={t(`top.period.${p}`)} a11y={t(`top.period.${p}`)} on={p === value} onPress={() => onChange(p)} />
      ))}
    </View>
  )
}

/** All + the six categories, in a row that scrolls sideways. */
export function KindChips({ theme, value, onChange }: { theme: SongsTheme; value: TopKind; onChange: (k: TopKind) => void }) {
  const t = useT()
  const kinds: TopKind[] = ["all", ...RADIO_CATEGORIES]
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={t("top.kind.a11y")}
      contentContainerStyle={s.kindRow}
    >
      {kinds.map((k) => {
        const label = k === "all" ? t("top.kind.all") : categoryName(k)
        return <Chip key={k} theme={theme} label={label} a11y={label} on={k === value} onPress={() => onChange(k)} />
      })}
    </ScrollView>
  )
}

/** One row of the chart: rank, kind mark, title, kind and performer, counted plays. Tap plays the list from here. */
export function TopRow({ theme, item, onPlay }: { theme: SongsTheme; item: TopItem; onPlay: () => void }) {
  const t = useT()
  const plays = t("top.plays", { count: item.plays })
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={t("top.row.a11y", { rank: item.rank, title: item.title, plays })}
      onPress={onPlay}
      pressedScale={0.985}
      outerStyle={s.rowOuter}
      style={[s.topRow, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <Text style={[s.rank, { color: item.rank <= 3 ? theme.accent : theme.textMuted }]} accessibilityElementsHidden>
        {item.rank}
      </Text>
      <KindMark theme={theme} kind={item.kind} size={40} />
      <View style={s.text}>
        <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[s.sub, { color: theme.textBody }]} numberOfLines={1}>
          {historySubline(item)}
        </Text>
      </View>
      <Text style={[s.plays, { color: theme.textBody }]} numberOfLines={2}>
        {formatCount(item.plays)}
      </Text>
    </Press>
  )
}

/** Grey blocks where rows will be; static (no pulsing), so Reduce Motion has nothing to turn off. */
export function TopSkeleton({ theme }: { theme: SongsTheme }) {
  const t = useT()
  return (
    <View accessibilityLabel={t("top.loading")} accessibilityLiveRegion="polite">
      {Array.from({ length: 7 }, (_, i) => (
        <View key={i} style={[s.topRow, s.skeleton, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <View style={[s.skBlock, { width: 20, height: 20, backgroundColor: theme.line }]} />
          <View style={[s.skBlock, { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.line }]} />
          <View style={s.text}>
            <View style={[s.skBlock, { width: "70%", height: 14, backgroundColor: theme.line }]} />
            <View style={[s.skBlock, { width: "45%", height: 11, backgroundColor: theme.line }]} />
          </View>
        </View>
      ))}
    </View>
  )
}

/** Nothing to list (no track has enough counted plays for this period and category), or the list could not load. */
export function TopMessage({
  theme,
  title,
  body,
  action,
  onAction,
}: {
  theme: SongsTheme
  title: string
  body: string
  action?: string
  onAction?: () => void
}) {
  return (
    <View style={s.message} accessibilityLiveRegion="polite">
      <Text style={[s.messageTitle, { color: theme.textHeading }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[s.messageBody, { color: theme.textBody }]}>{body}</Text>
      {action && onAction ? (
        <Press accessibilityRole="button" accessibilityLabel={action} onPress={onAction} pressedScale={0.96} style={[s.action, { backgroundColor: theme.brand }]}>
          <Text style={[s.actionText, { color: theme.onBrand }]}>{action}</Text>
        </Press>
      ) : null}
    </View>
  )
}

/** The end of the list: a button for the next page, or the reason it failed. */
export function TopFooter({
  theme,
  hasMore,
  loading,
  failed,
  onMore,
}: {
  theme: SongsTheme
  hasMore: boolean
  loading: boolean
  failed: boolean
  onMore: () => void
}) {
  const t = useT()
  if (!hasMore) return null
  const label = failed ? t("top.more.failed") : loading ? t("top.loading") : t("top.more")
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onMore}
      pressedScale={0.97}
      outerStyle={s.footerOuter}
      style={[s.footer, { borderColor: theme.line, backgroundColor: theme.card }]}
    >
      <Text style={[s.footerText, { color: failed ? theme.accent : theme.textHeading }]}>{label}</Text>
    </Press>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, paddingHorizontal: SIDE },
  kindRow: { flexDirection: "row", gap: 8, paddingHorizontal: SIDE },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  rowOuter: { marginHorizontal: SIDE, marginBottom: 10 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 22, borderWidth: 1, paddingVertical: 12, paddingLeft: 14, paddingRight: 14, minHeight: 68 },
  rank: { width: 30, textAlign: "center", fontFamily: amFonts.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
  text: { flex: 1, gap: 3 },
  title: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  sub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  plays: { minWidth: 44, textAlign: "right", fontFamily: amFonts.bold, fontSize: 15, lineHeight: 19 },
  skeleton: { marginHorizontal: SIDE, marginBottom: 10 },
  skBlock: { borderRadius: 7 },
  message: { paddingHorizontal: SIDE + 4, paddingTop: 36, gap: 8, alignItems: "flex-start" },
  messageTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.4 },
  messageBody: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23 },
  action: { marginTop: 12, minHeight: 48, paddingHorizontal: 24, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  footerOuter: { marginHorizontal: SIDE, marginBottom: 10 },
  footer: { minHeight: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  footerText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 19 },
})
