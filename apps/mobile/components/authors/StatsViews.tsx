import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import Svg, { Circle, Path } from "react-native-svg"

import { DemoBadge, SIDE } from "@/components/authors/AuthorsUi"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { countryName, formatDay } from "@/lib/authors/format"
import { say } from "@/lib/authors/text"
import { areaPath, linePath, sparkPoints, statsMode } from "@/lib/authors/statsView"
import type { OwnerStats, PublicStats } from "@/lib/authors/types"
import { useLanguage, useT } from "@/lib/i18n"
import { kindLabelPlural } from "@/lib/kirtan/kind"
import type { RecordingKind } from "@/lib/kirtan/types"

/**
 * The numbers on a public page, in the variant Dada chose (board "автор-статистика-варианты"): A, falling back to D.
 * Honest by rule: with too little listening there are NO numbers, only "counting since <date>" (never a zero that looks
 * like a measurement); with enough listening but too short a history, one plain line (D) instead of a line that says
 * nothing. In the preview the block says Demo, because the figures are invented.
 */
export function PublicStatsStrip({ theme, stats, demo }: { theme: SongsTheme; stats: PublicStats | null; demo: boolean }) {
  const t = useT()
  const locale = useLanguage()
  const mode = statsMode(stats)
  if (!stats || mode === "none") return null
  const since = stats.counting_since ? formatDay(stats.counting_since, locale) : null
  if (mode === "quiet") {
    return (
      <View style={[styles.strip, { backgroundColor: theme.inner, borderColor: theme.line }]} accessibilityRole="summary">
        <Text style={[styles.quiet, { color: theme.textBody }]}>{since ? t("authors.stats.notEnough", { date: since }) : t("authors.stats.notStarted")}</Text>
        {demo ? <DemoBadge theme={theme} /> : null}
      </View>
    )
  }
  const listeners = stats.monthly_listeners ?? 0
  const plays = stats.total_plays ?? 0
  if (mode === "line") {
    return (
      <View style={styles.lineRow} accessibilityRole="summary">
        <Text style={[styles.lineText, { color: theme.textBody }]}>
          {t("authors.stats.lineListeners", { count: listeners })} · {t("authors.stats.linePlays", { count: plays })}
        </Text>
        {demo ? <DemoBadge theme={theme} /> : null}
      </View>
    )
  }
  return <StatsChart theme={theme} stats={stats} listeners={listeners} plays={plays} since={since} demo={demo} />
}

const CHART_HEIGHT = 64

/** Variant A: the big number, a weekly line under it, one quiet sentence about monthly listeners. */
function StatsChart({ theme, stats, listeners, plays, since, demo }: { theme: SongsTheme; stats: PublicStats; listeners: number; plays: number; since: string | null; demo: boolean }) {
  const t = useT()
  const locale = useLanguage()
  const [width, setWidth] = useState(0)
  const weeks = stats.weeks ?? []
  const points = sparkPoints(weeks, width, CHART_HEIGHT)
  const end = points[points.length - 1]
  const people = t("authors.stats.peopleListen", { count: listeners })
  const countText = formatCount(listeners, locale)
  const at = people.indexOf(countText)
  return (
    <View style={styles.chart} accessibilityRole="summary">
      <Text style={[styles.eyebrow, { color: theme.textMuted }]}>{t("authors.stats.listening")}</Text>
      <Text style={[styles.hero, { color: theme.textHeading }]}>{formatCount(plays, locale)}</Text>
      <Text style={[styles.heroLabel, { color: theme.textBody }]}>{since ? t("authors.stats.playsSince", { date: since }) : t("authors.stats.plays")}</Text>
      <View
        style={styles.spark}
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
        accessibilityRole="image"
        accessibilityLabel={t("authors.stats.weeksA11y", { list: weeks.map((w) => w.plays).join(", ") })}
      >
        {width > 0 && end ? (
          <Svg width={width} height={CHART_HEIGHT} accessibilityElementsHidden>
            <Path d={areaPath(points, CHART_HEIGHT)} fill={theme.accentBright} fillOpacity={0.16} />
            <Path d={linePath(points)} stroke={theme.textHeading} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" fill="none" />
            <Circle cx={end.x} cy={end.y} r={4.5} fill={theme.accentBright} stroke={theme.inner} strokeWidth={1.5} />
          </Svg>
        ) : null}
      </View>
      <View style={styles.axis}>
        <Text style={[styles.axisText, { color: theme.textMuted }]}>{t("authors.stats.weeksAgo", { count: weeks.length })}</Text>
        <Text style={[styles.axisText, { color: theme.textMuted }]}>{t("authors.stats.thisWeek")}</Text>
      </View>
      <View style={[styles.rule, { backgroundColor: theme.line }]} />
      <Text style={[styles.people, { color: theme.textBody }]}>
        {at >= 0 ? (
          <>
            {people.slice(0, at)}
            <Text style={[styles.peopleNum, { color: theme.textHeading }]}>{countText}</Text>
            {people.slice(at + countText.length)}
          </>
        ) : (
          people
        )}
      </Text>
      {demo ? <DemoBadge theme={theme} /> : null}
    </View>
  )
}

function formatCount(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
  } catch {
    return String(value)
  }
}

function Figure({ theme, value, label }: { theme: SongsTheme; value: number; label: string }) {
  const locale = useLanguage()
  let text = String(value)
  try {
    text = new Intl.NumberFormat(locale, { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value)
  } catch {
    // plain digits
  }
  return (
    <View style={styles.figure}>
      <Text style={[styles.big, { color: theme.textHeading }]}>{text}</Text>
      <Text style={[styles.label, { color: theme.textBody }]}>{label}</Text>
    </View>
  )
}

/** The owner's view: bars per day, top recordings, kinds, countries (only when there are enough listeners), and the notes. */
export function OwnerStatsView({ theme, stats, demo }: { theme: SongsTheme; stats: OwnerStats; demo: boolean }) {
  const t = useT()
  const locale = useLanguage()
  const peak = Math.max(1, ...stats.series.map((d) => d.plays))
  const none = stats.total_plays === 0
  return (
    <View style={styles.owner}>
      <View style={styles.numbers}>
        <Figure theme={theme} value={stats.monthly_listeners} label={t("authors.stats.listeners")} />
        <Figure theme={theme} value={stats.plays_in_period} label={t("authors.stats.playsIn", { days: stats.period_days })} />
        <Figure theme={theme} value={stats.total_plays} label={t("authors.stats.plays")} />
      </View>
      {none ? (
        <Text style={[styles.quiet, { color: theme.textBody }]}>
          {stats.counting_since ? t("authors.stats.ownerNone", { date: formatDay(stats.counting_since, locale) }) : t("authors.stats.notStarted")}
        </Text>
      ) : (
        <View style={styles.bars} accessibilityLabel={t("authors.stats.chartA11y", { days: stats.period_days })} accessibilityRole="image">
          {stats.series.map((d) => (
            <View key={d.day} style={styles.barSlot}>
              <View style={[styles.bar, { height: Math.max(2, Math.round((d.plays / peak) * 64)), backgroundColor: d.plays ? theme.accentBright : theme.line }]} />
            </View>
          ))}
        </View>
      )}
      {stats.top_recordings.length ? (
        <View style={styles.list}>
          <Text style={[styles.sub, { color: theme.textHeading }]}>{t("authors.stats.top")}</Text>
          {stats.top_recordings.slice(0, 5).map((r) => (
            <View key={r.recording_id} style={styles.listRow}>
              <Text style={[styles.listText, { color: theme.textBody }]} numberOfLines={1}>
                {r.title}
              </Text>
              <Text style={[styles.listValue, { color: theme.textHeading }]}>{r.plays}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {stats.by_kind.length ? (
        <View style={styles.list}>
          <Text style={[styles.sub, { color: theme.textHeading }]}>{t("authors.stats.byKind")}</Text>
          {stats.by_kind.map((k) => (
            <View key={k.kind} style={styles.listRow}>
              <Text style={[styles.listText, { color: theme.textBody }]}>{kindLabelPlural(k.kind as RecordingKind)}</Text>
              <Text style={[styles.listValue, { color: theme.textHeading }]}>{k.count}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.list}>
        <Text style={[styles.sub, { color: theme.textHeading }]}>{t("authors.stats.countries")}</Text>
        {stats.countries === null ? (
          <Text style={[styles.quiet, { color: theme.textMuted }]}>{t("authors.stats.countriesHidden")}</Text>
        ) : (
          stats.countries.map((c) => (
            <View key={c.country} style={styles.listRow}>
              <Text style={[styles.listText, { color: theme.textBody }]}>{countryName(c.country, locale)}</Text>
              <Text style={[styles.listValue, { color: theme.textHeading }]}>{c.listeners}</Text>
            </View>
          ))
        )}
      </View>
      <View style={styles.list}>
        {stats.notes
          .filter((n) => n !== "demo" && n !== "countries_hidden")
          .map((n) => (
            <Text key={n} style={[styles.note, { color: theme.textMuted }]}>
              {say(t, `authors.note.${n}`)}
            </Text>
          ))}
      </View>
      {demo ? <DemoBadge theme={theme} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  strip: { marginHorizontal: SIDE, borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  quiet: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  numbers: { flexDirection: "row", gap: 24, flexWrap: "wrap" },
  figure: { gap: 2 },
  big: { fontFamily: amFonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.8 },
  label: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  lineRow: { marginHorizontal: SIDE, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  lineText: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  chart: { marginHorizontal: SIDE, gap: 4 },
  eyebrow: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase" },
  hero: { fontFamily: amFonts.display, fontSize: 64, lineHeight: 68, letterSpacing: -2 },
  heroLabel: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22 },
  spark: { height: CHART_HEIGHT, marginTop: 16 },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  axisText: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16 },
  rule: { height: StyleSheet.hairlineWidth, marginTop: 12 },
  people: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 22, marginTop: 8 },
  peopleNum: { fontFamily: amFonts.bold },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  since: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16 },
  owner: { gap: 18 },
  bars: { flexDirection: "row", alignItems: "flex-end", height: 68, gap: 2 },
  barSlot: { flex: 1, justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 2 },
  list: { gap: 6 },
  sub: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20 },
  listRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  listText: { flex: 1, fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20 },
  listValue: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
  note: { fontFamily: amFonts.regular, fontSize: 12.5, lineHeight: 18 },
})
