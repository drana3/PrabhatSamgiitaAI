import { useEffect, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { Award } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"
import type { QuizWinnersGroup } from "@/lib/quizEvent"

export function QuizWinnersRow() {
  const [groups, setGroups] = useState<QuizWinnersGroup[]>([])

  useEffect(() => {
    void api.fetchQuizWinners().then((value) => {
      if (Array.isArray(value)) setGroups(value as QuizWinnersGroup[])
    })
  }, [])

  if (!groups.length) return null

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Award size={18} color={colors.primary} />
        <Text style={styles.title}>Recent Prabhat Samgiita Quiz winners</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {groups.map((group) => (
          <View key={group.event.id} style={styles.card}>
            <Text style={styles.eventTitle}>{group.event.title}</Text>
            {group.winners.map((winner) => (
              <View key={`${group.event.id}-${winner.rank}`} style={styles.winnerRow}>
                <Text style={styles.winnerName}>
                  #{winner.rank} {winner.display_name}
                </Text>
                <Text style={styles.winnerScore}>
                  {winner.score}/{winner.total}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  row: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  card: {
    width: 260,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    ...softShadow(1),
  },
  eventTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  winnerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  winnerName: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  winnerScore: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
  },
})
