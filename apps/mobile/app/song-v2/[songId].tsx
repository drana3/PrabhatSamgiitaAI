import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { useFonts } from "expo-font"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useReducedMotion } from "react-native-reanimated"
import { NotoSansBengali_400Regular, NotoSansBengali_700Bold } from "@expo-google-fonts/noto-sans-bengali"
import { NotoSansDevanagari_400Regular, NotoSansDevanagari_700Bold } from "@expo-google-fonts/noto-sans-devanagari"

import { WatchVideoCard } from "@/components/player/WatchVideoCard"
import { SpActions, SpTitleBlock, SpTopBar } from "@/components/song-v2/SpHeader"
import { SpChordChip, SpLyrics, SpTools } from "@/components/song-v2/SpLyrics"
import { SpChords, SpExplain, SpMeaning, SpWatch, SpWords, type SpChordToken } from "@/components/song-v2/SpSections"
import { SpLanguageSheet, SpPlaylistSheet, SpRecordingsSheet, type SpPlaylistRow } from "@/components/song-v2/SpSheets"
import { SP_TAB_HEIGHT, SpTabStrip } from "@/components/song-v2/SpTabStrip"
import { SpCard, SpPill, SpSectionTitle, SpToast } from "@/components/song-v2/SpUi"
import { Reveal } from "@/components/today/motion"
import { SP_STATUS_BAR } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { localeLabel, localeOptions } from "@/constants/languages"
import type { MockSong } from "@/data/mock"
import { useSpTheme } from "@/hooks/useSpTheme"
import { useSongMeaning } from "@/hooks/useSongMeaning"
import { FIXTURE_CENTRAL_IDEA, FIXTURE_MORE_VIDEOS, FIXTURE_PLAYLISTS, fixtureExtras } from "@/lib/fixtures/songPage"
import {
  offlineRecordingState,
  offlineSaveControls,
  reconcileOfflineProgress,
  useOfflineAudioStore,
} from "@/lib/offlineAudio"
import { songPlayback } from "@/lib/playback"
import { listenQueueForSong } from "@/lib/playbackQueue"
import { chartIsUsable, columnsInScript, layoutChart, splitWords, type WordColumn } from "@/lib/songPage/chordChart"
import { coverageForSong } from "@/lib/songPage/meaning"
import { askAboutSongRoute, learnSongRoute } from "@/lib/songPage/routes"
import { availableScripts, buildLyricSources, scriptLines } from "@/lib/songPage/scripts"
import {
  activeSection,
  isAtBottom,
  scrollTargetFor,
  SECTION_LABEL,
  visibleSections,
  type SectionId,
} from "@/lib/songPage/sections"
import { explanationIsUsable, extrasForSong, glossesAreUsable } from "@/lib/songPage/songContent"
import {
  capoHint,
  capoName,
  chordChipText,
  guitarKeyNote,
  harmoniumChord,
  harmoniumKeyNote,
  keyLabel,
  shapeCards,
  spBestCapo,
  spShape,
  strumNote,
  swaraAt,
  swaraRow,
  uniqueChords,
} from "@/lib/songPage/spChords"
import { buildSpLines, buildWordRows, glossCard, wordNote } from "@/lib/songPage/spLines"
import { alignTranslationLines, translationPill } from "@/lib/songPage/translations"
import {
  buildVersions,
  chordsForVersion,
  downloadLabel,
  downloadPhase,
  INSTRUMENT_LABEL,
  versionLine,
  type SongVersion,
} from "@/lib/songPage/versions"
import { peekResolvedSong, resolveSongBundle } from "@/lib/songs"
import { routeString, storedMeaningForLanguage } from "@/lib/songMap"
import { meaningUnavailableMessage } from "@/lib/songMeanings"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useSongPageStore } from "@/stores/songPageStore"
import { href } from "@/utils/href"

const NOTO_FONTS = {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_700Bold,
  NotoSansBengali_400Regular,
  NotoSansBengali_700Bold,
}

const PILL_SCRIPT = { roman: "Roman", devanagari: "देवनागरी", bengali: "বাংলা", both: "Both" } as const

// eslint-disable-next-line @typescript-eslint/no-require-imports
const POSTER = require("../../assets/song-v2-poster.jpg")

/**
 * Song page, ported from the design prototype (Main.dc.html, SONG): a header, a pinned tab strip, and the
 * sections on one long page (Lyrics, Words, Meaning, Explain, Chords, Watch). Reachable at /song-v2/<id>.
 * Word glosses, chord charts and the explanation come from `lib/fixtures/songPage.ts` until the API has them.
 */
export default function SongPageV2() {
  const params = useLocalSearchParams<{ songId: string | string[]; demo?: string | string[] }>()
  const songId = routeString(params.songId)
  const demo = __DEV__ && routeString(params.demo) === "1"
  const router = useRouter()
  const t = useSpTheme()
  const insets = useSafeAreaInsets()
  const reduce = useReducedMotion()

  const [song, setSong] = useState<MockSong | null>(null)
  const [related, setRelated] = useState<MockSong[]>([])
  const [loading, setLoading] = useState(true)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [plOpen, setPlOpen] = useState(false)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [toast, setToast] = useState("")
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [demoPlaylists, setDemoPlaylists] = useState(() =>
    FIXTURE_PLAYLISTS.map((p) => ({ id: p.id, name: p.name, songs: p.songs.slice() })),
  )

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(""), 2200)
  }, [])
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    },
    [],
  )

  // settings (shared with the Player karaoke view)
  const script = useSongPageStore((s) => s.script)
  const translations = useSongPageStore((s) => s.translations)
  const chordsOn = useSongPageStore((s) => s.chordsOn)
  const instrument = useSongPageStore((s) => s.instrument)
  const capo = useSongPageStore((s) => s.capo)
  const chordMode = useSongPageStore((s) => s.chordMode)
  const harmoniumKey = useSongPageStore((s) => s.harmoniumKey)
  const learningMap = useSongPageStore((s) => s.learning)
  const settings = useSongPageStore.getState

  // playback and library
  const authMode = useAuthStore((s) => s.mode)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const toggleSaved = usePreferencesStore((s) => s.toggleSaved)
  const playOrToggle = usePlayerStore((s) => s.playOrToggle)
  const pause = usePlayerStore((s) => s.pause)
  const syncCurrentSong = usePlayerStore((s) => s.syncCurrentSong)
  const stopIfPlayingLocalUri = usePlayerStore((s) => s.stopIfPlayingLocalUri)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const activeQueue = usePlayerStore((s) => s.queue)
  const playlistBounds = usePlayerStore((s) => s.playlistBounds)
  const duration = usePlayerStore((s) => s.duration)
  const showPause = usePlayerStore((s) => (song ? songPlayback(s, song).showPause : false))
  const isCurrent = usePlayerStore((s) => (song ? songPlayback(s, song).isCurrent : false))
  const playlists = usePlaylistStore((s) => s.playlists)

  // offline files
  const files = useOfflineAudioStore((s) => s.files)
  const progressMap = useOfflineAudioStore((s) => s.progress)
  const errorsMap = useOfflineAudioStore((s) => s.errors)
  const activeBySong = useOfflineAudioStore((s) => s.activeBySong)
  const offlineReady = useOfflineAudioStore((s) => s.ready)
  const download = useOfflineAudioStore((s) => s.download)
  const removeDownload = useOfflineAudioStore((s) => s.remove)
  useEffect(() => {
    reconcileOfflineProgress()
  }, [files, progressMap])

  // ---- load the song (same resolver as the current screen) ----
  useEffect(() => {
    let active = true
    const peeked = peekResolvedSong(songId)
    if (peeked) {
      setSong(peeked.song)
      setRelated(peeked.related)
      setLoading(false)
    } else {
      setLoading(true)
    }
    void resolveSongBundle(songId).then((bundle) => {
      if (!active) return
      if (bundle) {
        setSong(bundle.song)
        setRelated(bundle.related)
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [songId])

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
    // Lyrics first: opening the page never starts audio; it only follows a song that is already loaded.
    const current = player.currentSong
    if (current && current.number === song.number) syncCurrentSong(song, queue)
  }, [song, related, syncCurrentSong])

  // ---- content ----
  const sources = useMemo(
    () =>
      buildLyricSources({
        lyrics: song?.lyrics,
        transliteration: song?.transliteration,
        lyricsDevanagari: song?.lyricsDevanagari,
      }),
    [song?.lyrics, song?.transliteration, song?.lyricsDevanagari],
  )
  const scripts = useMemo(() => availableScripts(sources), [sources])
  const lines = useMemo(() => scriptLines(sources, script), [sources, script])

  // Real extras when the API has them; the prototype's samples otherwise (TODO(api) in lib/fixtures/songPage.ts).
  const extras = useMemo(() => {
    if (!song) return { chart: null, glosses: null, explanation: null }
    const real = extrasForSong(song)
    const sample = fixtureExtras(sources.roman, song.number)
    return {
      chart: real.chart ?? sample.chart,
      glosses: real.glosses ?? sample.glosses,
      explanation: real.explanation ?? sample.explanation,
    }
  }, [song, sources.roman])
  const chart = chartIsUsable(extras.chart) ? extras.chart : null
  const glosses = glossesAreUsable(extras.glosses) ? extras.glosses : null
  const explanation = explanationIsUsable(extras.explanation) ? extras.explanation : null
  const hasRealVideo = Boolean(song?.videos.some((video) => video.embedUrl))

  // Noto only when the song has that script, and only on this screen.
  const needsNoto = scripts.includes("devanagari") || scripts.includes("bengali")
  useFonts(needsNoto ? NOTO_FONTS : {})

  // chord letters as the prototype spells them, laid out against the Roman lines
  const showChord = useCallback(
    (chord: string) => {
      const base = chart?.baseKey
      if (instrument === "harmonium") return harmoniumChord(chord, base, harmoniumKey)
      return chordMode === "shapes" ? spShape(chord, capo) : chord
    },
    [chart?.baseKey, instrument, chordMode, capo, harmoniumKey],
  )
  const columnsAll: Array<WordColumn[] | null> | null = useMemo(() => {
    if (!chart) return null
    const laid = layoutChart(sources.roman, chart, showChord)
    return lines.primary.map((line, index) => {
      const columns = laid[index]
      if (!columns) return null
      if (lines.primaryScript === "roman") return columns
      return columnsInScript(columns, line)
    })
  }, [chart, sources.roman, showChord, lines])
  const chordsVisible = Boolean(chart && chordsOn)

  const translationsUnder = useMemo(() => {
    if (!song) return []
    return translations
      .map((code) => {
        const text = storedMeaningForLanguage(song, code)
        return { code, lines: alignTranslationLines(sources.roman.length ? sources.roman : lines.primary, text) ?? [] }
      })
      .filter((item) => item.lines.length > 0)
  }, [song, translations, sources.roman, lines.primary])

  const spLines = useMemo(
    () =>
      buildSpLines({
        primary: lines.primary,
        columnsByLine: chordsVisible ? columnsAll : null,
        secondary: lines.secondary,
        translations: translationsUnder,
        chordsOn: chordsVisible,
        instrument,
      }),
    [lines, columnsAll, chordsVisible, translationsUnder, instrument],
  )
  // a word gloss belongs to the Roman word at the same place; other scripts only when the counts match
  const wordCountsMatch = useMemo(
    () =>
      lines.primary.map((line, i) =>
        lines.primaryScript === "roman" ? true : splitWords(line).length === splitWords(sources.roman[i] ?? "").length,
      ),
    [lines, sources.roman],
  )
  const gloss = glossCard(selectedWord, spLines, glosses, translations, wordCountsMatch)

  const coverage = useMemo(
    () =>
      song
        ? coverageForSong(
            song,
            sources.roman.length ? sources.roman : lines.primary,
            localeOptions.map((o) => o.code),
          )
        : {},
    [song, sources.roman, lines.primary],
  )

  const meaningLanguage = translations[0] ?? "en"
  const meaningView = useSongMeaning(song, meaningLanguage)

  // ---- versions, playback, download ----
  const recordings = useMemo(() => {
    if (!song) return []
    if (song.audioRecordings?.length) return song.audioRecordings
    return song.audioUrl ? [{ title: "Original rendition", url: song.audioUrl, provider: "official" }] : []
  }, [song])
  const selectedUrl = song?.audioUrl ?? recordings[0]?.url ?? null
  const versions = useMemo(
    () => buildVersions(recordings, song?.performer ?? "", selectedUrl, isCurrent && duration > 0 ? duration : 0),
    [recordings, song?.performer, selectedUrl, isCurrent, duration],
  )
  const selectedVersion = versions.find((v) => v.url === selectedUrl) ?? versions[0] ?? null

  const queue = song
    ? listenQueueForSong(
        song.number,
        related.map((item) => item.number),
        playbackMode,
        activeQueue,
        playlistBounds,
      )
    : []

  const lastPlayAt = useRef(0)
  const handlePlay = () => {
    if (!song) return
    const now = Date.now()
    if (now - lastPlayAt.current < 350) return
    lastPlayAt.current = now
    if (showPause) {
      pause()
      return
    }
    playOrToggle(song, queue)
  }

  const pickVersion = (version: SongVersion) => {
    if (!song) return
    setVersionsOpen(false)
    const next = { ...song, audioUrl: version.url, mediaHydrated: true as const }
    setSong(next)
    playOrToggle(next, queue)
    // A guitar version turns chords on; a harmonium version picks harmonium chords.
    const effect = chordsForVersion(version.instrument)
    if (effect && chart) {
      const store = settings()
      store.setInstrument(effect.instrument)
      store.setChordsOn(effect.chordsOn)
    }
    showToast(`Playing ${INSTRUMENT_LABEL[version.instrument].toLowerCase()}, ${version.performer}`)
  }

  const offlineSnapshot = { files, progress: progressMap, errors: errorsMap, activeBySong }
  const offline = offlineRecordingState(selectedUrl, offlineSnapshot, { songNumber: song?.number })
  const saveUi = offlineSaveControls({
    mode: authMode === "signed_in" ? "signed_in" : "guest",
    downloaded: offline.downloaded,
    downloading: offline.downloading,
    indexPending: authMode === "signed_in" && !offlineReady,
    progress: offline.progress,
    error: offline.error,
  })
  const phase = downloadPhase({ downloaded: offline.downloaded, downloading: saveUi.downloading })
  const dlLabel = downloadLabel(phase, offline.progress)
  const canDownload = Boolean(selectedUrl)
  const lastPhase = useRef(phase)
  useEffect(() => {
    if (lastPhase.current === "downloading" && phase === "saved") showToast("Saved. Plays without internet")
    lastPhase.current = phase
  }, [phase, showToast])

  const signInFirst = (message: string) =>
    Alert.alert("Sign in", message, [
      { text: "Not now", style: "cancel" },
      { text: "Sign in", onPress: () => router.push(href("/signin")) },
    ])

  const handleDownload = () => {
    if (!song || !selectedUrl) return
    if (authMode !== "signed_in") {
      signInFirst("Downloading songs requires you to sign in.")
      return
    }
    if (phase === "downloading") return
    if (phase === "saved") {
      void (async () => {
        await removeDownload(offline.key)
        stopIfPlayingLocalUri(offline.fileUri)
        showToast("Removed from this phone")
      })()
      return
    }
    const remote = /^https?:\/\//i.test(selectedUrl) ? selectedUrl : offline.key
    void download(remote, song.number, { userInitiated: true }).catch(() => undefined)
  }

  const isSaved = Boolean(song && authMode === "signed_in" && savedSongIds.includes(song.id))
  const handleHeart = () => {
    if (!song) return
    if (authMode !== "signed_in") {
      router.push(href("/signin"))
      return
    }
    void toggleSaved(song.id)
    showToast(isSaved ? "Removed from Mine" : "Saved to Mine")
  }

  const learning = Boolean(song && learningMap[song.id])
  const handleLearn = () => {
    if (!song) return
    settings().markLearning(song.id)
    router.push(href(learnSongRoute(song.id)))
  }

  const askAbout = () => song && router.push(href(askAboutSongRoute(song.number)))

  // ---- playlists ----
  const guestPlaylists = authMode !== "signed_in"
  const openPlaylist = () => {
    if (!song) return
    if (guestPlaylists && !demo) {
      signInFirst("Playlists need you to sign in.")
      return
    }
    if (!guestPlaylists) void usePlaylistStore.getState().refresh()
    setPlOpen(true)
  }
  const playlistRows: SpPlaylistRow[] = useMemo(() => {
    if (!song) return []
    if (guestPlaylists) {
      return demoPlaylists.map((p) => ({
        id: p.id,
        name: p.name,
        meta: `${p.songs.length} songs`,
        has: p.songs.includes(song.number),
      }))
    }
    return playlists.map((p) => ({
      id: p.id,
      name: p.name,
      meta: `${p.songs.length} songs`,
      has: p.songs.some((entry: { song_number: number }) => entry.song_number === song.number),
    }))
  }, [song, guestPlaylists, demoPlaylists, playlists])

  const togglePlaylist = (id: string) => {
    if (!song) return
    const row = playlistRows.find((r) => r.id === id)
    if (!row) return
    if (guestPlaylists) {
      setDemoPlaylists((list) =>
        list.map((p) =>
          p.id === id
            ? { ...p, songs: row.has ? p.songs.filter((n) => n !== song.number) : [...p.songs, song.number] }
            : p,
        ),
      )
    } else {
      const store = usePlaylistStore.getState()
      void (row.has ? store.removeSong(id, song.number) : store.addSong(id, song.number))
    }
    showToast(row.has ? `Removed from ${row.name}` : `Added to ${row.name}`)
  }

  const newPlaylist = () => {
    if (!song) return
    const name = `Playlist ${playlistRows.length + 1}`
    if (guestPlaylists) {
      setDemoPlaylists((list) => [...list, { id: `fx-${list.length + 1}`, name, songs: [song.number] }])
      showToast(`Created ${name}`)
      return
    }
    void (async () => {
      const store = usePlaylistStore.getState()
      const made = await store.createPlaylist(name)
      if ("id" in made) {
        await store.addSong(made.id, song.number)
        showToast(`Created ${name}`)
      } else if ("error" in made) {
        showToast(made.error)
      }
    })()
  }

  // ---- long page: sections, pinned strip, scroll sync ----
  const sectionIds = visibleSections({
    lyrics: true,
    words: Boolean(glosses),
    meaning: true,
    explain: Boolean(explanation),
    chords: Boolean(chart),
    watch: true,
  })
  const [active, setActive] = useState<SectionId>("lyrics")
  const [stuck, setStuck] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const stripY = useRef(0)
  const contentY = useRef(0)
  const topsRef = useRef<Partial<Record<SectionId, number>>>({})
  const viewport = useRef(0)
  const contentHeight = useRef(0)
  const lockRef = useRef<{ target: number; until: number } | null>(null)
  const stuckRef = useRef(false)

  const goTo = useCallback(
    (id: SectionId) => {
      const top = topsRef.current[id]
      setActive(id)
      if (top == null) return
      const target = scrollTargetFor(top, SP_TAB_HEIGHT)
      lockRef.current = { target, until: Date.now() + 900 }
      scrollRef.current?.scrollTo({ y: target, animated: !reduce })
    },
    [reduce],
  )

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y
    const nowStuck = stripY.current > 0 && y >= stripY.current - 0.5
    if (nowStuck !== stuckRef.current) {
      stuckRef.current = nowStuck
      setStuck(nowStuck)
    }
    const lock = lockRef.current
    if (lock) {
      if (Date.now() > lock.until || Math.abs(y - lock.target) < 2) lockRef.current = null
      else return
    }
    const next = activeSection({
      order: sectionIds,
      tops: topsRef.current,
      scrollY: y,
      stripHeight: SP_TAB_HEIGHT,
      atBottom: isAtBottom(y, viewport.current, contentHeight.current),
    })
    if (next) setActive((current) => (current === next ? current : next))
  }

  const sectionTop = (id: SectionId) => (y: number) => {
    topsRef.current[id] = contentY.current + y
  }

  if (loading && !song) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: t.sand200 }]}>
        <ActivityIndicator color={t.orange500} />
      </View>
    )
  }
  if (!song) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: t.sand200 }]}>
        <Text style={{ fontFamily: amFonts.medium, fontSize: 17, color: t.ink800 }}>Song not found.</Text>
        <SpPill t={t} label="Go back" onPress={() => router.back()} />
      </View>
    )
  }

  // ---- derived values for the sections ----
  const eyebrow = [`PS ${song.number}`, song.themes?.[0]].filter(Boolean).join(" · ")
  const soundingChords = chart ? uniqueChords(chart.lines.flatMap((line) => line.placements.map((p) => p.chord))) : []

  const glossLanguages = glosses
    ? Object.entries(glosses.byLanguage)
        .filter(([, map]) => Object.keys(map).length > 0)
        .map(([code]) => code)
    : []
  const wordRows = buildWordRows(spLines, glosses, translations, wordCountsMatch)

  const meaningRows: Array<{ label: string; text: string }> = (() => {
    if (translationsUnder.length) {
      const rows: Array<{ label: string; text: string }> = []
      const count = Math.max(...translationsUnder.map((item) => item.lines.length))
      for (let li = 0; li < count; li += 1) {
        for (const item of translationsUnder) {
          const text = item.lines[li]
          if (!text) continue
          const code = item.code.split("-")[0].toUpperCase()
          rows.push({ label: translationsUnder.length > 1 ? `Line ${li + 1} · ${code}` : `Line ${li + 1}`, text })
        }
      }
      return rows
    }
    if (meaningView.meaning.status === "ready") return [{ label: "", text: meaningView.meaning.text }]
    if (meaningView.meaning.status === "loading" || meaningView.loading) {
      return [{ label: "", text: `Translating into ${localeLabel(meaningLanguage)}…` }]
    }
    return [{ label: "", text: meaningUnavailableMessage(meaningLanguage) }]
  })()
  const central = meaningView.centralIdea ?? FIXTURE_CENTRAL_IDEA[song.number] ?? null

  const chordTokens: SpChordToken[] = (() => {
    if (!chart || !columnsAll) return []
    const out: SpChordToken[] = []
    const romanColumns = layoutChart(sources.roman, chart, showChord)
    lines.primary.forEach((_, li) => {
      const columns = columnsAll[li] ?? romanColumns[li] ?? []
      if (li > 0) out.push({ key: `br-${li}`, chord: "", word: "", swara: "", lineBreak: true })
      columns.forEach((column, wi) =>
        out.push({
          key: `${li}-${wi}`,
          chord: column.chord ?? "",
          word: column.word,
          swara: instrument === "harmonium" ? swaraAt(li, wi) : "",
        }),
      )
    })
    return out
  })()

  const hint = capoHint(soundingChords, capo)
  const bestCapo = spBestCapo(soundingChords)
  const watchMore = FIXTURE_MORE_VIDEOS.map((video) => ({
    ...video,
    go: () => showToast("Video plays here"),
  }))

  return (
    <View style={[styles.root, { backgroundColor: t.sand200, paddingTop: insets.top || SP_STATUS_BAR }]}>
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={(event) => {
          viewport.current = event.nativeEvent.layout.height
        }}
        onContentSizeChange={(_, height) => {
          contentHeight.current = height
        }}
        contentContainerStyle={styles.content}
      >
        <View
          style={styles.head}
          onLayout={(event) => {
            // the strip follows the header; its own layout.y is 0 inside the sticky cell
            stripY.current = event.nativeEvent.layout.height
          }}
        >
          <Reveal index={0}>
            <SpTopBar
              t={t}
              saved={isSaved}
              onBack={() => router.back()}
              onPlaylist={openPlaylist}
              onHeart={handleHeart}
              phase={phase}
              progress={offline.progress ?? 0}
              downloadLabel={dlLabel}
              showDownload={canDownload}
              onDownload={handleDownload}
            />
          </Reveal>
          <Reveal index={1}>
            <SpTitleBlock
              t={t}
              eyebrow={eyebrow}
              title={song.title}
              versionText={versionLine(selectedVersion)}
              onVersions={() => setVersionsOpen(true)}
            />
          </Reveal>
          <Reveal index={2}>
            <SpActions t={t} playing={showPause} onPlay={handlePlay} learning={learning} onLearn={handleLearn} />
          </Reveal>
        </View>

        <View>
          <SpTabStrip t={t} sections={sectionIds} active={active} stuck={stuck} onSelect={goTo} />
        </View>

        <View
          onLayout={(event) => {
            contentY.current = event.nativeEvent.layout.y
          }}
        >
          <Reveal index={3}>
            <SpSectionTitle t={t} first label={SECTION_LABEL.lyrics} onLayoutY={sectionTop("lyrics")} />
            <SpTools
              t={t}
              langPill={`${PILL_SCRIPT[lines.choice]} · ${translations.length ? translationPill(translations) : "No translation"}`}
              chordsAvailable={Boolean(chart)}
              chordsOn={chordsOn}
              onLang={() => setLangOpen(true)}
              onChords={() => settings().setChordsOn(!chordsOn)}
            />
            {chordsVisible ? (
              <SpChordChip t={t} text={chordChipText(instrument, capo, harmoniumKey)} onPress={() => goTo("chords")} />
            ) : null}
            <View style={styles.cardGap}>
              <SpLyrics
                t={t}
                lines={spLines}
                script={lines.primaryScript}
                secondScript={lines.secondaryScript}
                selected={selectedWord}
                onSelect={setSelectedWord}
                glossTitle={gloss.title}
                glossDetail={gloss.detail}
                chordsOn={chordsVisible}
                emptyText="The lyrics of this song are not in the app yet."
              />
            </View>

            {glosses ? (
              <>
                <SpSectionTitle t={t} label={SECTION_LABEL.words} onLayoutY={sectionTop("words")} />
                <SpWords
                  t={t}
                  rows={wordRows}
                  script={lines.primaryScript}
                  note={wordNote(translations, glossLanguages, localeLabel)}
                  languages={glossLanguages.map((code) => ({ code, label: localeLabel(code) }))}
                  activeLanguage={translations[0] ?? null}
                  onLanguage={(code) => settings().setTranslations([code])}
                  onMore={() => setLangOpen(true)}
                />
              </>
            ) : null}

            <SpSectionTitle t={t} label={SECTION_LABEL.meaning} onLayoutY={sectionTop("meaning")} />
            <SpMeaning t={t} central={central} rows={meaningRows} />

            {explanation ? (
              <>
                <SpSectionTitle t={t} label={SECTION_LABEL.explain} onLayoutY={sectionTop("explain")} />
                <SpExplain t={t} explanation={explanation} onAsk={askAbout} />
              </>
            ) : null}

            {chart ? (
              <>
                <SpSectionTitle t={t} label={SECTION_LABEL.chords} onLayoutY={sectionTop("chords")} />
                <SpChords
                  t={t}
                  instrument={instrument}
                  onInstrument={(next) => settings().setInstrument(next)}
                  capo={capoName(capo)}
                  capoNoteText={guitarKeyNote(soundingChords, capo)}
                  onCapoDown={() => settings().setCapo(capo - 1)}
                  onCapoUp={() => settings().setCapo(capo + 1)}
                  capoHintText={hint.text}
                  capoHintAction={hint.action}
                  onCapoBest={() => settings().setCapo(bestCapo)}
                  cards={shapeCards(soundingChords, capo)}
                  mode={chordMode}
                  onMode={(next) => settings().setChordMode(next)}
                  keyName={keyLabel(harmoniumKey)}
                  keyNoteText={harmoniumKeyNote(harmoniumKey)}
                  onKeyDown={() => settings().stepHarmoniumKey(-1)}
                  onKeyUp={() => settings().stepHarmoniumKey(1)}
                  swaras={swaraRow(harmoniumKey)}
                  onHow={() => router.push(href("/harmonium-v2/chords"))}
                  strum={strumNote(instrument, chart.strum)}
                  tokens={chordTokens}
                  script={lines.primaryScript}
                />
              </>
            ) : null}

            <SpSectionTitle t={t} label={SECTION_LABEL.watch} onLayoutY={sectionTop("watch")} />
            {hasRealVideo ? (
              <SpCard t={t}>
                {song.videos
                  .filter((video) => video.embedUrl)
                  .map((video) => (
                    <WatchVideoCard key={video.id} video={video} songNumber={song.number} />
                  ))}
              </SpCard>
            ) : (
              <SpWatch
                t={t}
                title={song.title}
                poster={<Image source={POSTER} style={StyleSheet.absoluteFill} resizeMode="cover" />}
                onPlay={() => showToast("Video plays here")}
                more={watchMore}
              />
            )}
          </Reveal>
        </View>
      </ScrollView>

      <SpToast t={t} message={toast} />

      <SpRecordingsSheet
        t={t}
        visible={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        versions={versions}
        selectedUrl={selectedUrl}
        onPick={pickVersion}
        phase={phase}
        progress={offline.progress ?? 0}
        showDownload={canDownload}
        onDownload={handleDownload}
      />
      <SpLanguageSheet
        t={t}
        visible={langOpen}
        onClose={() => setLangOpen(false)}
        scripts={scripts}
        script={lines.choice}
        onScript={(choice) => settings().setScript(choice)}
        selected={translations}
        coverage={coverage}
        onToggleLanguage={(code) => settings().toggleTranslation(code)}
        onMissingScript={(name) => showToast(`${name} script is not added yet`)}
      />
      <SpPlaylistSheet
        t={t}
        visible={plOpen}
        onClose={() => setPlOpen(false)}
        songTitle={song.title}
        rows={playlistRows}
        onToggle={togglePlaylist}
        onNew={newPlaylist}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", gap: 16 },
  content: { paddingBottom: 190 },
  head: { paddingBottom: 12 },
  cardGap: { marginTop: 10 },
})
