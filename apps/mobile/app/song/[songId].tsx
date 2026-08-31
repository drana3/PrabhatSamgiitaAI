import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native"
import { ScenicBackgroundImage } from "@/components/common/ScenicBackgroundImage"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ChevronLeft, Heart, Pause, Play, Share2, Sparkles } from "lucide-react-native"
import Animated, { FadeInDown } from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"

import { IconButton } from "@/components/common/IconButton"
import { SongListenControls } from "@/components/player/SongListenControls"
import { WatchVideoCard } from "@/components/player/WatchVideoCard"
import { LyricsMeaningView } from "@/components/songs/LyricsMeaningView"
import { NotationPractice } from "@/components/songs/NotationPractice"
import { SongJourneyTicker } from "@/components/songs/SongJourneyTicker"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { visibleSongJourneyTabs, songWatchLayout, type SongJourneyTab } from "@/constants/songJourney"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import type { MockSong } from "@/data/mock"
import { isSameSong, songPlayback } from "@/lib/playback"
import { hasDownloadedAudio } from "@/lib/offlineAudio"
import { instantSongBundle, resolveSongBundle, songRouteId } from "@/lib/songs"
import { fetchSongMeaningLocalization } from "@/lib/songLocalization"
import { resolveSongMeaning } from "@/lib/songMeanings"
import { parseSongNumber, mergeSongMedia, storedMeaningForLanguage } from "@/lib/songMap"
import { localeLabel } from "@/constants/languages"
import { hasPublishedLearnerSargam } from "@prabhat/core"
import { practiceLyricSource } from "@/lib/sargamDisplay"
import { prefetchScenicForSong } from "@/lib/scenicPrefetch"
import { forgetSongLocalization, peekSongLocalization } from "@/lib/songCache"
import { songShareMessage } from "@/lib/webLinks"
import { usePlayerStore, peekMediaCachedSong } from "@/stores/playerStore"
import { useAuthStore } from "@/stores/authStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

export default function SongDetailScreen() {
  const { songId, tab: tabParam } = useLocalSearchParams<{ songId: string | string[]; tab?: string }>()
  const router = useRouter()
  const { width: windowWidth } = useWindowDimensions()
  const routeId = songRouteId(songId)
  const [song, setSong] = useState<MockSong | null>(
    () => instantSongBundle(songRouteId(songId))?.song ?? null,
  )
  const [related, setRelated] = useState<MockSong[]>(
    () => instantSongBundle(songRouteId(songId))?.related ?? [],
  )
  const [loadError, setLoadError] = useState<string | null>(() =>
    instantSongBundle(songRouteId(songId)) ? null : "Song not found.",
  )
  const loadSong = usePlayerStore((s) => s.loadSong)
  const syncCurrentSong = usePlayerStore((s) => s.syncCurrentSong)
  const playOrToggle = usePlayerStore((s) => s.playOrToggle)
  const pause = usePlayerStore((s) => s.pause)
  const setQueue = usePlayerStore((s) => s.setQueue)
  const showPause = usePlayerStore((s) =>
    song ? songPlayback(s, song).showPause : false,
  )
  const isCurrent = usePlayerStore((s) =>
    song ? songPlayback(s, song).isCurrent : false,
  )
  const playerSong = usePlayerStore((s) =>
    song && s.currentSong?.number === song.number ? s.currentSong : null,
  )
  const mediaCacheRevision = usePlayerStore((s) => s.mediaCacheRevision)
  const authMode = useAuthStore((s) => s.mode)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const toggleSaved = usePreferencesStore((s) => s.toggleSaved)
  const [language, setLanguage] = useState("en")
  const [localizedMeaning, setLocalizedMeaning] = useState<string | null>(null)
  const [localizedTitle, setLocalizedTitle] = useState<string | null>(null)
  const [localizing, setLocalizing] = useState(false)
  const [meaningRetryTick, setMeaningRetryTick] = useState(0)
  const [retryingMeaning, setRetryingMeaning] = useState(false)
  const [journey, setJourney] = useState<SongJourneyTab>("listen")
  const [watchPlaying, setWatchPlaying] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const journeyFocusY = useRef(0)
  const autoPlayedFor = useRef<string | null>(null)
  const lastPlayToggleAt = useRef(0)
  const lastAiOpenAt = useRef(0)
  const meaningCache = useRef<Record<string, { meaning: string | null; title: string | null }>>({})

  const selectLanguage = useCallback(
    (code: string) => {
      setLanguage(code)
      if (!song) {
        setLocalizing(false)
        return
      }
      if (code === "en") {
        setLocalizedMeaning(null)
        setLocalizedTitle(null)
        setLocalizing(false)
        return
      }
      const stored = storedMeaningForLanguage(song, code)
      if (stored) {
        setLocalizedMeaning(stored)
        setLocalizedTitle(null)
        setLocalizing(false)
        return
      }
      const remembered = meaningCache.current[code]
      if (remembered) {
        setLocalizedMeaning(remembered.meaning)
        setLocalizedTitle(remembered.title)
        setLocalizing(false)
        return
      }
      const peeked = peekSongLocalization(song.number, localeLabel(code))
      const peekedText = peeked?.localized_meaning?.trim() || ""
      if (peekedText) {
        setLocalizedMeaning(peekedText)
        setLocalizedTitle(peeked.localized_title ?? null)
        setLocalizing(false)
        return
      }
      setLocalizing(true)
    },
    [song],
  )

  const retryMeaningTranslation = useCallback(() => {
    if (!song || language === "en") return
    delete meaningCache.current[language]
    forgetSongLocalization(song.number, localeLabel(language))
    setRetryingMeaning(true)
    setMeaningRetryTick((tick) => tick + 1)
  }, [language, song])

  useEffect(() => {
    let active = true
    setWatchPlaying(false)
    autoPlayedFor.current = null
    meaningCache.current = {}
    setLanguage("en")
    setLocalizedMeaning(null)
    setLocalizedTitle(null)
    setLocalizing(false)

    const instant = instantSongBundle(routeId)
    const number = parseSongNumber(routeId)
    if (!instant) {
      setSong(null)
      setRelated([])
      setLoadError("Song not found.")
      return () => {
        active = false
      }
    }

    setSong(instant.song)
    setRelated(instant.related)
    setLoadError(null)
    usePlayerStore.getState().warmAudio(instant.song)
    if (number) prefetchScenicForSong(number)
    void resolveSongBundle(routeId).then((bundle) => {
      if (!active || !bundle) return
      const cached = peekMediaCachedSong(bundle.song.number)
      setSong(mergeSongMedia(bundle.song, cached ?? undefined))
      setRelated(bundle.related)
      usePlayerStore.getState().warmAudio(bundle.song)
    })
    return () => {
      active = false
    }
  }, [routeId])

  useEffect(() => {
    if (!song) return
    const cached = peekMediaCachedSong(song.number)
    const merged = mergeSongMedia(song, playerSong ?? cached ?? undefined)
    if (merged !== song) setSong(merged)
  }, [song, playerSong, mediaCacheRevision])

  const hasVideo = Boolean(song?.videos.some((video) => video.embedUrl))
  const hasFullSargam = Boolean(
    song &&
      hasPublishedLearnerSargam(song.number, song.notationVerificationStatus, song.notationEnabled),
  )
  const requestedTab =
    tabParam === "watch" ||
    tabParam === "understand" ||
    tabParam === "listen" ||
    tabParam === "notation"
      ? tabParam
      : null
  const notationDeepLink = requestedTab === "notation"
  const journeyTabs = useMemo(
    () =>
      visibleSongJourneyTabs({
        hasVideo,
        hasFullSargam: hasFullSargam || notationDeepLink,
      }),
    [hasVideo, notationDeepLink, hasFullSargam],
  )
  const watchLayout = songWatchLayout(journey, { hasVideo, watchPlaying })

  useEffect(() => {
    if (requestedTab) setJourney(requestedTab)
  }, [requestedTab, songId])

  useEffect(() => {
    if (tabParam !== "deeper" || !song) return
    router.replace(href(`/(tabs)/ai?song=${song.number}`))
  }, [tabParam, song, router])

  useEffect(() => {
    if (!journeyTabs.some((tab) => tab.id === journey)) {
      // Prefer requested tab once media arrives (e.g. watch after videos hydrate).
      if (requestedTab && journeyTabs.some((tab) => tab.id === requestedTab)) {
        setJourney(requestedTab)
        return
      }
      setJourney("listen")
    }
  }, [journeyTabs, journey, requestedTab])

  useEffect(() => {
    if (!song) return
    const queue = [song.number, ...related.map((item) => item.number)]
    // Watch / Notation / Lyrics open should show that tab — not force Listen + audio.
    if (requestedTab && requestedTab !== "listen") {
      setJourney(requestedTab)
      if (autoPlayedFor.current === song.id) return
      autoPlayedFor.current = song.id
      const current = usePlayerStore.getState().currentSong
      // Keep whatever is already playing; only sync metadata for Listen controls.
      if (isSameSong(current, song)) syncCurrentSong(song, queue)
      else setQueue(queue)
      return
    }
    // Wait for catalog audio unless this song is already saved locally.
    if (!song.mediaHydrated && !song.audioUrl && !hasDownloadedAudio(song.number)) return
    // Once per song visit — avoid restarting on related[] updates.
    if (autoPlayedFor.current === song.id) return
    autoPlayedFor.current = song.id
    setJourney("listen")
    const current = usePlayerStore.getState().currentSong
    if (isSameSong(current, song)) {
      // Already playing this track from Home/mini-player — do not touch the Sound.
      syncCurrentSong(song, queue)
      return
    }
    loadSong(song, queue)
  }, [song?.id, song, related, loadSong, syncCurrentSong, setQueue, requestedTab])

  useEffect(() => {
    if (!song) return
    if (language === "en") {
      setLocalizedMeaning(null)
      setLocalizedTitle(null)
      setLocalizing(false)
      return
    }
    const curated = storedMeaningForLanguage(song, language)
    if (curated) {
      setLocalizedMeaning(curated)
      setLocalizedTitle(null)
      setLocalizing(false)
      return
    }
    const remembered = meaningCache.current[language]
    if (remembered) {
      setLocalizedMeaning(remembered.meaning)
      setLocalizedTitle(remembered.title)
      setLocalizing(false)
      return
    }
    const peeked = peekSongLocalization(song.number, localeLabel(language))
    if (peeked?.localized_meaning?.trim()) {
      const english = song.meaning?.trim() || ""
      const translated = peeked.localized_meaning.trim()
      const meaning = translated !== english ? translated : null
      meaningCache.current[language] = { meaning, title: peeked.localized_title ?? null }
      setLocalizedMeaning(meaning)
      setLocalizedTitle(peeked.localized_title ?? null)
      setLocalizing(false)
      return
    }
    let active = true
    setLocalizing(true)
    setRetryingMeaning(false)
    void fetchSongMeaningLocalization(song.number, language).then((result) => {
      if (!active) return
      setLocalizing(false)
      setRetryingMeaning(false)
      if (!result) {
        setLocalizedMeaning(null)
        setLocalizedTitle(null)
        return
      }
      const english = song.meaning?.trim() || ""
      const translated = result.localized_meaning?.trim() || ""
      const meaning = translated && translated !== english ? translated : null
      meaningCache.current[language] = {
        meaning,
        title: result.localized_title ?? null,
      }
      setLocalizedMeaning(meaning)
      setLocalizedTitle(result.localized_title ?? null)
    }).catch(() => {
      if (!active) return
      setLocalizing(false)
      setRetryingMeaning(false)
      setLocalizedMeaning(null)
      setLocalizedTitle(null)
    })
    return () => {
      active = false
    }
  }, [language, song, meaningRetryTick])

  if (!song) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.loadingText}>{loadError || "Song not found."}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.aiBtnText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  const isSaved = authMode === "signed_in" && savedSongIds.includes(song.id)
  const playQueue = [song.number, ...related.map((item) => item.number)]

  const handlePlayToggle = () => {
    const now = Date.now()
    if (now - lastPlayToggleAt.current < 350) return
    lastPlayToggleAt.current = now
    setJourney("listen")
    // Pause must be direct — never go through load/sync paths while audio is on.
    if (showPause) {
      pause()
      return
    }
    playOrToggle(song, playQueue)
  }

  const selectRecording = (url: string) => {
    if (!song) return
    const latestUrl = song.audioRecordings?.find((item) => item.isLatest)?.url
    usePreferencesStore.getState().setPreferredAudioUrl(
      song.id,
      url === latestUrl ? null : url,
    )
    if (song.audioUrl === url) {
      handlePlayToggle()
      return
    }
    const next = { ...song, audioUrl: url, mediaHydrated: true as const }
    setSong(next)
    playOrToggle(next, playQueue)
  }

  const openAiCompanion = () => {
    const now = Date.now()
    if (now - lastAiOpenAt.current < 400) return
    lastAiOpenAt.current = now
    router.push(href(`/(tabs)/ai?song=${song.number}`))
  }

  const shareSong = async () => {
    try {
      await Share.share({
        message: songShareMessage(song.number, song.title),
      })
    } catch {
      Alert.alert("Share", "Could not open the share sheet.")
    }
  }

  const meaningResolution = song
    ? resolveSongMeaning(song, language, localizedMeaning, localizing)
    : { status: "unavailable" as const }
  const displayTitle =
    language !== "en" && localizedTitle?.trim() ? localizedTitle : song?.title ?? ""
  const watchVideos = song.videos.filter((video) => video.embedUrl)
  const practiceLyrics = practiceLyricSource({
    lyricsOriginal: song.lyrics,
    transliteration: song.transliteration,
    firstLine: song.originalTitle,
  })
  const parkedWatchWidth = Math.max(280, windowWidth - spacing.lg * 2)

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.nav}>
          <IconButton soft accessibilityLabel="Go back" onPress={() => router.back()}>
            <ChevronLeft size={22} color={colors.textPrimary} />
          </IconButton>
          <Text style={styles.navTitle} numberOfLines={1}>
            PS {song.number}
          </Text>
          <View style={styles.navActions}>
            <IconButton
              soft
              accessibilityLabel={isSaved ? "Remove from Saved" : "Save to Saved"}
              onPress={() => {
                if (authMode !== "signed_in") {
                  router.push(href("/signin"))
                  return
                }
                const wasSaved = isSaved
                void toggleSaved(song.id).then(() => {
                  if (wasSaved) return
                  Alert.alert(
                    "Saved",
                    "Find this song anytime under Saved (bottom tab) or Profile → Saved songs.",
                    [
                      { text: "OK", style: "cancel" },
                      {
                        text: "Open Saved",
                        onPress: () => router.push(href("/(tabs)/saved")),
                      },
                    ],
                  )
                })
              }}
            >
              <Heart
                size={20}
                color={isSaved ? colors.primary : colors.textPrimary}
                fill={isSaved ? colors.primary : "transparent"}
              />
            </IconButton>
            <IconButton soft accessibilityLabel="Share song" onPress={shareSong}>
              <Share2 size={20} color={colors.textPrimary} />
            </IconButton>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
      >
        <Animated.View entering={FadeInDown.duration(240)} style={styles.hero}>
          <ScenicBackgroundImage uri={song.imageUrl} style={StyleSheet.absoluteFill} priority="high" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPause ? `Pause ${song.title}` : `Listen to ${song.title}`}
            onPress={handlePlayToggle}
            style={({ pressed }) => [styles.heroPlay, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            {showPause ? (
              <Pause size={28} color={colors.white} fill={colors.white} />
            ) : (
              <Play size={28} color={colors.white} fill={colors.white} />
            )}
          </Pressable>
          <View style={styles.heroMeta}>
            <Text style={styles.heroTitle}>{song.originalTitle ?? song.title}</Text>
            <Text style={styles.heroThemes}>{song.themes.join(" · ")}</Text>
          </View>
        </Animated.View>

        <View style={styles.titleRow} pointerEvents="box-none">
          <View style={styles.titleTextWrap} pointerEvents="none">
            <Text style={styles.englishTitle} numberOfLines={3}>
              {displayTitle}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open AI Companion for this song"
            hitSlop={10}
            onPressIn={openAiCompanion}
            style={({ pressed }) => [styles.aiCompanionChip, pressed && { opacity: 0.9 }]}
          >
            <Sparkles size={14} color={colors.white} />
            <Text style={styles.aiCompanionText}>AI Companion</Text>
          </Pressable>
        </View>
        <Text style={[styles.description, song.audioUrl ? styles.descriptionSpaced : null]}>
          {song.shortDescription}
        </Text>
        {song.audioUrl ? null : (
          <Text style={styles.audioHint}>No direct audio stream yet — player opens when media exists.</Text>
        )}

        <View
          onLayout={(event) => {
            journeyFocusY.current = event.nativeEvent.layout.y
          }}
        >
          <SongJourneyTicker
            tabs={journeyTabs}
            selected={journey}
            onSelect={(id) => {
              setJourney(id)
              scrollRef.current?.scrollTo({
                y: Math.max(0, journeyFocusY.current - 8),
                animated: false,
              })
            }}
          />
        </View>

        {watchLayout.showKeepAliveBar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to Watch"
            onPress={() => setJourney("watch")}
            style={styles.watchKeepAlive}
          >
            <Text style={styles.watchKeepAliveText}>Video still playing · tap to return to Watch</Text>
          </Pressable>
        ) : null}

        <View
          style={[styles.sectionPanel, journey !== "listen" && styles.hiddenPanel]}
          pointerEvents={journey === "listen" ? "auto" : "none"}
          importantForAccessibility={journey === "listen" ? "auto" : "no-hide-descendants"}
        >
          <Text style={styles.sectionEyebrow}>Experience · Listen</Text>
          <Text style={styles.sectionLead}>Listen to this song.</Text>
          <SongListenControls
            songId={song.id}
            songNumber={song.number}
            imageUrl={song.thumbnailUrl}
            title={song.title}
            performer={song.performer}
            audioUrl={song.audioUrl}
            recordings={song.audioRecordings}
            onSelectRecording={selectRecording}
            onTogglePlay={handlePlayToggle}
          />
        </View>

        {watchLayout.showPlayer ? (
          <View
            style={[
              styles.sectionPanel,
              watchLayout.collapsePlayer && [styles.watchParked, { width: parkedWatchWidth }],
            ]}
            pointerEvents={watchLayout.collapsePlayer ? "none" : "auto"}
            importantForAccessibility={watchLayout.collapsePlayer ? "no-hide-descendants" : "auto"}
            collapsable={false}
          >
            {watchLayout.collapsePlayer ? null : (
              <>
                <Text style={styles.sectionEyebrow}>Experience · Watch</Text>
                <Text style={styles.sectionLead}>
                  See the song with nature and sunrise — same spirit as the website Watch section.
                </Text>
              </>
            )}
            <View style={styles.watchStack} collapsable={false}>
              {watchVideos.map((video) => (
                <WatchVideoCard
                  key={video.id}
                  video={video}
                  songNumber={song.number}
                  onPlayingChange={setWatchPlaying}
                />
              ))}
            </View>
          </View>
        ) : null}

        {journey === "notation" && hasFullSargam ? (
          <View style={styles.sectionPanel}>
            <Text style={styles.sectionEyebrow}>Experience · Harmonium</Text>
            <Text style={styles.sectionLead}>
              Play the booklet lines, tap keys, or type Sa Re Ga — same layout on every song with sargam.
            </Text>
            <NotationPractice
              songNumber={song.number}
              embedded
              lyricText={practiceLyrics.practiceText}
              originalLyricText={practiceLyrics.originalText}
              sourceUrl={song.notationSourceUrl}
              verificationStatus={song.notationVerificationStatus}
              submittedBy={song.sargamSubmittedBy}
              submittedAt={song.sargamSubmittedAt}
              notationEnabled={song.notationEnabled}
            />
          </View>
        ) : null}

        <View
          style={[styles.sectionPanel, journey !== "understand" && styles.hiddenPanel]}
          pointerEvents={journey === "understand" ? "auto" : "none"}
          importantForAccessibility={journey === "understand" ? "auto" : "no-hide-descendants"}
        >
          <Text style={styles.sectionEyebrow}>Lyrics & Meaning</Text>
          {isCurrent ? (
            <SongListenControls
              songId={song.id}
              songNumber={song.number}
              imageUrl={song.thumbnailUrl}
              title={song.title}
              performer={song.performer}
              audioUrl={song.audioUrl}
              recordings={song.audioRecordings}
              onSelectRecording={selectRecording}
              onTogglePlay={handlePlayToggle}
              compact
            />
          ) : null}
          <LyricsMeaningView
            lyrics={song.lyrics}
            language={language}
            localizing={localizing}
            meaning={meaningResolution}
            onSelectLanguage={selectLanguage}
            onRetryMeaning={retryMeaningTranslation}
            retryingMeaning={retryingMeaning}
          />
        </View>

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  safe: { backgroundColor: colors.background },
  loadingText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  navTitle: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  navActions: { flexDirection: "row", gap: spacing.xs, alignItems: "center" },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.section },
  hero: {
    height: 240,
    borderRadius: radius.xl,
    overflow: "hidden",
    marginBottom: spacing.lg,
    ...softShadow(2),
  },
  heroPlay: {
    position: "absolute",
    left: "50%",
    marginLeft: -32,
    top: "36%",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  heroMeta: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  heroTitle: { fontFamily: "Lora_700Bold", fontSize: 22, color: colors.white },
  heroThemes: { ...typography.caption, color: "rgba(255,255,255,0.85)", marginTop: 4 },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    zIndex: 4,
  },
  titleTextWrap: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  englishTitle: { ...typography.h2, color: colors.textPrimary },
  aiCompanionChip: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: 2,
    minHeight: 44,
    justifyContent: "center",
    zIndex: 5,
    elevation: 5,
    ...softShadow(1),
  },
  aiCompanionText: {
    ...typography.caption,
    color: colors.white,
    fontFamily: "Inter_600SemiBold",
  },
  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  descriptionSpaced: { marginBottom: spacing.md },
  audioHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  sectionPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    ...softShadow(1),
  },
  sectionEyebrow: {
    ...typography.caption,
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionLead: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  watchStack: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  hiddenPanel: {
    display: "none",
  },
  watchParked: {
    position: "absolute",
    left: -4000,
    top: 0,
    opacity: 0,
    elevation: 0,
  },
  watchKeepAlive: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  watchKeepAliveText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontFamily: "Inter_600SemiBold",
  },
  aiBtnText: { ...typography.caption, color: colors.primary },
})
