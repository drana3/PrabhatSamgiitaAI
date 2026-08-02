import { Link, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { ScreenContainer, SectionHeader } from "@/components/screen-shell"
import { api, colors, radii, spacing, typography } from "@/lib/client"
import type { InspirationStoryDetail } from "@prabhat/core"

export default function StoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const [story, setStory] = useState<InspirationStoryDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    void api.fetchStory(slug).then((detail) => {
      setStory(detail)
      setLoading(false)
    })
  }, [slug])

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.gold500} style={{ marginTop: spacing.xl }} />
      </ScreenContainer>
    )
  }

  if (!story) {
    return (
      <ScreenContainer>
        <Text style={styles.missing}>Story not found.</Text>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Link href="/stories" asChild>
            <Pressable><Text style={styles.back}>← Stories</Text></Pressable>
          </Link>

          <Text style={styles.author}>{story.author}</Text>
          <Text style={styles.title}>{story.title}</Text>
          <Text style={styles.teaser}>{story.teaser}</Text>

          {story.body_paragraphs.map((paragraph, index) => (
            <Text key={index} style={styles.paragraph}>{paragraph}</Text>
          ))}

          {story.song_numbers.length ? (
            <View style={styles.related}>
              <SectionHeader title="Related songs" />
              <View style={styles.songLinks}>
                {story.song_numbers.slice(0, 6).map((number) => (
                  <Link key={number} href={`/songs/${number}`} asChild>
                    <Pressable style={styles.songChip}>
                      <Text style={styles.songChipText}>Song {number}</Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  missing: { padding: spacing.lg, color: colors.stone600 },
  back: { color: colors.gold500, fontWeight: "700" },
  author: {
    color: colors.gold500,
    fontSize: typography.label,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: { color: colors.navy950, fontSize: 32, fontWeight: "700", lineHeight: 38 },
  teaser: { color: colors.stone600, lineHeight: 24, fontStyle: "italic" },
  paragraph: { color: colors.navy900, fontSize: typography.body, lineHeight: 26 },
  related: { gap: spacing.sm, marginTop: spacing.md },
  songLinks: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  songChip: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(9, 45, 86, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  songChipText: { color: colors.navy950, fontWeight: "700" },
})
