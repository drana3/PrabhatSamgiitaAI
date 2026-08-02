import { LinearGradient } from "expo-linear-gradient"
import { Link } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { ScreenContainer, SectionHeader } from "@/components/screen-shell"
import { SearchField } from "@/components/search-field"
import { SongCard } from "@/components/song-card"
import { api, colors, radii, spacing, typography } from "@/lib/client"
import type { InspirationStory, ReflectionQuote, SongSummary } from "@prabhat/core"

export default function HomeScreen() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [todaySongs, setTodaySongs] = useState<SongSummary[]>([])
  const [reflection, setReflection] = useState<ReflectionQuote | null>(null)
  const [featuredStory, setFeaturedStory] = useState<InspirationStory | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([
      api.fetchTodayRecommendations(),
      api.fetchTodayReflection(),
      api.fetchFeaturedStory(),
    ]).then(([today, quote, story]) => {
      if (!active) return
      setTodaySongs(today?.songs.slice(0, 3) ?? [])
      setReflection(quote)
      setFeaturedStory(story)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <LinearGradient colors={[colors.ivory50, "#f2ede3", colors.ivory100]} style={styles.hero}>
            <Text style={styles.eyebrow}>Prabhat Samgiita AI</Text>
            <Text style={styles.heroTitle}>Music for{"\n"}the inner dawn</Text>
            <Text style={styles.heroCopy}>
              Discover 5,018 songs. Listen, understand, practise harmonium, and ask in your own language.
            </Text>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Song number, line, or meaning"
              onSubmit={() => {
                if (!query.trim()) return
              }}
            />
            <Link
              href={query.trim() ? `/explore?q=${encodeURIComponent(query.trim())}` : "/explore"}
              asChild
            >
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Explore songs</Text>
              </Pressable>
            </Link>
          </LinearGradient>

          {loading ? (
            <ActivityIndicator color={colors.gold500} style={{ marginTop: spacing.lg }} />
          ) : (
            <>
              {reflection ? (
                <View style={styles.card}>
                  <SectionHeader eyebrow="Today's reflection" title="A moment to pause" />
                  <Text style={styles.quote}>{reflection.quote}</Text>
                </View>
              ) : null}

              {todaySongs.length ? (
                <View style={styles.section}>
                  <SectionHeader eyebrow="For today" title="Recommended songs" />
                  <View style={styles.list}>
                    {todaySongs.map((song) => (
                      <SongCard key={song.number} song={song} />
                    ))}
                  </View>
                </View>
              ) : null}

              {featuredStory ? (
                <View style={styles.card}>
                  <SectionHeader eyebrow="Stories" title="Inspiration" subtitle={featuredStory.teaser} />
                  <Link href={`/stories/${featuredStory.slug}`} asChild>
                    <Pressable>
                      <Text style={styles.link}>{featuredStory.title}</Text>
                    </Pressable>
                  </Link>
                </View>
              ) : null}

              <Link href="/songs/1" asChild>
                <Pressable style={styles.outlineButton}>
                  <Text style={styles.outlineButtonText}>Start with Song 1</Text>
                </Pressable>
              </Link>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: spacing.xl },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.gold500,
    fontSize: typography.label,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.navy950,
    fontSize: typography.hero,
    lineHeight: 40,
    fontWeight: "700",
  },
  heroCopy: {
    color: colors.stone600,
    fontSize: typography.body,
    lineHeight: 24,
  },
  primaryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.navy950,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  primaryButtonText: { color: colors.white, fontWeight: "700" },
  outlineButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(9, 45, 86, 0.15)",
    paddingVertical: 14,
    alignItems: "center",
  },
  outlineButtonText: { color: colors.navy950, fontWeight: "700" },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(9, 45, 86, 0.08)",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  quote: { color: colors.navy900, fontSize: typography.body, lineHeight: 24, fontStyle: "italic" },
  link: { color: colors.gold500, fontWeight: "700", fontSize: typography.body },
})
