import { Ionicons } from "@expo/vector-icons"
import { Link } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native"

import { ScreenSafe, ScreenScroll, SectionHeader, SurfaceCard } from "@/components/screen-shell"
import { api, colors, spacing, typography } from "@/lib/client"
import type { InspirationStory } from "@prabhat/core"

export default function StoriesScreen() {
  const [stories, setStories] = useState<InspirationStory[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadStories = useCallback(async () => {
    setStories(await api.fetchStories({ limit: 20 }))
  }, [])

  useEffect(() => {
    void loadStories().finally(() => setLoading(false))
  }, [loadStories])

  async function onRefresh() {
    setRefreshing(true)
    try {
      await loadStories()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <ScreenSafe>
      <ScreenScroll
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.gold500} />
        }
      >
        <View style={styles.header}>
          <SectionHeader
            eyebrow="Stories & inspiration"
            title="Devotee experiences"
            subtitle="Read memories and interviews related to Prabhat Samgiita."
          />
        </View>

        {loading ? <ActivityIndicator color={colors.gold500} style={styles.loader} /> : null}

        <View style={styles.list}>
          {stories.map((story) => (
            <Link key={story.slug} href={`/stories/${story.slug}`} asChild>
              <Pressable style={({ pressed }) => [pressed && styles.pressed]}>
                <SurfaceCard style={styles.card}>
                  <Text style={styles.author}>{story.author}</Text>
                  <Text style={styles.title}>{story.title}</Text>
                  <Text style={styles.teaser} numberOfLines={3}>
                    {story.teaser}
                  </Text>
                  <View style={styles.readRow}>
                    <Text style={styles.readLabel}>Read story</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.gold500} />
                  </View>
                </SurfaceCard>
              </Pressable>
            </Link>
          ))}
        </View>
      </ScreenScroll>
    </ScreenSafe>
  )
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  loader: { marginBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: { gap: spacing.sm },
  pressed: { opacity: 0.92 },
  author: {
    color: colors.gold500,
    fontSize: typography.label,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: { color: colors.navy950, fontSize: typography.heading, fontWeight: "700" },
  teaser: { color: colors.stone600, lineHeight: 22 },
  readRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
  readLabel: {
    color: colors.gold500,
    fontWeight: "700",
    fontSize: typography.caption,
  },
})
