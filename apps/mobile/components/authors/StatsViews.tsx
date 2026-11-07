import { StyleSheet, Text, View } from "react-native"

import { DemoBadge, SIDE } from "@/components/authors/AuthorsUi"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { countryName, formatDay } from "@/lib/authors/format"
import { say } from "@/lib/authors/text"
import type { OwnerStats, PublicStats } from "@/lib/authors/types"
import { useLanguage, useT } from "@/lib/i18n"
import { kindLabelPlural } from "@/lib/kirtan/kind"
import type { RecordingKind } from "@/lib/kirtan/types"

/**
 * The numbers on a public page. Honest by rule: with too little listening there are NO numbers, only "counting since
 * <date>" (never a zero that looks like a measurement). In the preview the strip says Demo, because the figures are invented.
 */
export function PublicStatsStrip({ theme, stats, demo }: { theme: SongsTheme; stats: PublicStats | null; demo: boolean }) {
  const t = useT()
  const locale = useLanguage()
  if (!stats) return null
  const since = stats.counting_since ? formatDay(stats.counting_since, locale) : null
  if (!stats.enough_data || stats.monthly_listeners == null || stats.total_plays == null) {
    return (
      <View style={[styles.strip, { backgroundColor: theme.inner, borderColor: theme.line }]} accessibilityRole="summary">
        <Text style={[styles.quiet, { color: theme.textBody }]}>{since ? t("authors.stats.notEnough", { date: since }) : t("authors.stats.notStarted")}</Text>
        {demo ? <DemoBadge theme={theme} /> : null}
      </View>
    )
  }
  return (
    <View style={[styles.strip, { backgroundColor: theme.inner, borderColor: theme.line }]} accessibilityRole="summary">
      <View style={styles.numbers}>
        <Figure theme={theme} value={stats.monthly_listeners} label={t("authors.stats.listeners")} />
        <Figure theme={theme} value={stats.total_plays} label={t("authors.stats.plays")} />
      </View>
      <View style={styles.foot}>
        <Text style={[styles.since, { color: theme.textMuted }]}>{since ? t("authors.stats.since", { date: since }) : ""}</Text>
        {demo ? <DemoBadge theme={theme} /> : null}
      </View>
    </View>
  )
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
