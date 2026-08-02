import { Link } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { ScreenContainer, SectionHeader } from "@/components/screen-shell"
import { api, colors, radii, spacing, typography } from "@/lib/client"
import type { InspirationStory } from "@prabhat/core"

export default function StoriesScreen() {
  const [stories, setStories] = useState<InspirationStory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void api.fetchStories({ limit: 20 }).then((rows) => {
      setStories(rows)
      setLoading(false)
    })
  }, [])

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SectionHeader
              eyebrow="Stories & inspiration"
              title="Devotee experiences"
              subtitle="Read memories and interviews related to Prabhat Samgiita."
            />
          </View>

          {loading ? <ActivityIndicator color={colors.gold500} /> : null}

          <View style={styles.list}>
            {stories.map((story) => (
              <Link key={story.slug} href={`/stories/${story.slug}`} asChild>
                <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}>
                  <Text style={styles.author}>{story.author}</Text>
                  <Text style={styles.title}>{story.title}</Text>
                  <Text style={styles.teaser} numberOfLines={3}>{story.teaser}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: spacing.xl },
  header: { padding: spacing.lg },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(9, 45, 86, 0.08)",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  author: {
    color: colors.gold500,
    fontSize: typography.label,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: { color: colors.navy950, fontSize: typography.heading, fontWeight: "700" },
  teaser: { color: colors.stone600, lineHeight: 22 },
})
