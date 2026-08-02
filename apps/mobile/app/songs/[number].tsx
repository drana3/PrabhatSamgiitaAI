import { Link, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { ScreenContainer, SectionHeader } from "@/components/screen-shell"
import { SongCard } from "@/components/song-card"
import { api, colors, radii, spacing, typography } from "@/lib/client"
import type { SongDetail } from "@prabhat/core"

type TabKey = "lyrics" | "meaning" | "ask"

export default function SongScreen() {
  const { number } = useLocalSearchParams<{ number: string }>()
  const songNumber = Number(number)
  const [song, setSong] = useState<SongDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>("lyrics")

  useEffect(() => {
    if (!Number.isFinite(songNumber)) return
    void api.fetchSong(songNumber).then((detail) => {
      setSong(detail)
      setLoading(false)
    })
  }, [songNumber])

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.gold500} style={{ marginTop: spacing.xl }} />
      </ScreenContainer>
    )
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
        <ScrollView contentContainerStyle={styles.content}>
          <Link href="/explore" asChild>
            <Pressable><Text style={styles.back}>← Explore</Text></Pressable>
          </Link>

          <Text style={styles.eyebrow}>Song {song.number}</Text>
          <Text style={styles.title}>{song.title}</Text>
          {song.first_line ? <Text style={styles.firstLine}>{song.first_line}</Text> : null}

          <View style={styles.tabs}>
            {(["lyrics", "meaning", "ask"] as TabKey[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                style={[styles.tab, tab === key && styles.tabActive]}
              >
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                  {key === "lyrics" ? "Lyrics" : key === "meaning" ? "Meaning" : "Ask AI"}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === "lyrics" ? (
            <View style={styles.panel}>
              <Text style={styles.lyrics}>{lyrics}</Text>
              {song.transliteration && song.lyrics_original ? (
                <Text style={styles.transliteration}>{song.transliteration}</Text>
              ) : null}
            </View>
          ) : null}

          {tab === "meaning" ? (
            <View style={styles.panel}>
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
            </View>
          ) : null}

          {tab === "ask" ? (
            <View style={styles.panel}>
              <SectionHeader
                title="AI Companion"
                subtitle="Grounded answers about this song. Full streaming chat ships in the next mobile update — open the web app for now."
              />
              <Pressable
                style={styles.button}
                onPress={() => void Linking.openURL(`https://prabhatai-web.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io/songs/${song.number}#ask`)}
              >
                <Text style={styles.buttonText}>Open chat on web</Text>
              </Pressable>
            </View>
          ) : null}

          {song.related_songs.length ? (
            <View style={styles.section}>
              <SectionHeader title="Related songs" />
              <View style={styles.list}>
                {song.related_songs.slice(0, 4).map((related) => (
                  <SongCard key={related.number} song={related} />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {audio ? (
            <Pressable style={styles.footerButton} onPress={() => void Linking.openURL(audio.url)}>
              <Text style={styles.footerButtonText}>♪ Listen</Text>
            </Pressable>
          ) : null}
          <Link href={`/explore?q=harmonium notation for song ${song.number}`} asChild>
            <Pressable style={styles.footerButton}>
              <Text style={styles.footerButtonText}>♬ Notation</Text>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  missing: { padding: spacing.lg, color: colors.stone600 },
  back: { color: colors.gold500, fontWeight: "700" },
  eyebrow: {
    color: colors.gold500,
    fontSize: typography.label,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: { color: colors.navy950, fontSize: 32, fontWeight: "700", lineHeight: 38 },
  firstLine: { color: colors.stone600, fontSize: typography.body, lineHeight: 24 },
  tabs: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  tab: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(9, 45, 86, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  tabActive: { backgroundColor: colors.navy950, borderColor: colors.navy950 },
  tabText: { color: colors.navy950, fontWeight: "700", fontSize: typography.caption },
  tabTextActive: { color: colors.white },
  panel: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(9, 45, 86, 0.08)",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  panelLabel: {
    color: colors.gold500,
    fontSize: typography.label,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  lyrics: { color: colors.navy950, fontSize: 20, lineHeight: 32 },
  transliteration: { color: colors.stone600, lineHeight: 24 },
  body: { color: colors.stone600, lineHeight: 24 },
  section: { gap: spacing.sm },
  list: { gap: spacing.sm },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.navy950,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: colors.white, fontWeight: "700" },
  footer: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
    backgroundColor: colors.navy950,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  footerButtonText: { color: colors.white, fontWeight: "700" },
})
