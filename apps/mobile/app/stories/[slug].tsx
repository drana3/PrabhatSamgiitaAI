import { Link, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import {
  BackButton,
  ScreenLoader,
  ScreenSafe,
  ScreenScroll,
  SectionHeader,
  SurfaceCard,
} from "@/components/screen-shell"
import { cardElevation, hairline } from "@/lib/theme"
import { api, colors, radii, spacing, typography } from "@/lib/client"
import type { InspirationStoryDetail } from "@prabhat/core"

export default function StoryScreen() {
  const router = useRouter()
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
    return <ScreenLoader />
  }

  if (!story) {
    return (
      <ScreenSafe>
        <Text style={styles.missing}>Story not found.</Text>
      </ScreenSafe>
    )
  }

  return (
    <ScreenSafe edges={["top", "bottom"]}>
      <ScreenScroll contentContainerStyle={styles.content}>
        <BackButton label="← Stories" onPress={() => router.back()} />

        <SurfaceCard style={styles.heroCard}>
          <Text style={styles.author}>{story.author}</Text>
          <Text style={styles.title}>{story.title}</Text>
          <Text style={styles.teaser}>{story.teaser}</Text>
        </SurfaceCard>

        {story.body_paragraphs.map((paragraph, index) => (
          <Text key={index} style={styles.paragraph}>
            {paragraph}
          </Text>
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
      </ScreenScroll>
    </ScreenSafe>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  missing: { padding: spacing.lg, color: colors.stone600 },
  heroCard: { gap: spacing.sm },
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
    borderColor: hairline,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...cardElevation(1),
  },
  songChipText: { color: colors.navy950, fontWeight: "700" },
})
