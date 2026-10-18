import { useEffect, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { BookOpen, ChevronRight } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { mapApiStory, type StorySummary } from "@/data/stories"
import { api } from "@/lib/client"

type Props = {
  onOpenStory: (story: StorySummary) => void
  onSeeAll: () => void
}

export function StoriesPreview({ onOpenStory, onSeeAll }: Props) {
  const [stories, setStories] = useState<StorySummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void api.fetchStories({ limit: 6 }).then((rows) => {
      if (!active) return
      setStories(rows.map(mapApiStory))
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Stories & inspiration</Text>
        <Pressable onPress={onSeeAll} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>

      {loading ? (
        <Text style={styles.meta}>Loading stories…</Text>
      ) : stories.length === 0 ? (
        <Pressable
          onPress={onSeeAll}
          style={({ pressed }) => [styles.compactRow, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel="Browse all stories"
        >
          <View style={styles.icon}>
            <BookOpen size={16} color={colors.primary} />
          </View>
          <Text style={styles.compactLabel}>Browse stories</Text>
          <ChevronRight size={18} color={colors.primary} />
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {stories.map((story) => (
            <Pressable
              key={story.slug}
              onPress={() => onOpenStory(story)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
              accessibilityRole="button"
              accessibilityLabel={story.title}
            >
              <Text style={styles.cardTitle} numberOfLines={2}>
                {story.title}
              </Text>
              <Text style={styles.author} numberOfLines={1}>
                {story.author}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onSeeAll}
            style={({ pressed }) => [styles.chip, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel="All stories"
          >
            <Text style={styles.chipText}>All</Text>
            <ChevronRight size={16} color={colors.primary} />
          </Pressable>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: colors.textPrimary, flex: 1 },
  seeAll: { ...typography.caption, color: colors.primary },
  meta: { ...typography.caption, color: colors.textSecondary },
  row: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
    alignItems: "stretch",
  },
  card: {
    width: 156,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "space-between",
    gap: spacing.xs,
    ...softShadow(1),
  },
  cardTitle: { ...typography.label, color: colors.textPrimary, lineHeight: 20 },
  author: { ...typography.caption, color: colors.textMuted },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { ...typography.caption, color: colors.primaryDark, fontFamily: "Inter_600SemiBold" },
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  compactLabel: { ...typography.label, color: colors.textPrimary, flex: 1 },
})
