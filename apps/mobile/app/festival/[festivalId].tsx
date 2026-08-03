import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { CompactSongRow } from "@/components/songs/CompactSongRow"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { allCollections, collectionSearchPrompt } from "@/data/collections"
import { getFestivalById, getUpcomingFestivals } from "@/data/festivals"
import type { MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import { loadCatalog } from "@/lib/catalog"
import { songSummaryToMockSong } from "@/lib/songMap"
import { href } from "@/utils/href"

export default function FestivalDetailScreen() {
  const { festivalId } = useLocalSearchParams<{ festivalId: string }>()
  const router = useRouter()
  const [songs, setSongs] = useState<MockSong[]>([])
  const [loadingSongs, setLoadingSongs] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const festival = useMemo(() => {
    const upcoming = getUpcomingFestivals(new Date(), 40)
    return (
      upcoming.find((item) => item.id === festivalId) ??
      (() => {
        const base = getFestivalById(festivalId)
        if (!base) return null
        return {
          ...base,
          daysUntil: 0,
          dateLabel: new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(
            new Date(base.year, base.month - 1, base.day),
          ),
        }
      })()
    )
  }, [festivalId])

  const relatedCollection = festival?.relatedCollectionLabel
    ? allCollections.find((item) => item.label === festival.relatedCollectionLabel)
    : undefined

  useEffect(() => {
    if (!festival) return
    let active = true
    setLoadingSongs(true)
    setLoadError(null)
    const query = relatedCollection
      ? collectionSearchPrompt(relatedCollection.label)
      : `${festival.title} festival songs`
    void api
      .searchSongs(query, { mode: "catalog" })
      .then((rows) => {
        if (!active) return
        if (rows.length) {
          setSongs(rows.slice(0, 8).map((row, index) => songSummaryToMockSong(row, index)))
          return
        }
        return loadCatalog().then((catalog) => {
          if (!active) return
          if (catalog.error && !catalog.songs.length) setLoadError(catalog.error)
          setSongs(catalog.songs.slice(0, 8).map((row, index) => songSummaryToMockSong(row, index)))
        })
      })
      .catch(() => {
        if (!active) return
        setLoadError("Could not load festival songs. Check your connection and try again.")
        setSongs([])
      })
      .finally(() => {
        if (active) setLoadingSongs(false)
      })
    return () => {
      active = false
    }
  }, [festival, relatedCollection])

  if (!festival) {
    return (
      <ScreenContainer title="Festival">
        <Text style={styles.missing}>Festival not found.</Text>
        <PrimaryButton label="Back" onPress={() => router.back()} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer edges={["top"]} padded={false} title="Festival">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.date}>{festival.dateLabel}</Text>
          <Text style={styles.title}>{festival.title}</Text>
          <Text style={styles.subtitle}>{festival.subtitle}</Text>
          {festival.mood ? <Text style={styles.mood}>Mood · {festival.mood}</Text> : null}
        </View>

        {relatedCollection ? (
          <Pressable
            style={styles.collectionCard}
            onPress={() =>
              router.push(
                href(
                  `/search?q=${encodeURIComponent(collectionSearchPrompt(relatedCollection.label))}`,
                ),
              )
            }
          >
            <Text style={styles.collectionEyebrow}>Related collection</Text>
            <Text style={styles.collectionTitle}>{relatedCollection.label}</Text>
            <Text style={styles.collectionMeta}>{relatedCollection.count} songs in catalog</Text>
          </Pressable>
        ) : (
          <View style={styles.collectionCard}>
            <Text style={styles.collectionEyebrow}>Related songs</Text>
            <Text style={styles.collectionTitle}>Suggested listening for this observance</Text>
            <Text style={styles.collectionMeta}>Live catalog search for this festival.</Text>
          </View>
        )}

        <Text style={styles.section}>Listen now</Text>
        {loadingSongs ? <ActivityIndicator color={colors.primary} /> : null}
        {!loadingSongs && !songs.length ? (
          <Text style={styles.collectionMeta}>
            {loadError ?? "No songs available for this festival yet."}
          </Text>
        ) : null}
        {loadError && songs.length ? <Text style={styles.collectionMeta}>{loadError}</Text> : null}
        {songs.map((song) => (
          <CompactSongRow
            key={song.id}
            song={song}
            onPress={() => router.push(href(`/song/${song.id}`))}
          />
        ))}

        <View style={{ marginTop: spacing.xl }}>
          <PrimaryButton
            label="Browse all collections"
            onPress={() => router.push(href("/collections"))}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.section },
  hero: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  date: { ...typography.caption, color: colors.primaryDark },
  title: {
    fontFamily: "Lora_700Bold",
    fontSize: 28,
    lineHeight: 34,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  mood: { ...typography.caption, color: colors.secondary, marginTop: spacing.md },
  collectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    ...softShadow(1),
  },
  collectionEyebrow: { ...typography.caption, color: colors.textMuted },
  collectionTitle: { ...typography.label, fontSize: 16, color: colors.textPrimary, marginTop: 4 },
  collectionMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  section: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  missing: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
})
