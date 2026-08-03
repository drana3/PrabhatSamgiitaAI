import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { ChevronLeft, CalendarHeart } from "lucide-react-native"

import { IconButton } from "@/components/common/IconButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { REVIEWED_FESTIVAL_YEAR, festivalCalendarExhausted, getUpcomingFestivals } from "@/data/festivals"
import { href } from "@/utils/href"

export default function FestivalsScreen() {
  const router = useRouter()
  const upcoming = getUpcomingFestivals(new Date(), 20)
  const exhausted = festivalCalendarExhausted()

  return (
    <ScreenContainer
      edges={["top"]}
      padded={false}
      title="Festivals"
      subtitle={`Reviewed ${REVIEWED_FESTIVAL_YEAR} observances`}
    >
      <FlatList
        data={upcoming}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {exhausted
              ? `The reviewed ${REVIEWED_FESTIVAL_YEAR} calendar has no remaining dates. Next year’s observances will appear when published.`
              : "No upcoming observances right now."}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(href(`/festival/${item.id}`))}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
          >
            <View style={styles.icon}>
              <CalendarHeart size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.date}>
                {item.dateLabel}
                {item.daysUntil === 0
                  ? " · Today"
                  : item.daysUntil === 1
                    ? " · Tomorrow"
                    : ` · in ${item.daysUntil} days`}
              </Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSub}>{item.subtitle}</Text>
            </View>
          </Pressable>
        )}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.section, gap: spacing.md },
  card: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  date: { ...typography.caption, color: colors.primaryDark },
  cardTitle: { ...typography.label, fontSize: 16, color: colors.textPrimary, marginTop: 2 },
  cardSub: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    paddingVertical: spacing.xl,
    lineHeight: 22,
  },
})
