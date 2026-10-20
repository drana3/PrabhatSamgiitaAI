import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native"
import { ScenicBackgroundImage } from "@/components/common/ScenicBackgroundImage"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ChevronLeft, Heart, ListPlus, Pause, Play, Share2, Sparkles } from "lucide-react-native"
import Animated, { FadeInDown } from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"

import { IconButton } from "@/components/common/IconButton"
import { SongListenControls } from "@/components/player/SongListenControls"
import { PlaylistPlaybackBar } from "@/components/playlists/PlaylistPlaybackBar"
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
import { listenQueueForSong } from "@/lib/playbackQueue"
import { resolveSongBundle, peekResolvedSong } from "@/lib/songs"
import {
  fetchSongCentralIdeaLocalization,
  fetchSongMeaningLocalization,
} from "@/lib/songLocalization"
import { resolveSongMeaning } from "@/lib/songMeanings"
import {
  isNearDuplicateProse,
  parseSongNumber,
  storedExplanationForLanguage,
  storedMeaningForLanguage,
  usableLocalizedExplanation,
  routeString,
} from "@/lib/songMap"
import { localeLabel } from "@/constants/languages"
import { practiceLyricSource, isSargamEnabledForSong } from "@/lib/sargamDisplay"
import { prefetchScenicForSong } from "@/lib/scenicPrefetch"
import {
  fetchNotationCached,
  forgetSongLocalization,
  peekSongLocalization,
} from "@/lib/songCache"
import { shareSong as shareSongSheet } from "@/lib/shareSong"
import { usePlayerStore } from "@/stores/playerStore"
import { useAuthStore } from "@/stores/authStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

export default function SongDetailScreen() {
  const params = useLocalSearchParams<{ songId: string | string[]; tab?: string | string[] }>()
  const songId = routeString(params.songId)
  const tabParam = routeString(params.tab)
  const router = useRouter()
  const { width: windowWidth } = useWindowDimensions()
  const [song, setSong] = useState<MockSong | null>(null)
  const [related, setRelated] = useState<MockSong[]>([])
  const [loadingSong, setLoadingSong] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hasNotation, setHasNotation] = useState(false)
  const loadSong = usePlayerStore((s) => s.loadSong)
  const syncCurrentSong = usePlayerStore((s) => s.syncCurrentSong)
  const playOrToggle = usePlayerStore((s) => s.playOrToggle)
  const pause = usePlayerStore((s) => s.pause)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const activeQueue = usePlayerStore((s) => s.queue)
  const playlistBounds = usePlayerStore((s) => s.playlistBounds)
  const storeCurrentNumber = usePlayerStore((s) => s.currentSong?.number ?? null)
  const playlistFollowRef = useRef(false)
  const showPause = usePlayerStore((s) =>
    song ? songPlayback(s, song).showPause : false,
  )
  const isCurrent = usePlayerStore((s) =>
    song ? songPlayback(s, song).isCurrent : false,
  )
  const authMode = useAuthStore((s) => s.mode)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const toggleSaved = usePreferencesStore((s) => s.toggleSaved)
  const [language, setLanguage] = useState("en")
  const [localizedMeaning, setLocalizedMeaning] = useState<string | null>(null)
  const [localizedTitle, setLocalizedTitle] = useState<string | null>(null)
  const [localizedCentralIdea, setLocalizedCentralIdea] = useState<string | null>(null)
  const [centralIdeaPending, setCentralIdeaPending] = useState(false)
  const [localizing, setLocalizing] = useState(false)
  const [journey, setJourney] = useState<SongJourneyTab>("understand")
  const [watchPlaying, setWatchPlaying] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const journeyFocusY = useRef(0)
  const scrollYRef = useRef(0)
  const autoPlayedFor = useRef<string | null>(null)
  const lastPlayToggleAt = useRef(0)
  const lastAiOpenAt = useRef(0)
  const meaningCache = useRef<
    Record<string, { meaning: string | null; title: string | null; explanation: string | null }>
  >({})

  const selectLanguage = useCallback(
    (code: string) => {
      // Language is for Meaning — stay on Lyrics & Meaning (never jump to Listen).
      setJourney("understand")
      setLanguage(code)
      if (!song) {
        setLocalizing(false)
        setCentralIdeaPending(false)
        return
      }
      const storedExpl = storedExplanationForLanguage(song, code)
      setLocalizedCentralIdea(storedExpl)
      const remembered = meaningCache.current[code]
      if (code === "en") {
        setLocalizedMeaning(null)
        setLocalizedTitle(null)
        if (remembered?.explanation && !storedExpl) {
          setLocalizedCentralIdea(remembered.explanation)
        }
        // No official purport → still load a simple LLM Central idea in English.
        const needsExpl =
          !song.centralIdea?.trim() && !storedExpl && !remembered?.explanation
        setLocalizing(false)
        setCentralIdeaPending(needsExpl)
        return
      }
      const stored = storedMeaningForLanguage(song, code)
      if (stored) {
        setLocalizedMeaning(stored)
        setLocalizedTitle(null)
        if (remembered?.explanation && !storedExpl) {
          setLocalizedCentralIdea(remembered.explanation)
        }
        const needsExpl = !storedExpl && !remembered?.explanation
        setLocalizing(false)
        setCentralIdeaPending(needsExpl)
        return
      }
      if (remembered) {
        setLocalizedMeaning(remembered.meaning)
        setLocalizedTitle(remembered.title)
        if (!storedExpl) setLocalizedCentralIdea(remembered.explanation)
        setLocalizing(false)
        // Retry Central idea when meaning was cached without an explanation.
        const needsExpl = !storedExpl && !remembered.explanation
        setCentralIdeaPending(needsExpl)
        return
      }
      const peeked = peekSongLocalization(song.number, localeLabel(code))
      const peekedText = peeked?.localized_meaning?.trim() || ""
      const peekedExpl = peeked?.localized_explanation?.trim() || ""
      if (peekedText) {
        setLocalizedMeaning(peekedText)
        setLocalizedTitle(peeked.localized_title ?? null)
        if (peekedExpl && !storedExpl) setLocalizedCentralIdea(peekedExpl)
        const needsExpl = !storedExpl && !peekedExpl
        setLocalizing(false)
        setCentralIdeaPending(needsExpl)
        return
      }
      setLocalizing(true)
      setCentralIdeaPending(!storedExpl && !song.centralIdea?.trim())
    },
    [song],
  )

  useEffect(() => {
    let active = true
    setLoadError(null)
    setHasNotation(false)
    setWatchPlaying(false)
    autoPlayedFor.current = null
    meaningCache.current = {}
    setLanguage("en")
    setLocalizedMeaning(null)
    setLocalizedTitle(null)
    setLocalizedCentralIdea(null)
    setLocalizing(false)
    setCentralIdeaPending(false)

    const peeked = peekResolvedSong(typeof songId === "string" ? songId : undefined)
    if (peeked) {
      setSong(peeked.song)
      setRelated(peeked.related)
      setLoadingSong(false)
      // Lyrics-first: do not warm/prefetch MP3 until the user opens Listen or presses play.
    } else {
      setLoadingSong(true)
    }

    const number = parseSongNumber(typeof songId === "string" ? songId : undefined)
    if (number) prefetchScenicForSong(number)
    void resolveSongBundle(songId).then((bundle) => {
      if (!active) return
      if (!bundle) {
        if (!peeked) {
          setSong(null)
          setRelated([])
          setLoadError("Song not found.")
        }
        setLoadingSong(false)
        return
      }
      setSong(bundle.song)
      setRelated(bundle.related)
      setLoadingSong(false)
      setHasNotation(isSargamEnabledForSong(bundle.song.number))
      if (isSargamEnabledForSong(bundle.song.number)) {
        void fetchNotationCached(bundle.song.number, "C")
      }
    })
    return () => {
      active = false
    }
  }, [songId])

  const hasVideo = Boolean(song?.videos.some((video) => video.embedUrl))
  const journeyTabs = useMemo(
    () => visibleSongJourneyTabs({ hasVideo, hasNotation }),
    [hasVideo, hasNotation],
  )
  const watchLayout = songWatchLayout(journey, { hasVideo, watchPlaying })

  const requestedTab =
    tabParam === "watch" ||
    tabParam === "understand" ||
    tabParam === "listen" ||
    tabParam === "notation"
      ? tabParam
      : null

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
      // Default: lyrics / meaning first (not Listen + audio).
      setJourney(journeyTabs.some((tab) => tab.id === "understand") ? "understand" : "listen")
    }
  }, [journeyTabs, journey, requestedTab])

  useEffect(() => {
    if (!song) return
    const player = usePlayerStore.getState()
    const queue = listenQueueForSong(
      song.number,
      related.map((item) => item.number),
      player.playbackMode,
      player.queue,
      player.playlistBounds,
    )
    const inActivePlaylist =
      player.playbackMode === "playlist" &&
      Boolean(player.playlistBounds?.includes(song.number))

    // Explicit deep-link tab (watch / listen / …).
    if (requestedTab) {
      setJourney(requestedTab)
      if (autoPlayedFor.current === song.id) return
      autoPlayedFor.current = song.id
      const current = usePlayerStore.getState().currentSong
      if (isSameSong(current, song)) {
        syncCurrentSong(song, queue)
        return
      }
      // Do not clobber an active saved playlist when only browsing another song.
      if (player.playbackMode === "playlist" && !inActivePlaylist) return
      if (requestedTab === "listen") {
        // User asked for Listen — start audio and replace casual/playlist as needed.
        loadSong(song, queue, inActivePlaylist ? "playlist" : "default")
      }
      return
    }

    // Once per song visit — lyrics-first; never auto-start MP3 on open (iOS or Android).
    if (autoPlayedFor.current === song.id) return
    autoPlayedFor.current = song.id
    setJourney(song.lyrics?.trim() ? "understand" : "listen")
    const current = usePlayerStore.getState().currentSong
    if (isSameSong(current, song)) {
      syncCurrentSong(song, queue)
      return
    }
    // Browsing a song while a playlist plays: leave queue/bounds alone until Play.
    if (player.playbackMode === "playlist" && !inActivePlaylist) return
  }, [song?.id, song, related, loadSong, syncCurrentSong, requestedTab])

  useEffect(() => {
    if (!song) return
    if (playbackMode === "playlist" && isCurrent) playlistFollowRef.current = true
    else if (playbackMode !== "playlist" || !playlistBounds?.includes(song.number)) {
      playlistFollowRef.current = false
    }
  }, [song, isCurrent, playbackMode, playlistBounds])

  useEffect(() => {
    if (!playlistFollowRef.current) return
    if (playbackMode !== "playlist" || !playlistBounds?.length || storeCurrentNumber == null) return
    if (!playlistBounds.includes(storeCurrentNumber)) return
    if (song?.number === storeCurrentNumber) return

    let active = true
    const targetId = `ps-${storeCurrentNumber}`
    void resolveSongBundle(targetId).then((bundle) => {
      if (!active || !bundle) return
      autoPlayedFor.current = bundle.song.id
      setSong(bundle.song)
      setRelated(bundle.related)
      setHasNotation(isSargamEnabledForSong(bundle.song.number))
      syncCurrentSong(
        bundle.song,
        listenQueueForSong(
          bundle.song.number,
          bundle.related.map((item) => item.number),
          playbackMode,
          activeQueue,
          playlistBounds,
        ),
      )
      if (routeString(songId) !== bundle.song.id) {
        router.replace(href(`/song/${bundle.song.id}`))
      }
    })
    return () => {
      active = false
    }
  }, [
    storeCurrentNumber,
    playbackMode,
    playlistBounds,
    song?.number,
    songId,
    syncCurrentSong,
    activeQueue,
    router,
  ])

  useEffect(() => {
    if (!song) return
    const englishIdea = song.centralIdea?.trim() || ""
    const hasOfficialIdea = Boolean(englishIdea)
    const curated = language === "en" ? null : storedMeaningForLanguage(song, language)
    const remembered = meaningCache.current[language]
    const peeked = peekSongLocalization(song.number, localeLabel(language))
    const peekedMeaning = peeked?.localized_meaning?.trim() || ""
    const englishMeaning = song.meaning?.trim() || ""
    const meaningForDup =
      curated ||
      remembered?.meaning ||
      (peekedMeaning && peekedMeaning !== englishMeaning ? peekedMeaning : null) ||
      song.hindiMeaning ||
      englishMeaning

    const pickExpl = (raw: string | null | undefined) =>
      usableLocalizedExplanation(raw, {
        officialCentralIdea: englishIdea,
        meaningCandidates: [meaningForDup, curated, remembered?.meaning, peekedMeaning],
      })

    const storedExpl = storedExplanationForLanguage(song, language)
    const rememberedExpl = pickExpl(remembered?.explanation)
    const peekedExpl = pickExpl(peeked?.localized_explanation)
    const initialExpl = storedExpl || rememberedExpl || peekedExpl
    setLocalizedCentralIdea(initialExpl)

    if (language === "en") {
      setLocalizedMeaning(null)
      setLocalizedTitle(null)
    } else if (curated) {
      setLocalizedMeaning(curated)
      setLocalizedTitle(null)
    } else if (remembered) {
      setLocalizedMeaning(remembered.meaning)
      setLocalizedTitle(remembered.title)
    } else if (peekedMeaning) {
      const meaning = peekedMeaning !== englishMeaning ? peekedMeaning : null
      meaningCache.current[language] = {
        meaning,
        title: peeked.localized_title ?? null,
        explanation: initialExpl,
      }
      setLocalizedMeaning(meaning)
      setLocalizedTitle(peeked.localized_title ?? null)
    }

    const hasMeaning =
      language === "en" || Boolean(curated || remembered?.meaning || peekedMeaning)
    const hasExpl =
      Boolean(initialExpl) || (language === "en" && hasOfficialIdea)
    const needsMeaning = language !== "en" && !hasMeaning
    const needsOfficialTranslate = hasOfficialIdea && !hasExpl
    const needsGeneratedIdea = !hasExpl && !hasOfficialIdea

    if (!needsMeaning && !needsOfficialTranslate && !needsGeneratedIdea) {
      setLocalizing(false)
      setCentralIdeaPending(false)
      return
    }

    let active = true
    // Meaning spinner only — Central idea LLM must not block translation paint.
    setLocalizing(needsMeaning || needsOfficialTranslate)
    setCentralIdeaPending(needsGeneratedIdea)

    void (async () => {
      const applyMeaningResult = (
        result: {
          localized_meaning?: string | null
          localized_title?: string | null
          localized_explanation?: string | null
        } | null,
        { preferExistingMeaning = false }: { preferExistingMeaning?: boolean } = {},
      ) => {
        if (!result) {
          if (needsMeaning) {
            setLocalizedMeaning(null)
            setLocalizedTitle(null)
          }
          return null as string | null
        }
        const translated = result.localized_meaning?.trim() || ""
        const meaning =
          translated && translated !== englishMeaning
            ? translated
            : preferExistingMeaning
              ? curated || remembered?.meaning || null
              : null
        const explanation = pickExpl(result.localized_explanation) || initialExpl
        meaningCache.current[language] = {
          meaning: language === "en" ? null : needsMeaning ? meaning : curated || remembered?.meaning || meaning,
          title:
            language === "en"
              ? null
              : needsMeaning
                ? result.localized_title ?? null
                : remembered?.title ?? result.localized_title ?? null,
          explanation,
        }
        if (needsMeaning) {
          setLocalizedMeaning(meaning)
          setLocalizedTitle(result.localized_title ?? null)
        }
        if (explanation) setLocalizedCentralIdea(explanation)
        return explanation
      }

      // One round-trip when both meaning + LLM Central idea are missing (same as a
      // generate call on web, but without a prior fast-path wait).
      if (needsMeaning && needsGeneratedIdea) {
        try {
          const idea = await fetchSongCentralIdeaLocalization(song.number, language)
          if (!active) return
          applyMeaningResult(idea)
          setLocalizing(false)
          const explRaw = pickExpl(idea?.localized_explanation)
          if (explRaw) {
            setLocalizedCentralIdea(explRaw)
            const prev = meaningCache.current[language]
            meaningCache.current[language] = {
              meaning: prev?.meaning ?? null,
              title: prev?.title ?? null,
              explanation: explRaw,
            }
          }
        } catch {
          if (active && needsMeaning) {
            setLocalizedMeaning(null)
            setLocalizedTitle(null)
          }
        } finally {
          if (active) {
            setLocalizing(false)
            setCentralIdeaPending(false)
          }
        }
        return
      }

      if (needsMeaning || needsOfficialTranslate) {
        try {
          const result = await fetchSongMeaningLocalization(song.number, language)
          if (!active) return
          applyMeaningResult(result, { preferExistingMeaning: !needsMeaning })
        } catch {
          if (!active) return
          if (needsMeaning) {
            setLocalizedMeaning(null)
            setLocalizedTitle(null)
          }
        } finally {
          if (active) setLocalizing(false)
        }
      } else {
        setLocalizing(false)
      }

      if (!needsGeneratedIdea || !active) {
        if (active) setCentralIdeaPending(false)
        return
      }
      try {
        // Never force on the automatic path — force re-LLM is only for Retry.
        const idea = await fetchSongCentralIdeaLocalization(song.number, language)
        if (!active) return
        const explRaw = pickExpl(idea?.localized_explanation)
        if (explRaw) {
          setLocalizedCentralIdea(explRaw)
          const prev = meaningCache.current[language]
          meaningCache.current[language] = {
            meaning: prev?.meaning ?? null,
            title: prev?.title ?? null,
            explanation: explRaw,
          }
        }
      } catch {
        // Meaning already shown; generated Central idea is optional.
      } finally {
        if (active) setCentralIdeaPending(false)
      }
    })()

    return () => {
      active = false
    }
  }, [language, song])

  const refreshTranslation = useCallback(async () => {
    if (!song || localizing || centralIdeaPending) return
    const code = language
    const englishIdea = song.centralIdea?.trim() || ""
    const curated = code === "en" ? null : storedMeaningForLanguage(song, code)
    delete meaningCache.current[code]
    forgetSongLocalization(song.number, localeLabel(code))

    // Explicit retry: ignore bad cached "explanations" that are meaning dumps.
    // Always regenerate when there is no official English purport.
    const needsMeaning = code !== "en" && !curated
    const needsOfficialTranslate = Boolean(englishIdea)
    const needsGenerated = !englishIdea
    if (!needsMeaning && !needsOfficialTranslate && !needsGenerated) return

    setLocalizedCentralIdea(null)
    setLocalizing(needsMeaning || needsOfficialTranslate)
    setCentralIdeaPending(needsGenerated)

    try {
      if (needsMeaning || needsOfficialTranslate) {
        const result = await fetchSongMeaningLocalization(song.number, code, { force: true })
        const english = song.meaning?.trim() || ""
        const translated = result?.localized_meaning?.trim() || ""
        const meaning = translated && translated !== english ? translated : null
        const explRaw = result?.localized_explanation?.trim() || ""
        const explanation =
          explRaw &&
          explRaw !== englishIdea &&
          !(meaning && isNearDuplicateProse(explRaw, meaning, 0.95))
            ? explRaw
            : null
        meaningCache.current[code] = {
          meaning: code === "en" ? null : meaning ?? curated,
          title: code === "en" ? null : result?.localized_title ?? null,
          explanation,
        }
        if (needsMeaning) {
          setLocalizedMeaning(meaning)
          setLocalizedTitle(result?.localized_title ?? null)
        }
        if (explanation) setLocalizedCentralIdea(explanation)
      }
      if (needsGenerated) {
        const idea = await fetchSongCentralIdeaLocalization(song.number, code, { force: true })
        const explRaw = idea?.localized_explanation?.trim() || ""
        const meaningNow =
          meaningCache.current[code]?.meaning ||
          curated ||
          localizedMeaning ||
          song.meaning?.trim() ||
          ""
        const usable =
          Boolean(explRaw) &&
          explRaw !== englishIdea &&
          !(meaningNow && isNearDuplicateProse(explRaw, meaningNow, 0.95))
        if (usable) {
          setLocalizedCentralIdea(explRaw)
          const prev = meaningCache.current[code]
          meaningCache.current[code] = {
            meaning: prev?.meaning ?? null,
            title: prev?.title ?? null,
            explanation: explRaw,
          }
          // Keep Retry from re-reading a meaning-dump on the next effect.
          setSong((prevSong) =>
            prevSong
              ? {
                  ...prevSong,
                  localizedExplanations: {
                    ...(prevSong.localizedExplanations || {}),
                    [code]: explRaw,
                  },
                }
              : prevSong,
          )
        }
      }
    } catch {
      // Keep whatever meaning is already on screen.
    } finally {
      setLocalizing(false)
      setCentralIdeaPending(false)
    }
  }, [song, language, localizing, centralIdeaPending, localizedMeaning])

  if (loadingSong && !song) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Loading song…</Text>
      </View>
    )
  }

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
  const playQueue = listenQueueForSong(
    song.number,
    related.map((item) => item.number),
    playbackMode,
    activeQueue,
    playlistBounds,
  )

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
      await shareSongSheet({
        number: song.number,
        title: song.title,
        performer: song.performer,
        detail: song.originalTitle || song.themes?.[0],
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
              accessibilityLabel={isSaved ? "Remove favorite" : "Save favorite"}
              onPress={() => {
                if (authMode !== "signed_in") {
                  router.push(href("/signin"))
                  return
                }
                void toggleSaved(song.id)
              }}
            >
              <Heart
                size={20}
                color={isSaved ? colors.primary : colors.textPrimary}
                fill={isSaved ? colors.primary : "transparent"}
              />
            </IconButton>
            <IconButton
              soft
              accessibilityLabel="Add to playlist"
              onPress={() => {
                if (authMode !== "signed_in") {
                  Alert.alert("Sign in", "Playlist creation requires you to sign in.", [
                    { text: "Not now", style: "cancel" },
                    { text: "Sign in", onPress: () => router.push(href("/signin")) },
                  ])
                  return
                }
                router.push(href(`/playlist/add?song=${song.number}`))
              }}
            >
              <ListPlus size={20} color={colors.textPrimary} />
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
        onScroll={(event) => {
          scrollYRef.current = event.nativeEvent.contentOffset.y
        }}
        scrollEventThrottle={16}
      >
        {loadingSong ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading song…</Text>
          </View>
        ) : null}
        <View style={styles.heroShell}>
        {Platform.OS === "ios" ? (
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
            <Text style={styles.heroThemes}>{(song.themes ?? []).join(" · ")}</Text>
          </View>
        </Animated.View>
        ) : (
        <View style={styles.hero}>
          <ScenicBackgroundImage uri={song.imageUrl} style={StyleSheet.absoluteFill} priority="high" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPause ? `Pause ${song.title}` : `Listen to ${song.title}`}
            onPress={handlePlayToggle}
            style={({ pressed }) => [styles.heroPlay, pressed && { opacity: 0.92 }]}
          >
            {showPause ? (
              <Pause size={28} color={colors.white} fill={colors.white} />
            ) : (
              <Play size={28} color={colors.white} fill={colors.white} />
            )}
          </Pressable>
          <View style={styles.heroMeta}>
            <Text style={styles.heroTitle}>{song.originalTitle ?? song.title}</Text>
            <Text style={styles.heroThemes}>{(song.themes ?? []).join(" · ")}</Text>
          </View>
        </View>
        )}
        </View>

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
            onPress={openAiCompanion}
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
              if (id === "listen" && song) {
                usePlayerStore.getState().warmAudio(song)
              }
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
          <PlaylistPlaybackBar songNumber={song.number} />
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

        {journey === "notation" && hasNotation ? (
          <View style={styles.sectionPanel}>
            <Text style={styles.sectionEyebrow}>Experience · Sargam</Text>
            <Text style={styles.sectionLead}>
              Hindi sargam and keys for this song, same source as the website. No player — read and learn the notes.
            </Text>
            <NotationPractice
              songNumber={song.number}
              embedded
              lyricText={practiceLyrics.practiceText}
              originalLyricText={practiceLyrics.originalText}
              sourceUrl={song.notationSourceUrl}
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
              onTogglePlay={handlePlayToggle}
              compact
            />
          ) : null}
          <LyricsMeaningView
            songNumber={song.number}
            lyrics={song.lyrics}
            lyricsDevanagari={song.lyricsDevanagari}
            devanagariStatus={song.devanagariStatus}
            language={language}
            localizing={localizing}
            meaning={meaningResolution}
            centralIdea={song.centralIdea}
            localizedCentralIdea={localizedCentralIdea}
            centralIdeaPending={centralIdeaPending}
            onSelectLanguage={selectLanguage}
            onRefreshTranslation={refreshTranslation}
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
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
  heroShell: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    ...softShadow(2),
  },
  hero: {
    height: 240,
    borderRadius: radius.xl,
    overflow: "hidden",
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
    height: 0,
    overflow: "hidden",
    opacity: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    borderWidth: 0,
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
