import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
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
import { ChordPopover } from "@/components/song-v2/ChordPopover"
import { ChordsSection } from "@/components/song-v2/ChordsSection"
import { Pill, SectionHeading } from "@/components/song-v2/common"
import { ExplainSection } from "@/components/song-v2/ExplainSection"
import { LyricsSection, type TranslationUnder } from "@/components/song-v2/LyricsSection"
import { MeaningSection } from "@/components/song-v2/MeaningSection"
import { ScriptTranslationSheet } from "@/components/song-v2/ScriptTranslationSheet"
import { SongTitleBlock, SongTopBar } from "@/components/song-v2/SongHeader"
import { TabStrip, TAB_HEIGHT } from "@/components/song-v2/TabStrip"
import { ToolsRow } from "@/components/song-v2/ToolsRow"
import { VersionsSheet } from "@/components/song-v2/VersionsSheet"
import { WordsSection } from "@/components/song-v2/WordsSection"
import { Reveal } from "@/components/today/motion"
import { amFonts, amFontSize } from "@/constants/tokens/amTypography"
import { localeOptions } from "@/constants/languages"
import { amGap, amSpace } from "@/constants/tokens/amSpacing"
import type { MockSong } from "@/data/mock"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useSongMeaning } from "@/hooks/useSongMeaning"
import {
  offlineRecordingState,
  offlineSaveControls,
  reconcileOfflineProgress,
  useOfflineAudioStore,
} from "@/lib/offlineAudio"
import { songPlayback } from "@/lib/playback"
import { listenQueueForSong } from "@/lib/playbackQueue"
import {
  chartIsUsable,
  chordSummary,
  columnsInScript,
  displayChord,
  layoutChart,
  type ChordDisplay,
  type WordColumn,
} from "@/lib/songPage/chordChart"
import { shapeChord, soundingChord } from "@/lib/songPage/chords"
import { coverageForSong } from "@/lib/songPage/meaning"
import { askAboutSongRoute, learnSongRoute } from "@/lib/songPage/routes"
import { availableScripts, buildLyricSources, scriptLines, SCRIPT_LABEL } from "@/lib/songPage/scripts"
import {
  activeSection,
  isAtBottom,
  scrollTargetFor,
  SECTION_GAP,
  visibleSections,
  type SectionId,
} from "@/lib/songPage/sections"
import { demoExtras, explanationIsUsable, extrasForSong, glossesAreUsable } from "@/lib/songPage/songContent"
import { alignTranslationLines, translationPill } from "@/lib/songPage/translations"
import {
  buildVersions,
  chordsForVersion,
  downloadLabel,
  downloadPhase,
  versionLine,
  type SongVersion,
} from "@/lib/songPage/versions"
import { peekResolvedSong, resolveSongBundle } from "@/lib/songs"
import { routeString, storedMeaningForLanguage } from "@/lib/songMap"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useSongPageStore } from "@/stores/songPageStore"
import { href } from "@/utils/href"

const NOTO_FONTS = {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_700Bold,
  NotoSansBengali_400Regular,
  NotoSansBengali_700Bold,
}

/**
 * Song page (spec SCR-16, 18, 25, 26): one hero-less header, a pinned section
 * strip, and the sections stacked on one long page. Redesign route, reachable
 * at /song-v2/<id> until the song rows switch to it. The old /song/<id> stays.
 */
export default function SongPageV2() {
  const params = useLocalSearchParams<{ songId: string | string[]; demo?: string | string[] }>()
  const songId = routeString(params.songId)
  const demo = __DEV__ && routeString(params.demo) === "1"
  const router = useRouter()
  const theme = useAmTheme()
  const insets = useSafeAreaInsets()
  const reduce = useReducedMotion()

  const [song, setSong] = useState<MockSong | null>(null)
  const [related, setRelated] = useState<MockSong[]>([])
  const [loading, setLoading] = useState(true)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [popover, setPopover] = useState<{ shape: string; sounding: string } | null>(null)

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
  const extras = useMemo(
    () =>
      demo ? demoExtras(sources.roman) : song ? extrasForSong(song) : { chart: null, glosses: null, explanation: null },
    [demo, song, sources.roman],
  )
  const chart = chartIsUsable(extras.chart) ? extras.chart : null
  const glosses = glossesAreUsable(extras.glosses) ? extras.glosses : null
  const explanation = explanationIsUsable(extras.explanation) ? extras.explanation : null
  const hasVideo = Boolean(song?.videos.some((video) => video.embedUrl))

  // Noto only when the song has that script, and only on this screen.
  const needsNoto = scripts.includes("devanagari") || scripts.includes("bengali")
  useFonts(needsNoto ? NOTO_FONTS : {})

  const display: ChordDisplay = useMemo(
    () => ({ instrument, capo, mode: chordMode, key: harmoniumKey }),
    [instrument, capo, chordMode, harmoniumKey],
  )
  const chordsVisible = Boolean(chart && chordsOn)

  const columnsByLine: Array<WordColumn[] | null> | null = useMemo(() => {
    if (!chart || !chordsOn) return null
    const laid = layoutChart(sources.roman, chart, (chord) => displayChord(chord, display, chart.baseKey))
    return lines.primary.map((line, index) => {
      const columns = laid[index]
      if (!columns) return null
      if (lines.primaryScript === "roman") return columns
      return columnsInScript(columns, line)
    })
  }, [chart, chordsOn, sources.roman, display, lines])

  const translationsUnder: TranslationUnder[] = useMemo(() => {
    if (!song) return []
    return translations
      .map((code) => {
        const text = storedMeaningForLanguage(song, code)
        return { code, lines: alignTranslationLines(sources.roman.length ? sources.roman : lines.primary, text) ?? [] }
      })
      .filter((item) => item.lines.length > 0)
  }, [song, translations, sources.roman, lines.primary])

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
  }

  const learning = Boolean(song && learningMap[song.id])
  const handleLearn = () => {
    if (!song) return
    settings().markLearning(song.id)
    router.push(href(learnSongRoute(song.id)))
  }

  const askAbout = () => song && router.push(href(askAboutSongRoute(song.number)))

  // ---- long page: sections, pinned strip, scroll sync ----
  const sectionIds = visibleSections({
    lyrics: true,
    words: Boolean(glosses),
    meaning: true,
    explain: Boolean(explanation),
    chords: Boolean(chart),
    watch: hasVideo,
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
      const target = scrollTargetFor(top, TAB_HEIGHT)
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
      stripHeight: TAB_HEIGHT,
      atBottom: isAtBottom(y, viewport.current, contentHeight.current),
    })
    if (next) setActive((current) => (current === next ? current : next))
  }

  const section = (id: SectionId) => (event: LayoutChangeEvent) => {
    topsRef.current[id] = contentY.current + event.nativeEvent.layout.y
  }

  // Chords section is reached from the Lyrics summary chip.
  const showChords = () => goTo("chords")

  const openChordFromLyrics = (shown: string) => {
    if (display.instrument === "harmonium") return
    const shape = chordMode === "shapes" ? shown : shapeChord(shown, capo)
    const sounding = chordMode === "shapes" ? soundingChord(shown, capo) : shown
    setPopover({ shape, sounding })
  }

  if (loading && !song) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: theme.page }]}>
        <ActivityIndicator color={theme.brand} />
      </View>
    )
  }
  if (!song) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: theme.page }]}>
        <Text style={[styles.message, { color: theme.textBody }]}>Song not found.</Text>
        <Pill theme={theme} label="Go back" onPress={() => router.back()} />
      </View>
    )
  }

  const eyebrow = [`PS ${song.number}`, song.themes?.[0]].filter(Boolean).join(" · ")
  const summary = chordsVisible && chart ? chordSummary(display) : null

  return (
    <View style={[styles.root, { backgroundColor: theme.page, paddingTop: insets.top }]}>
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
        <Reveal index={0} style={styles.header}>
          <SongTopBar
            theme={theme}
            saved={isSaved}
            onBack={() => router.back()}
            onHeart={handleHeart}
            downloadPhase={phase}
            downloadProgress={offline.progress ?? 0}
            downloadLabelText={dlLabel}
            onDownload={handleDownload}
            showDownload={canDownload}
          />
          <SongTitleBlock
            theme={theme}
            eyebrow={eyebrow}
            title={song.title}
            versionText={versionLine(selectedVersion)}
            onOpenVersions={() => setVersionsOpen(true)}
            playing={showPause}
            hasAudio={Boolean(selectedUrl)}
            onPlay={handlePlay}
            learning={learning}
            onLearn={handleLearn}
          />
          {demo ? (
            <Text style={[styles.demo, { color: theme.eyebrow }]}>
              Sample chords, word meanings and explanation for layout review. Not reviewed content.
            </Text>
          ) : null}
        </Reveal>

        <View
          style={styles.stripWrap}
          onLayout={(event) => {
            stripY.current = event.nativeEvent.layout.y
          }}
        >
          <TabStrip theme={theme} sections={sectionIds} active={active} stuck={stuck} onSelect={goTo} />
        </View>

        <View
          style={styles.sections}
          onLayout={(event) => {
            contentY.current = event.nativeEvent.layout.y
          }}
        >
          <Reveal index={1} style={styles.sectionsInner}>
            <ToolsRow
              theme={theme}
              scriptLabel={SCRIPT_LABEL[lines.choice]}
              translationPill={translationPill(translations)}
              chordsAvailable={Boolean(chart)}
              chordsOn={chordsOn}
              onOpenSheet={() => setLangOpen(true)}
              onToggleChords={() => settings().setChordsOn(!chordsOn)}
            />

            <View onLayout={section("lyrics")}>
              <LyricsSection
                theme={theme}
                lines={lines}
                translations={translationsUnder}
                columnsByLine={columnsByLine}
                summary={summary}
                onChangeChords={showChords}
                onChord={openChordFromLyrics}
                emptyText="The lyrics of this song are not in the app yet."
              />
            </View>

            {glosses ? (
              <View onLayout={section("words")}>
                <WordsSection
                  theme={theme}
                  romanLines={sources.roman}
                  devanagariLines={sources.devanagari}
                  glosses={glosses}
                  languages={translations}
                  onMissingGloss={() => router.push(href("/feedback"))}
                />
              </View>
            ) : null}

            <View onLayout={section("meaning")}>
              <MeaningSection
                theme={theme}
                language={meaningLanguage}
                chosen={translations}
                meaning={meaningView.meaning}
                centralIdea={meaningView.centralIdea}
                loading={meaningView.loading}
                onPick={(code) => settings().setPrimaryTranslation(code)}
                onMore={() => setLangOpen(true)}
                onAsk={explanation ? undefined : askAbout}
              />
            </View>

            {explanation ? (
              <View onLayout={section("explain")}>
                <ExplainSection theme={theme} explanation={explanation} onAsk={askAbout} />
              </View>
            ) : null}

            {chart ? (
              <View onLayout={section("chords")}>
                <ChordsSection
                  theme={theme}
                  chart={chart}
                  instrument={instrument}
                  capo={capo}
                  mode={chordMode}
                  harmoniumKey={harmoniumKey}
                  onInstrument={(next) => settings().setInstrument(next)}
                  onCapo={(next) => settings().setCapo(next)}
                  onMode={(next) => settings().setChordMode(next)}
                  onHarmoniumStep={(direction) => settings().stepHarmoniumKey(direction)}
                  onOpenChord={(shape, sounding) => setPopover({ shape, sounding })}
                />
              </View>
            ) : null}

            {hasVideo ? (
              <View onLayout={section("watch")} style={styles.watch}>
                <SectionHeading theme={theme}>Watch</SectionHeading>
                {song.videos
                  .filter((video) => video.embedUrl)
                  .map((video) => (
                    <WatchVideoCard key={video.id} video={video} songNumber={song.number} />
                  ))}
              </View>
            ) : null}
          </Reveal>
        </View>
      </ScrollView>

      <VersionsSheet
        theme={theme}
        visible={versionsOpen}
        versions={versions}
        selectedUrl={selectedUrl}
        onClose={() => setVersionsOpen(false)}
        onPick={pickVersion}
        phase={phase}
        progress={offline.progress ?? 0}
        showDownload={canDownload}
        onDownload={handleDownload}
      />
      <ScriptTranslationSheet
        theme={theme}
        visible={langOpen}
        onClose={() => setLangOpen(false)}
        scripts={scripts}
        script={lines.choice}
        onScript={(choice) => settings().setScript(choice)}
        selected={translations}
        coverage={coverage}
        onToggleLanguage={(code) => settings().toggleTranslation(code)}
      />
      <ChordPopover
        theme={theme}
        shape={popover?.shape ?? null}
        sounding={popover?.sounding ?? null}
        onClose={() => setPopover(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", gap: amSpace.s4 },
  message: { fontFamily: amFonts.medium, fontSize: amFontSize.body },
  content: { paddingHorizontal: amGap.gutter, paddingBottom: 140 },
  header: { gap: amSpace.s6, paddingBottom: amSpace.s4 },
  stripWrap: { marginTop: amSpace.s2 },
  // layout.y of this wrapper already includes the margin, so section tops measured inside it stay true.
  sections: { marginTop: SECTION_GAP },
  sectionsInner: { gap: amGap.section },
  watch: { gap: amSpace.s3 },
  demo: { fontFamily: amFonts.semi, fontSize: amFontSize.label },
})
