import { LinearGradient } from "expo-linear-gradient"
import { Link, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native"

import {
  PrimaryButton,
  ScreenSafe,
  ScreenScroll,
  SecondaryButton,
  SectionHeader,
  SurfaceCard,
} from "@/components/screen-shell"
import { SearchField } from "@/components/search-field"
import { SongCard } from "@/components/song-card"
import { api, colors, spacing, typography } from "@/lib/client"
import type { InspirationStory, ReflectionQuote, SongSummary } from "@prabhat/core"

export default function HomeScreen() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [todaySongs, setTodaySongs] = useState<SongSummary[]>([])
  const [reflection, setReflection] = useState<ReflectionQuote | null>(null)
  const [featuredStory, setFeaturedStory] = useState<InspirationStory | null>(null)

  const loadHome = useCallback(async () => {
    const [today, quote, story] = await Promise.all([
      api.fetchTodayRecommendations(),
      api.fetchTodayReflection(),
      api.fetchFeaturedStory(),
    ])
    setTodaySongs(today?.songs.slice(0, 3) ?? [])
    setReflection(quote)
    setFeaturedStory(story)
  }, [])

  useEffect(() => {
    void loadHome().finally(() => setLoading(false))
  }, [loadHome])

  async function onRefresh() {
    setRefreshing(true)
    try {
      await loadHome()
    } finally {
      setRefreshing(false)
    }
  }

  function goExplore(value = query) {
    const trimmed = value.trim()
    if (trimmed) {
      router.push(`/explore?q=${encodeURIComponent(trimmed)}`)
      return
    }
    router.push("/explore")
  }

  return (
    <ScreenSafe>
      <ScreenScroll
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.gold500} />
        }
      >
        <LinearGradient colors={[colors.ivory50, "#f2ede3", colors.ivory100]} style={styles.hero}>
          <Text style={styles.eyebrow}>Prabhat Samgiita AI</Text>
          <Text style={styles.heroTitle}>Music for{"\n"}the inner dawn</Text>
          <Text style={styles.heroCopy}>
            Discover songs, read meanings, and ask the AI companion in English or Hindi.
          </Text>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Song number, line, or meaning"
            onSubmit={() => goExplore()}
          />
          <PrimaryButton label="Explore songs" onPress={() => goExplore()} />
        </LinearGradient>

        {loading ? (
          <ActivityIndicator color={colors.gold500} style={{ marginTop: spacing.lg }} />
        ) : (
          <>
            {reflection ? (
              <SurfaceCard style={styles.card}>
                <SectionHeader eyebrow="Today's reflection" title="A moment to pause" />
                <Text style={styles.quote}>{reflection.quote}</Text>
              </SurfaceCard>
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
              <SurfaceCard style={styles.card}>
                <SectionHeader eyebrow="Stories" title="Inspiration" subtitle={featuredStory.teaser} />
                <Link href={`/stories/${featuredStory.slug}`} asChild>
                  <PrimaryButton label={featuredStory.title} style={styles.storyLink} />
                </Link>
              </SurfaceCard>
            ) : null}

            <Link href="/songs/1" asChild>
              <SecondaryButton label="Start with Song 1" style={styles.outlineButton} />
            </Link>
          </>
        )}
      </ScreenScroll>
    </ScreenSafe>
  )
}

const styles = StyleSheet.create({
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
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  quote: { color: colors.navy900, fontSize: typography.body, lineHeight: 24, fontStyle: "italic" },
  storyLink: { alignSelf: "stretch" },
  outlineButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
})
