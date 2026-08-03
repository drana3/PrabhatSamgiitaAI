import { useEffect, useState } from "react"
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ExternalLink } from "lucide-react-native"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import type { StorySummary } from "@/data/stories"
import { api } from "@/lib/client"
import { href } from "@/utils/href"

type StoryView = StorySummary & { body?: string[] }

export default function StoryDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const [story, setStory] = useState<StoryView | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    let active = true
    setLoading(true)
    void api.fetchStory(slug).then((detail) => {
      if (!active) return
      if (detail) {
        setStory({
          slug: detail.slug,
          title: detail.title,
          author: detail.author,
          url: detail.source_url || "",
          teaser: detail.teaser,
          themes: detail.themes,
          songNumbers: detail.song_numbers,
          body: detail.body_paragraphs,
        })
      } else {
        setStory(null)
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [slug])

  if (loading && !story) {
    return (
      <ScreenContainer title="Story">
        <ActivityIndicator color={colors.primary} />
      </ScreenContainer>
    )
  }

  if (!story) {
    return (
      <ScreenContainer title="Story">
        <Text style={styles.missing}>Story not found.</Text>
        <PrimaryButton label="Back to stories" onPress={() => router.replace(href("/stories"))} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer edges={["top"]} padded={false} title="Story">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.themes}>{story.themes.join(" · ")}</Text>
        <Text style={styles.title}>{story.title}</Text>
        <Text style={styles.author}>{story.author}</Text>
        <Text style={styles.body}>{story.teaser}</Text>
        {(story.body ?? []).map((paragraph) => (
          <Text key={paragraph.slice(0, 24)} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}

        {story.url ? (
          <Pressable
            style={styles.source}
            onPress={() => Linking.openURL(story.url)}
            accessibilityRole="link"
          >
            <ExternalLink size={16} color={colors.primary} />
            <Text style={styles.sourceText}>Source on prabhatasamgiita.net</Text>
          </Pressable>
        ) : null}

        {story.songNumbers?.length ? (
          <>
            <Text style={styles.section}>Related songs</Text>
            {story.songNumbers.slice(0, 4).map((number) => (
              <Pressable
                key={number}
                style={styles.songRow}
                onPress={() => router.push(href(`/song/ps-${number}`))}
              >
                <Text style={styles.songText}>PS {number}</Text>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.section, gap: spacing.sm },
  themes: { ...typography.caption, color: colors.primaryDark, textTransform: "uppercase" },
  title: { fontFamily: "Lora_700Bold", fontSize: 28, color: colors.textPrimary, marginTop: spacing.sm },
  author: { ...typography.caption, color: colors.textMuted },
  body: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  paragraph: { ...typography.bodySmall, color: colors.textPrimary, marginTop: spacing.md, lineHeight: 22 },
  source: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  sourceText: { ...typography.label, color: colors.primary },
  section: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.xl },
  songRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  songText: { ...typography.label, color: colors.textPrimary },
  missing: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
})
