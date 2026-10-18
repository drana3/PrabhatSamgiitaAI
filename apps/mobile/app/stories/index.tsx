import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { BookOpen } from "lucide-react-native"

import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { mapApiStory, type StorySummary } from "@/data/stories"
import { api } from "@/lib/client"
import { href } from "@/utils/href"

export default function StoriesScreen() {
  const router = useRouter()
  const [stories, setStories] = useState<StorySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await api.fetchStories({ limit: 50 })
      setStories(rows.map(mapApiStory))
      if (!rows.length) {
        setError("No stories available from the API yet.")
      }
    } catch {
      setStories([])
      setError("Could not load stories. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ScreenContainer
      edges={["top"]}
      padded={false}
      title="Stories"
      subtitle={loading ? "Loading…" : `${stories.length} inspirations`}
    >
      {loading && !stories.length ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : null}
      <FlatList
        data={stories}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <Pressable onPress={() => void load()} accessibilityRole="button">
              <Text style={styles.empty}>{error ?? "No stories available."} Tap to retry.</Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(href(`/stories/${item.slug}`))}
            accessibilityRole="button"
          >
            <View style={styles.icon}>
              <BookOpen size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta} numberOfLines={2}>
                {item.teaser || item.author}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.label, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  empty: { ...typography.body, color: colors.textSecondary, paddingVertical: spacing.xl },
})
