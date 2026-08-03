import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { CalendarHeart, ChevronRight } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { getUpcomingFestivals } from "@/data/festivals"

type Props = {
  onOpenFestival: (id: string) => void
  onSeeAll: () => void
}

export function UpcomingFestivalsRow({ onOpenFestival, onSeeAll }: Props) {
  const upcoming = getUpcomingFestivals(new Date(), 4)

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Upcoming festivals</Text>
        <Pressable accessibilityRole="button" onPress={onSeeAll}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {upcoming.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.title} on ${item.dateLabel}`}
            onPress={() => onOpenFestival(item.id)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
          >
            <View style={styles.iconWrap}>
              <CalendarHeart size={18} color={colors.primary} />
            </View>
            <Text style={styles.date}>
              {item.dateLabel}
              {item.daysUntil === 0 ? " · Today" : item.daysUntil === 1 ? " · Tomorrow" : ` · in ${item.daysUntil}d`}
            </Text>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {item.subtitle}
            </Text>
            <View style={styles.cta}>
              <Text style={styles.ctaText}>Related songs</Text>
              <ChevronRight size={14} color={colors.primary} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: colors.textPrimary,
  },
  seeAll: {
    ...typography.caption,
    color: colors.primary,
  },
  row: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  card: {
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  date: {
    ...typography.caption,
    color: colors.primaryDark,
    marginBottom: 4,
  },
  cardTitle: {
    ...typography.label,
    fontSize: 15,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 6,
    minHeight: 32,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: spacing.md,
  },
  ctaText: {
    ...typography.caption,
    color: colors.primary,
  },
})
