import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { ExternalLink } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { todayHeadline, todayModeLabel, todaySummary } from "@/lib/today"
import type { TodayRecommendations } from "@prabhat/core"

type Props = {
  today: TodayRecommendations | null
  loading: boolean
  onOpenSong: (number: number) => void
}

export function TodayContextCard({ today, loading, onOpenSong }: Props) {
  const signal = today?.signals?.[0]
  const songs = today?.recommendations ?? []
  const isFestival =
    today?.context?.recommendation_mode === "strict_festival" || Boolean(today?.context?.festival)

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>{isFestival ? "Festival day" : "News of the day"}</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{todayModeLabel(today)}</Text>
          </View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {loading ? "Finding today’s context…" : todayHeadline(today)}
      </Text>
      <Text style={styles.summary} numberOfLines={2}>
        {loading ? "Checking festivals and humanitarian news." : todaySummary(today)}
      </Text>

      {signal?.source_url ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(signal.source_url)}
          style={styles.sourceRow}
        >
          <Text style={styles.source} numberOfLines={1}>
            {signal.source_name}
          </Text>
          <ExternalLink size={12} color={colors.primaryDark} />
        </Pressable>
      ) : null}

      {songs.length > 0 ? (
        <View style={styles.list}>
          {songs.slice(0, 2).map((song) => (
            <Pressable
              key={song.number}
              accessibilityRole="button"
              accessibilityLabel={`Open PS ${song.number} ${song.title}`}
              onPress={() => onOpenSong(song.number)}
              style={({ pressed }) => [styles.songRow, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.numberText}>PS {song.number}</Text>
              <Text style={styles.songTitle} numberOfLines={1}>
                {song.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : !loading ? (
        <Text style={styles.empty} numberOfLines={2}>
          {isFestival
            ? "No verified songs for this observance yet."
            : "Today’s picks are refreshing — explore the catalog meanwhile."}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    ...softShadow(1),
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: "Lora_700Bold",
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
    marginTop: 2,
  },
  summary: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  badge: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeText: {
    ...typography.caption,
    color: colors.primaryDark,
    textTransform: "capitalize",
    fontSize: 11,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  source: {
    ...typography.caption,
    color: colors.primaryDark,
    textDecorationLine: "underline",
    maxWidth: 220,
  },
  list: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
  },
  numberText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
    minWidth: 52,
  },
  songTitle: {
    ...typography.label,
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
  },
  empty: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
})
