import { Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AiCompanion } from "@/components/ai-companion"
import { BackButton, ScreenContainer, ScreenLoader, SurfaceCard } from "@/components/screen-shell"
import { SongCard } from "@/components/song-card"
import { cardElevation, hairline } from "@/lib/theme"
import { api, colors, radii, spacing, typography } from "@/lib/client"
import type { SongDetail } from "@prabhat/core"

type TabKey = "lyrics" | "meaning" | "ask"

const TABS: { key: TabKey; label: string }[] = [
  { key: "lyrics", label: "Lyrics" },
  { key: "meaning", label: "Meaning" },
  { key: "ask", label: "Ask AI" },
]

export default function SongScreen() {
  const router = useRouter()
  const { number } = useLocalSearchParams<{ number: string }>()
  const songNumber = Number(number)
  const scrollRef = useRef<ScrollView>(null)
  const [song, setSong] = useState<SongDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>("lyrics")

  useEffect(() => {
    if (!Number.isFinite(songNumber)) return
    setLoading(true)
    setTab("lyrics")
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    void api.fetchSong(songNumber).then((detail) => {
      setSong(detail)
      setLoading(false)
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }))
    })
  }, [songNumber])

  if (loading) {
    return <ScreenLoader />
  }

  if (!song) {
    return (
      <ScreenContainer>
        <Text style={styles.missing}>Song not found.</Text>
      </ScreenContainer>
    )
  }

  const lyrics = song.lyrics_original?.trim() || song.transliteration?.trim() || song.first_line || ""
  const audio = song.media.find((item) => item.kind === "audio")

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <BackButton label="← Back" onPress={() => router.back()} />
        </View>

        <View style={styles.heroWrap}>
          <LinearGradient colors={[colors.navy950, colors.navy900]} style={styles.hero}>
            <Text style={styles.heroNumber}>Song {song.number}</Text>
            <Text style={styles.heroTitle}>{song.title}</Text>
            {song.first_line ? (
              <Text style={styles.heroLine} numberOfLines={2}>
                {song.first_line}
              </Text>
            ) : null}
            {audio ? (
              <Pressable style={styles.listenChip} onPress={() => void Linking.openURL(audio.url)}>
                <Ionicons name="play" size={14} color={colors.navy950} />
                <Text style={styles.listenChipText}>Listen</Text>
              </Pressable>
            ) : null}
          </LinearGradient>
        </View>

        <View style={styles.tabs}>
          {TABS.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.tab, tab === key && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "ask" ? (
          <View style={styles.askPane}>
            <AiCompanion songNumber={song.number} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <SurfaceCard style={styles.panel}>
              {tab === "lyrics" ? (
                <>
                  <Text style={styles.lyrics}>{lyrics}</Text>
                  {song.transliteration && song.lyrics_original ? (
                    <Text style={styles.transliteration}>{song.transliteration}</Text>
                  ) : null}
                </>
              ) : null}

              {tab === "meaning" ? (
                <>
                  {song.english_meaning ? (
                    <>
                      <Text style={styles.panelLabel}>English</Text>
                      <Text style={styles.body}>{song.english_meaning}</Text>
                    </>
                  ) : null}
                  {song.hindi_meaning ? (
                    <>
                      <Text style={styles.panelLabel}>हिन्दी</Text>
                      <Text style={styles.body}>{song.hindi_meaning}</Text>
                    </>
                  ) : null}
                  {!song.english_meaning && !song.hindi_meaning ? (
                    <Text style={styles.body}>Meaning is not available for this song yet.</Text>
                  ) : null}
                </>
              ) : null}
            </SurfaceCard>

            {song.related_songs.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Related songs</Text>
                <View style={styles.list}>
                  {song.related_songs.slice(0, 3).map((related) => (
                    <SongCard key={related.number} song={related} />
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  heroWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  hero: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...cardElevation(2),
  },
  missing: { padding: spacing.lg, color: colors.stone600 },
  heroNumber: {
    color: colors.gold300,
    fontSize: typography.label,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.white,
    fontSize: typography.title,
    fontWeight: "700",
    lineHeight: 34,
  },
  heroLine: {
    color: "rgba(255,255,255,0.82)",
    fontSize: typography.body,
    lineHeight: 22,
  },
  listenChip: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.gold300,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  listenChipText: {
    color: colors.navy950,
    fontWeight: "700",
    fontSize: typography.caption,
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: hairline,
    padding: 4,
    gap: 4,
    ...cardElevation(1),
  },
  tab: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.navy950,
  },
  tabText: {
    color: colors.navy950,
    fontWeight: "700",
    fontSize: typography.caption,
  },
  tabTextActive: {
    color: colors.white,
  },
  askPane: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: hairline,
    padding: spacing.md,
    ...cardElevation(1),
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  panel: {
    gap: spacing.sm,
  },
  panelLabel: {
    color: colors.gold500,
    fontSize: typography.label,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  lyrics: {
    color: colors.navy950,
    fontSize: typography.heading,
    lineHeight: 30,
  },
  transliteration: {
    color: colors.stone600,
    lineHeight: 22,
    fontSize: typography.caption,
  },
  body: {
    color: colors.stone600,
    lineHeight: 24,
    fontSize: typography.body,
  },
  section: { gap: spacing.sm },
  sectionTitle: {
    color: colors.navy950,
    fontSize: typography.body,
    fontWeight: "700",
  },
  list: { gap: spacing.sm },
})
