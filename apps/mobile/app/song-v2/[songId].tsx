import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Alert, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from "react-native"
import { Image as ExpoImage } from "expo-image"
import { useFonts } from "expo-font"
import { useLocalSearchParams, usePathname, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated"
import { NotoSansBengali_400Regular, NotoSansBengali_700Bold } from "@expo-google-fonts/noto-sans-bengali"
import { NotoSansDevanagari_400Regular, NotoSansDevanagari_700Bold } from "@expo-google-fonts/noto-sans-devanagari"

import { WatchVideoCard } from "@/components/player/WatchVideoCard"
import { SongPageVariants } from "@/components/song-page-variants/SongPageVariants"
import { VariantSwitcher, useResolvedVariant } from "@/components/song-page-variants/Switcher"
import { AboutSheet } from "@/components/player-v2/AboutSong"
import { ActionsSheet } from "@/components/player-v2/ActionsSheet"
import { ShareSheet } from "@/components/player-v2/ShareSheet"
import { SpAboutCard, SpCredits } from "@/components/song-v2/SpFooter"
import { SpDemoTag, SpEmptyNote } from "@/components/song-v2/SpHonest"
import { SP_HERO_TEXT_TOP, SP_PLAY_SIZE, SP_PLAY_TOP, SpActionRow, SpHeroCover, SpHeroText, SpHeroWash } from "@/components/song-v2/SpHero"
import { SpLyricsCard } from "@/components/song-v2/SpLyricsCard"
import { SP_BAR_CONTENT, SpStickyBar } from "@/components/song-v2/SpStickyBar"
import { SpVersionRow } from "@/components/song-v2/SpVersions"
import { SpChordChip, SpLyrics, SpTools } from "@/components/song-v2/SpLyrics"
import { SpChords, SpExplain, SpMeaning, SpWatch, SpWords, type SpChordToken } from "@/components/song-v2/SpSections"
import { SpLanguageSheet, SpPlaylistSheet, SpRecordingsSheet, type SpPlaylistRow } from "@/components/song-v2/SpSheets"
import { SP_TAB_HEIGHT, SpTabStrip } from "@/components/song-v2/SpTabStrip"
import { SpCard, SpGapNote, SpPill, SpSectionTitle, SpToast } from "@/components/song-v2/SpUi"
import { Reveal } from "@/components/today/motion"
import { SP_STATUS_BAR, spRadius } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { localeLabel } from "@/constants/languages"
import { allCollections } from "@/data/collections"
import type { MockSong } from "@/data/mock"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { useDownloadState } from "@/hooks/useDownloadState"
import { useSaveState } from "@/hooks/useSaveState"
import { useSongMeaning } from "@/hooks/useSongMeaning"
import { FIXTURE_MORE_VIDEOS, FIXTURE_PLAYLISTS } from "@/lib/fixtures/songPage"
import { demoUrl } from "@/lib/fixtures/playerDemo"
import {
  MOCKUP_LANGUAGES,
  MOCKUP_LEARNING,
  mockupFixtureKey,
  mockupRow,
  mockupSizeText,
  mockupSong,
  mockupTranslation,
  mockupVersions,
} from "@/lib/fixtures/songMockup"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { reconcileOfflineProgress, useOfflineAudioStore } from "@/lib/offlineAudio"
import { songDownloadItem } from "@/lib/offline/downloadItems"
import type { DownloadItem } from "@/lib/offline/downloadModel"
import { demoDownloadKey, useDemoDownloads } from "@/lib/playerV2/demoDownloads"
import { NAV_V2_PLAYER_ROUTE, miniPlayerVisible } from "@/lib/navV2"
import { songPlayback } from "@/lib/playback"
import { listenQueueForSong } from "@/lib/playbackQueue"
import { mixHex, tintForSong } from "@/lib/playerV2/coverTint"
import { aboutContent, buildActionRows, collectionForSong, queueAddMessage, type ActionId } from "@/lib/playerV2/playerActions"
import { runShare } from "@/lib/playerV2/playerActionsIO"
import type { SaveItem } from "@/lib/save/saveToSheet"
import { buildSharePayload, shareToast, type ShareTargetId } from "@/lib/playerV2/playerShare"
import { realQueueActions } from "@/lib/playerV2/services"
import { chartIsUsable, columnsInScript, layoutChart, splitWords, type WordColumn } from "@/lib/songPage/chordChart"
import { coverageForSong } from "@/lib/songPage/meaning"
import { askAboutSongRoute, learnSongRoute } from "@/lib/songPage/routes"
import { availableScripts, buildLyricSources, scriptLines } from "@/lib/songPage/scripts"
import {
  activeSection,
  scrollTargetFor,
  SECTION_GAP,
  SECTION_LABEL,
  visibleSections,
  type SectionId,
} from "@/lib/songPage/sections"
import { NO_EXTRAS, explanationIsUsable, extrasForSong, glossesAreUsable } from "@/lib/songPage/songContent"
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
import { buildSpLines, buildWordRows, glossCard } from "@/lib/songPage/spLines"
import { EMPTY_TEXT, demoCentralIdea, knownSeconds, notationPdfUrl, pageExtras, requestKey, shownPerformer, watchVideos } from "@/lib/songPage/honest"
import { creditRows, languageParts, metaLine, nowPlaying, previewLines, psLine, versionOrder } from "@/lib/songPage/nowPlaying"
import { pageBottomInset, stripHairline, stripTop, type BarMarks } from "@/lib/songPage/stickyBar"
import { alignTranslationLines, translationPill, type Coverage } from "@/lib/songPage/translations"
import {
  LYRIC_LANGUAGES,
  LYRIC_LANGUAGE_CODES,
  REQUEST_TOAST,
  effectiveTranslations,
  gapNotice,
  lyricLanguageTitle,
  lyricShortCode,
  pickShown,
  resolveLyricLanguage,
} from "@/lib/songPage/lyricLanguages"
import { useLanguage } from "@/lib/i18n"
import {
  buildVersions,
  chordsForVersion,
  INSTRUMENT_LABEL,
  type SongVersion,
} from "@/lib/songPage/versions"
import { peekResolvedSong, resolveSongBundle } from "@/lib/songs"
import { routeString, storedMeaningForLanguage } from "@/lib/songMap"
import { meaningUnavailableMessage } from "@/lib/songMeanings"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { openSaveSheet } from "@/stores/saveSheetStore"
import { useSongPageStore } from "@/stores/songPageStore"
import { href } from "@/utils/href"

const NOTO_FONTS = {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_700Bold,
  NotoSansBengali_400Regular,
  NotoSansBengali_700Bold,
}

const PILL_SCRIPT = { roman: "Roman", devanagari: "देवनागरी", bengali: "বাংলা", both: "Both" } as const

/** Rows of the Player's More sheet that make sense on the song page (the rest are about the Player itself). */
const SONG_PAGE_ACTIONS: ActionId[] = ["share", "save", "playlist", "queue", "collection", "report"]

/** Space between the bar and the cover. */
const HERO_GAP = 8

// eslint-disable-next-line @typescript-eslint/no-require-imports
const POSTER = require("../../assets/song-v2-poster.jpg")

/**
 * Song page, ported from the design prototype (Main.dc.html, SONG): a header, a pinned tab strip, and the
 * sections on one long page (Lyrics, Words, Meaning, Explain, Chords, Watch). Reachable at /song-v2/<id>.
 * Word glosses, chord charts and the explanation come from `lib/fixtures/songPage.ts` until the API has them.
 */
function CurrentSongPage() {
  const params = useLocalSearchParams<{
    songId: string | string[]
    demo?: string | string[]
    section?: string | string[]
    ver?: string | string[]
    dlprog?: string | string[]
    sel?: string | string[]
  }>()
  const songId = routeString(params.songId)
  const demo = __DEV__ && routeString(params.demo) === "1"
  const router = useRouter()
  const t = useSpTheme()
  const am = useAmTheme()
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const pathname = usePathname()
  const reduce = useReducedMotion()

  const [song, setSong] = useState<MockSong | null>(null)
  const [related, setRelated] = useState<MockSong[]>([])
  const [loading, setLoading] = useState(true)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [plOpen, setPlOpen] = useState(false)
  const [sheet, setSheet] = useState<null | "actions" | "share" | "about">(null)
  const [selectedWord, setSelectedWord] = useState<string | null>(() => {
    if (!MOCKUP_DATA) return null
    // preview only: `?sel=none` or `?sel=0-1` starts with another word picked, like the prototype's boards
    const pick = routeString(params.sel)
    return pick === "none" ? null : pick || "0-0"
  })
  const [toast, setToast] = useState("")
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [demoPlaylists, setDemoPlaylists] = useState(() =>
    FIXTURE_PLAYLISTS.map((p) => ({ id: p.id, name: p.name, songs: p.songs.slice() })),
  )

  // MOCKUP_DATA only: the prototype's sample song and the state it keeps in memory (saved, version, download, requests)
  const mockNumber = MOCKUP_DATA ? Number.parseInt((songId ?? "").replace(/\D/g, ""), 10) : Number.NaN
  const mockRow = Number.isFinite(mockNumber) ? mockupRow(mockNumber) : null
  const mock = MOCKUP_DATA && mockRow ? mockRow : null
  const [mockVer, setMockVer] = useState(() => Number.parseInt(routeString(params.ver) || "0", 10) || 0)
  const [requested, setRequested] = useState<string[]>([])

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
  const requestLanguage = useCallback((code: string) => {
    // TODO(api): send the request to the catalog; for now it is remembered on this screen only
    setRequested((list) => (list.includes(code) ? list : [...list, code]))
    showToast(REQUEST_TOAST)
  }, [showToast])
  // Words and Chords have no data for most songs: "Request" is remembered on this screen like a language request
  const requestContent = (kind: "words" | "chords") => song && requestLanguage(requestKey(kind, song.number))
  const askedContent = (kind: "words" | "chords") => (song ? requested.includes(requestKey(kind, song.number)) : false)

  // settings (shared with the Player karaoke view)
  const script = useSongPageStore((s) => s.script)
  const storedTranslations = useSongPageStore((s) => s.translations)
  const storedWordLanguage = useSongPageStore((s) => s.wordLanguage)
  const appLanguage = useLanguage()
  // nothing chosen yet means the language of the app; "fr" and the like are no longer offered
  const translations = useMemo(() => effectiveTranslations(storedTranslations, appLanguage), [storedTranslations, appLanguage])
  const wordLanguage = resolveLyricLanguage(storedWordLanguage, appLanguage)
  const chordsOn = useSongPageStore((s) => s.chordsOn)
  const instrument = useSongPageStore((s) => s.instrument)
  const capo = useSongPageStore((s) => s.capo)
  const chordMode = useSongPageStore((s) => s.chordMode)
  const harmoniumKey = useSongPageStore((s) => s.harmoniumKey)
  const learningMap = useSongPageStore((s) => s.learning)
  const settings = useSongPageStore.getState

  // playback and library
  const authMode = useAuthStore((s) => s.mode)
  const playOrToggle = usePlayerStore((s) => s.playOrToggle)
  const pause = usePlayerStore((s) => s.pause)
  const syncCurrentSong = usePlayerStore((s) => s.syncCurrentSong)
  const stopIfPlayingLocalUri = usePlayerStore((s) => s.stopIfPlayingLocalUri)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const activeQueue = usePlayerStore((s) => s.queue)
  const playlistBounds = usePlayerStore((s) => s.playlistBounds)
  const duration = usePlayerStore((s) => s.duration)
  const currentSong = usePlayerStore((s) => s.currentSong)
  const playerPlaying = usePlayerStore((s) => s.isPlaying)
  const playerBuffering = usePlayerStore((s) => s.isBuffering)
  const hasSong = Boolean(currentSong)
  const isCurrent = usePlayerStore((s) => (song ? songPlayback(s, song).isCurrent : false))
  const playlists = usePlaylistStore((s) => s.playlists)

  // offline files
  const files = useOfflineAudioStore((s) => s.files)
  const progressMap = useOfflineAudioStore((s) => s.progress)
  useEffect(() => {
    reconcileOfflineProgress()
  }, [files, progressMap])

  // ---- load the song (same resolver as the current screen) ----
  useEffect(() => {
    let active = true
    const sample = mock ? mockupSong(mock.n) : null
    if (sample) {
      setSong(sample)
      setRelated([])
      setLoading(false)
      return
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId, mock?.n])

  useEffect(() => {
    if (!song || mock) return
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
  }, [song, related, syncCurrentSong, mock])

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

  // Real extras when the API has them (none yet). The prototype's samples (chords, word meanings, explanation) are
  // drawn only for the demo preview's PS 1 and PS 3 and carry a "Demo content" tag: never for a real song.
  const demoKey = mock && song ? mockupFixtureKey(song.number) : null
  const extras = useMemo(() => {
    if (!song) return pageExtras({ real: NO_EXTRAS, demoKey: null, romanLines: [] })
    return pageExtras({ real: mock ? NO_EXTRAS : extrasForSong(song), demoKey, romanLines: sources.roman })
  }, [song, sources.roman, mock, demoKey])
  const chart = chartIsUsable(extras.chart) ? extras.chart : null
  const glosses = glossesAreUsable(extras.glosses) ? extras.glosses : null
  const explanation = explanationIsUsable(extras.explanation) ? extras.explanation : null
  // the verified YouTube videos the catalog has for this song (none for most songs)
  const videos = useMemo(() => watchVideos(song?.videos), [song?.videos])
  const hasRealVideo = videos.length > 0

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
    const laid = layoutChart(sources.roman, chart, showChord, Boolean(mock))
    return lines.primary.map((line, index) => {
      const columns = laid[index]
      if (!columns) return null
      if (lines.primaryScript === "roman") return columns
      return columnsInScript(columns, line)
    })
  }, [chart, sources.roman, showChord, lines, mock])
  const chordsVisible = Boolean(chart && chordsOn)

  // The translated lines the song really has, per offered language (null when it has none).
  const linesByLanguage = useMemo(() => {
    const out: Record<string, string[] | null> = {}
    for (const code of LYRIC_LANGUAGE_CODES) {
      if (!song) {
        out[code] = null
      } else if (mock) {
        out[code] = mockupTranslation(song.number, code)
      } else {
        const text = storedMeaningForLanguage(song, code)
        out[code] = alignTranslationLines(sources.roman.length ? sources.roman : lines.primary, text)
      }
    }
    return out
  }, [song, sources.roman, lines.primary, mock])
  const hasLinesIn = useCallback((code: string) => Boolean(linesByLanguage[code]?.length), [linesByLanguage])
  // A language the song lacks falls back to English, and the page says so: never another language
  // under the wrong name, never made-up text.
  const translationPicks = useMemo(() => translations.map((code) => pickShown(code, hasLinesIn)), [translations, hasLinesIn])
  const translationsUnder = useMemo(() => {
    const seen = new Set<string>()
    const out: Array<{ code: string; lines: string[] }> = []
    for (const pick of translationPicks) {
      if (!pick.shown || seen.has(pick.shown)) continue
      seen.add(pick.shown)
      out.push({ code: pick.shown, lines: linesByLanguage[pick.shown] ?? [] })
    }
    return out
  }, [translationPicks, linesByLanguage])
  const translationGap = translationPicks.find((pick) => pick.gap) ?? null

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
  // Word meanings have their own language: picking one on the Words card never changes the Meaning section.
  const glossLanguages = useMemo(
    () =>
      glosses
        ? Object.entries(glosses.byLanguage)
            .filter(([, map]) => Object.keys(map).length > 0)
            .map(([code]) => code)
        : [],
    [glosses],
  )
  const wordPick = useMemo(() => pickShown(wordLanguage, (code) => glossLanguages.includes(code)), [wordLanguage, glossLanguages])
  const wordShown = wordPick.shown ? [wordPick.shown] : []
  const gloss = glossCard(selectedWord, spLines, glosses, wordShown, wordCountsMatch)

  // what the song has per offered language, for the sheet
  const coverage = useMemo(
    () =>
      mock
        ? Object.fromEntries(
            LYRIC_LANGUAGE_CODES.map((code) => [code, (MOCKUP_LANGUAGES.find((l) => l.code === code)?.coverage ?? "none") as Coverage]),
          )
        : song
        ? coverageForSong(song, sources.roman.length ? sources.roman : lines.primary, [...LYRIC_LANGUAGE_CODES])
        : {},
    [song, sources.roman, lines.primary, mock],
  )

  const meaningLanguage = translations[0] ?? "en"
  const meaningView = useSongMeaning(song, meaningLanguage)

  // ---- versions, playback, download ----
  const recordings = useMemo(() => {
    if (!song) return []
    if (song.audioRecordings?.length) return song.audioRecordings
    return song.audioUrl ? [{ title: "Original rendition", url: song.audioUrl, provider: "official" }] : []
  }, [song])
  const selectedUrl = mock
    ? (mockupVersions(mock.n)[mockVer]?.url ?? null)
    : (song?.audioUrl ?? recordings[0]?.url ?? null)
  const mockVersions = useMemo(() => (mock ? mockupVersions(mock.n) : null), [mock])
  const versions = useMemo(
    () =>
      mockVersions ??
      buildVersions(recordings, song?.performer ?? "", selectedUrl, isCurrent && duration > 0 ? duration : 0),
    [mockVersions, recordings, song?.performer, selectedUrl, isCurrent, duration],
  )
  const selectedVersion = mockVersions
    ? (mockVersions[mockVer] ?? mockVersions[0] ?? null)
    : (versions.find((v) => v.url === selectedUrl) ?? versions[0] ?? null)

  const queue = song
    ? listenQueueForSong(
        song.number,
        related.map((item) => item.number),
        playbackMode,
        activeQueue,
        playlistBounds,
      )
    : []

  // what the unified player says about this song: current, playing, which version
  const playing = song
    ? nowPlaying({ currentSong, isPlaying: playerPlaying, isBuffering: playerBuffering }, song, versions)
    : null
  const showPause = playing?.showPause ?? false
  const playingIndex = playing?.versionIndex ?? -1
  // the preview's sample song follows the version the player is on
  useEffect(() => {
    if (mock && playingIndex >= 0) setMockVer(playingIndex)
  }, [mock, playingIndex])

  // The song as the player loads it. The web preview's demo player reads the version from a demo:// url.
  const playable = (version: SongVersion | null): MockSong => {
    if (!song) throw new Error("no song")
    if (!version) return song
    const url = mock ? demoUrl(song.number, Math.max(0, versions.findIndex((v) => v.id === version.id)) + 1) : version.url
    return { ...song, audioUrl: url, mediaHydrated: true as const }
  }

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
    // Real catalog: the song as it is; the preview's demo player needs the version's demo url.
    if (mock) usePlayerStore.getState().playOrToggle(playable(selectedVersion), queue)
    else playOrToggle(song, queue)
  }

  const pickVersion = (version: SongVersion) => {
    if (!song) return
    setVersionsOpen(false)
    const index = Math.max(0, versions.findIndex((v) => v.id === version.id))
    if (playing?.isCurrent && playing.versionIndex === index) {
      // the version that is loaded: a tap toggles it, like a track row
      if (showPause) pause()
      else if (mock) usePlayerStore.getState().playOrToggle(playable(version), queue)
      else playOrToggle(song, queue)
      return
    }
    if (mock) {
      setMockVer(index)
      usePlayerStore.getState().loadSong(playable(version), queue, "default")
    } else {
      const next = { ...song, audioUrl: version.url, mediaHydrated: true as const }
      setSong(next)
      playOrToggle(next, queue)
    }
    // A guitar version turns chords on; a harmonium version picks harmonium chords.
    const effect = chordsForVersion(version.instrument)
    if (effect && chart) {
      const store = settings()
      store.setInstrument(effect.instrument)
      store.setChordsOn(effect.chordsOn)
    }
    showToast(`Playing ${(version.label ?? INSTRUMENT_LABEL[version.instrument]).toLowerCase()}, ${version.performer}`)
  }

  // ---- download: the one shared control (components/offline/DownloadButton.tsx) ----
  const downloadItem: DownloadItem | null =
    song && selectedUrl
      ? songDownloadItem(song.number, {
          url: selectedUrl,
          versionIndex: mock ? mockVer : undefined,
          title: song.title,
          seconds: selectedVersion?.length ?? undefined,
        })
      : null
  const downloadStatus = useDownloadState(downloadItem).view.status
  const lastStatus = useRef(downloadStatus)
  useEffect(() => {
    if (lastStatus.current === "downloading" && downloadStatus === "done") showToast("Saved. Plays without internet")
    lastStatus.current = downloadStatus
  }, [downloadStatus, showToast])
  // The boards of the design freeze a download at some percent: /song-v2/ps-3?dlprog=0.42
  const frozenProgress = Number.parseFloat(routeString(params.dlprog) || "")
  useEffect(() => {
    if (!mock || !Number.isFinite(frozenProgress)) return
    useDemoDownloads.setState((d) => ({ progress: { ...d.progress, [demoDownloadKey(mock.n, mockVer)]: frozenProgress } }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signInFirst = (message: string) =>
    Alert.alert("Sign in", message, [
      { text: "Not now", style: "cancel" },
      { text: "Sign in", onPress: () => router.push(href("/signin")) },
    ])

  // Saved = in Mine or in any playlist; the circle-plus opens the "Save to" sheet. The preview seeds
  // the same stores (lib/playerV2/demoEngine.ts), so no separate mock state is needed here.
  const saveItem: SaveItem | null = song ? { kind: "song", number: song.number } : null
  const isSaved = useSaveState(saveItem).saved
  const handleHeart = () => {
    if (saveItem) openSaveSheet(saveItem)
  }

  const learning = Boolean(song && (learningMap[song.id] || (mock && MOCKUP_LEARNING.includes(song.number))))
  const handleLearn = () => {
    if (!song) return
    settings().markLearning(song.id)
    router.push(href(learnSongRoute(song.id)))
  }

  const askAbout = () => song && router.push(href(askAboutSongRoute(song.number)))

  // ---- playlists ----
  const guestPlaylists = Boolean(mock) || authMode !== "signed_in"
  const openPlaylist = () => {
    if (!song) return
    if (guestPlaylists && !demo && !mock) {
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

  // ---- more, share, about ----
  const collection = useMemo(() => (song ? collectionForSong(song.number, allCollections) : null), [song])
  // the catalog has no performer field (a version is named by its audio title): a performer shows in the demo only
  const performerName = shownPerformer({ demo: Boolean(mock), versionPerformer: selectedVersion?.performer, songPerformer: song?.performer })
  const actionRows = useMemo(
    () =>
      buildActionRows({
        saved: isSaved,
        inQueue: song ? activeQueue.includes(song.number) : false,
        collectionName: collection?.label ?? null,
        sourceName: "All songs",
        speedText: "1×",
        sleepText: "Off",
      }).filter((row) => SONG_PAGE_ACTIONS.includes(row.id)),
    [isSaved, song, activeQueue, collection],
  )
  const sharePayload = useMemo(
    () => (song ? buildSharePayload({ number: song.number, title: song.title, performer: performerName }) : null),
    [song, performerName],
  )
  // the prototype's "Placeholder." story lines are not shown as the story
  const about = useMemo(() => {
    if (!song) return null
    const real = (text: string | null | undefined) => (text && !/^placeholder/i.test(text.trim()) ? text : null)
    const fallback = real(meaningView.centralIdea) ?? real(demoCentralIdea(demoKey))
    return aboutContent({ ...song, centralIdea: real(song.centralIdea) }, fallback)
  }, [song, meaningView.centralIdea])

  const onAction = (id: ActionId) => {
    if (!song) return
    switch (id) {
      case "share":
        return setSheet("share")
      case "save":
        setSheet(null)
        return handleHeart()
      case "playlist":
        setSheet(null)
        return openPlaylist()
      case "queue": {
        const there = activeQueue.includes(song.number)
        if (!there) realQueueActions().add(song.number)
        setSheet(null)
        return showToast(queueAddMessage(there))
      }
      case "collection": {
        setSheet(null)
        const label = collection?.label
        return router.push(
          href(label ? `/songs-v2-collection?id=${encodeURIComponent(label)}&title=${encodeURIComponent(label)}` : "/songs-v2-index"),
        )
      }
      case "report":
        // Opens Send feedback with this song picked ("A mistake in a song or lyrics").
        setSheet(null)
        return router.push(href(`/feedback?song=${song.number}`))
      default:
        return setSheet(null)
    }
  }
  const onShareTarget = (target: ShareTargetId, override?: Parameters<typeof runShare>[1]) => {
    const payload = override ?? sharePayload
    if (!payload) return
    void runShare(target, payload).then((outcome) => {
      const message = shareToast(outcome)
      // a copied link closes the sheet, so the toast shows over the page and not over the buttons
      if (message) {
        setSheet(null)
        showToast(message)
      }
    })
  }

  // ---- long page: hero, collapsing bar, pinned strip, sections ----
  const sectionIds = visibleSections({
    lyrics: true,
    words: true,
    meaning: true,
    explain: Boolean(explanation),
    chords: true,
    watch: true,
  })
  const [active, setActive] = useState<SectionId | null>("lyrics")
  const scrollRef = useRef<Animated.ScrollView>(null)
  const contentY = useRef(0)
  const topsRef = useRef<Partial<Record<SectionId, number>>>({})
  const versionsTop = useRef(0)
  const lockRef = useRef<{ target: number; until: number } | null>(null)

  const topInset = insets.top || SP_STATUS_BAR
  const barHeight = topInset + SP_BAR_CONTENT
  const coverSize = Math.round(Math.min(windowWidth, 480) * 0.58)
  const coverTop = barHeight + HERO_GAP
  const coverBottom = coverTop + coverSize

  const scrollY = useSharedValue(0)
  const stripY = useSharedValue(0)
  const [titleH, setTitleH] = useState(36)
  const [textH, setTextH] = useState(150)
  const marks = useSharedValue<BarMarks>({
    barHeight,
    coverTop,
    coverBottom,
    titleBottom: coverBottom + SP_HERO_TEXT_TOP + 36,
    playTop: coverBottom + 150 + SP_PLAY_TOP,
    playBottom: coverBottom + 150 + SP_PLAY_TOP + SP_PLAY_SIZE,
  })
  useEffect(() => {
    marks.value = {
      barHeight,
      coverTop,
      coverBottom,
      titleBottom: coverBottom + SP_HERO_TEXT_TOP + titleH,
      playTop: coverBottom + textH + SP_PLAY_TOP,
      playBottom: coverBottom + textH + SP_PLAY_TOP + SP_PLAY_SIZE,
    }
  }, [marks, barHeight, coverTop, coverBottom, titleH, textH])

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
  })
  // the pinned strip: its place in the content, never higher than under the bar (UI thread)
  const stripStyle = useAnimatedStyle(() => ({
    opacity: stripY.value > 0 ? 1 : 0,
    transform: [{ translateY: stripTop(stripY.value, scrollY.value, barHeight) }],
  }))
  const hairline = useDerivedValue(() => stripHairline(stripY.value, scrollY.value, barHeight))

  // which tab follows the reader: JS side, only when the offset moved 8px
  const syncSections = (y: number) => {
    const lock = lockRef.current
    if (lock) {
      if (Date.now() > lock.until || Math.abs(y - lock.target) < 2) lockRef.current = null
      else return
    }
    const stripHeight = SP_TAB_HEIGHT + barHeight
    // past the last section (Versions and what follows): no tab is lit
    const beyond = versionsTop.current > 0 && y + stripHeight + SECTION_GAP >= versionsTop.current
    const next = beyond
      ? null
      : activeSection({ order: sectionIds, tops: topsRef.current, scrollY: y, stripHeight, atBottom: false })
    setActive(next)
  }
  const syncRef = useRef(syncSections)
  syncRef.current = syncSections
  const syncStable = useCallback((y: number) => syncRef.current(y), [])
  useAnimatedReaction(
    () => Math.round(scrollY.value / 8),
    (bucket, previous) => {
      if (bucket !== previous) runOnJS(syncStable)(scrollY.value)
    },
  )

  const scrollToY = useCallback(
    (target: number) => {
      scrollRef.current?.scrollTo({ y: Math.max(0, target), animated: !reduce })
    },
    [reduce],
  )
  const goTo = useCallback(
    (id: SectionId) => {
      const top = topsRef.current[id]
      setActive(id)
      if (top == null) return
      const target = scrollTargetFor(top, SP_TAB_HEIGHT + barHeight)
      lockRef.current = { target, until: Date.now() + 900 }
      scrollToY(target)
    },
    [barHeight, scrollToY],
  )
  const goToVersions = useCallback(() => scrollToY(versionsTop.current - barHeight - 12), [barHeight, scrollToY])

  // `?section=chords` (from the harmonium screens) opens the page scrolled to that section, once it is laid out
  const sectionParam = routeString(params.section)
  const jumped = useRef(false)
  useEffect(() => {
    if (!sectionParam || jumped.current || !song) return
    if (!(sectionIds as string[]).includes(sectionParam)) return
    let tries = 0
    const timer = setInterval(() => {
      tries += 1
      if (topsRef.current[sectionParam as SectionId] != null) {
        jumped.current = true
        clearInterval(timer)
        goTo(sectionParam as SectionId)
      } else if (tries > 20) clearInterval(timer)
    }, 150)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionParam, song, sectionIds.join(","), goTo])

  const sectionTop = (id: SectionId) => (y: number) => {
    topsRef.current[id] = contentY.current + y
  }

  // room under the last row for the floating mini-player (and the tab bar's place, none on a pushed screen)
  const bottomInset = pageBottomInset({ safeBottom: insets.bottom, miniVisible: miniPlayerVisible({ pathname, hasSong }) })

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
  const soundingChords = chart ? uniqueChords(chart.lines.flatMap((line) => line.placements.map((p) => p.chord))) : []

  const wordRows = buildWordRows(spLines, glosses, wordShown, wordCountsMatch)

  // Prose in the chosen language counts as having it even when it does not line up with the lyric lines.
  const meaningText = meaningView.meaning.status === "ready" ? meaningView.meaning.text : null
  const meaningProse = meaningText !== null && !hasLinesIn(meaningLanguage)
  const meaningGap = translationGap && !(meaningProse && translationGap.wanted === meaningLanguage) ? translationGap : null
  const meaningRows: Array<{ label: string; text: string }> = (() => {
    if (meaningProse && meaningText) return [{ label: "", text: meaningText }]
    if (translationsUnder.length) {
      const rows: Array<{ label: string; text: string }> = []
      const count = Math.max(...translationsUnder.map((item) => item.lines.length))
      for (let li = 0; li < count; li += 1) {
        for (const item of translationsUnder) {
          const text = item.lines[li]
          if (!text) continue
          const code = lyricShortCode(item.code)
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
  const central = meaningView.centralIdea ?? demoCentralIdea(demoKey)

  const chordTokens: SpChordToken[] = (() => {
    if (!chart || !columnsAll) return []
    const out: SpChordToken[] = []
    const romanColumns = layoutChart(sources.roman, chart, showChord, Boolean(mock))
    lines.primary.forEach((_, li) => {
      const columns = columnsAll[li] ?? romanColumns[li] ?? []
      columns.forEach((column, wi) =>
        out.push({
          key: `${li}-${wi}`,
          chord: column.chord ?? "",
          word: column.word,
          swara: instrument === "harmonium" ? swaraAt(li, wi) : "",
        }),
      )
      // the prototype ends every line with a 14px break, the last one too
      out.push({ key: `br-${li}`, chord: "", word: "", swara: "", lineBreak: true })
    })
    return out
  })()

  const hint = capoHint(soundingChords, capo)
  const bestCapo = spBestCapo(soundingChords)
  // a Notation (PDF) link only where the catalog really has the file
  const notationUrl = notationPdfUrl(song.notationSourceUrl)
  const notationLink = notationUrl ? { label: "Notation (PDF)", url: notationUrl } : null
  // sample "more videos" exist only in the demo; a real song never gets them
  const watchMore = mock
    ? FIXTURE_MORE_VIDEOS.map((video) => ({
        ...video,
        go: () => showToast("Video plays here"),
      }))
    : []

  const coverTint = tintForSong(song.number)
  // top colour of the hero wash; the bar's ground is the same colour so the two read as one
  const washTop = mixHex(t.sand200, coverTint, t.dark ? 0.5 : 0.3)
  const metaText = metaLine({
    seconds: knownSeconds({ versionLength: selectedVersion?.length ?? null, songSeconds: song.durationSeconds, demo: Boolean(mock) }),
    versionCount: versions.length,
    languages: languageParts(song.language, scripts),
  })
  const openKaraoke = () => {
    // The Player opens on its word-by-word view. Nothing starts to play here: the song is only put in it.
    if (!isCurrent) {
      if (mock) {
        usePlayerStore.getState().loadSong(playable(selectedVersion), queue, "default")
        pause()
      } else {
        syncCurrentSong(song, queue)
      }
    }
    router.push(href(NAV_V2_PLAYER_ROUTE))
  }
  const listed = versionOrder(versions)

  return (
    <View style={[styles.root, { backgroundColor: t.sand200 }]}>
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentContainerStyle={{ paddingBottom: bottomInset }}
      >
        <View style={{ paddingTop: coverTop }}>
          <SpHeroWash top={washTop} page={t.sand200} />
          <Reveal index={0}>
            <SpHeroCover songNumber={song.number} size={coverSize} scrollY={scrollY} radius={spRadius.lg} onLayout={() => undefined} />
          </Reveal>
          <Reveal index={1}>
            <View onLayout={(event: LayoutChangeEvent) => setTextH(Math.round(event.nativeEvent.layout.height))}>
              <SpHeroText
                t={t}
                title={song.title}
                collectionLine={psLine(song.number)}
                performer={performerName}
                meta={metaText}
                onPerformer={goToVersions}
                onMeta={goToVersions}
                onTitleLayout={(event) => setTitleH(Math.round(event.nativeEvent.layout.height))}
              />
            </View>
          </Reveal>
          <Reveal index={2}>
            <SpActionRow
              t={t}
              saveItem={saveItem}
              downloadItem={downloadItem}
              onPlaylist={openPlaylist}
              onShare={() => setSheet("share")}
              onMore={() => setSheet("actions")}
              playing={showPause}
              onPlay={handlePlay}
            />
            <View style={styles.learn}>
              <SpPill
                t={t}
                label={learning ? "Learning this song" : "Learn this song"}
                variant={learning ? "peach" : "sand"}
                icon={learning ? "check" : "plusThin"}
                onPress={handleLearn}
              />
            </View>
          </Reveal>
          <Reveal index={3}>
            <SpLyricsCard
              t={t}
              tint={coverTint}
              lines={previewLines(lines.primary)}
              script={lines.primaryScript}
              onPress={openKaraoke}
            />
          </Reveal>
        </View>

        {/* where the tab strip rests; the strip itself is drawn over the page (it pins under the bar) */}
        <View
          style={{ height: SP_TAB_HEIGHT, marginTop: 16 }}
          onLayout={(event) => {
            stripY.value = event.nativeEvent.layout.y
          }}
        />

        <View
          onLayout={(event) => {
            contentY.current = event.nativeEvent.layout.y
          }}
        >
          <Reveal index={4}>
            <SpSectionTitle t={t} first label={SECTION_LABEL.lyrics} onLayoutY={sectionTop("lyrics")} />
            <SpTools
              t={t}
              langPill={`${PILL_SCRIPT[lines.choice]} · ${translations.length ? translationPill(translations) : "No translation"}`}
              chordsAvailable={Boolean(chart)}
              chordsOn={chordsOn}
              onLang={() => setLangOpen(true)}
              onChords={() => settings().setChordsOn(!chordsOn)}
            />
            {meaningGap ? (
              <View style={styles.lyricGap}>
                <SpGapNote
                  t={t}
                  text={gapNotice(meaningGap)}
                  requested={requested.includes(meaningGap.wanted)}
                  onRequest={() => requestLanguage(meaningGap.wanted)}
                />
              </View>
            ) : null}
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

            {mock ? <SpDemoTag t={t} /> : null}

            <SpSectionTitle t={t} label={SECTION_LABEL.words} onLayoutY={sectionTop("words")} />
            {!glosses ? (
              <SpEmptyNote
                t={t}
                text={EMPTY_TEXT.words}
                requested={askedContent("words")}
                onRequest={() => requestContent("words")}
              />
            ) : (
              <>
                <SpWords
                  t={t}
                  rows={wordRows}
                  script={lines.primaryScript}
                  note=""
                  languages={LYRIC_LANGUAGES.map((language) => ({
                    code: language.code,
                    label: language.native,
                    accessibilityLabel: lyricLanguageTitle(language.code),
                  }))}
                  activeLanguages={[wordLanguage]}
                  onLanguage={(code) => settings().setWordLanguage(code)}
                  gap={
                    wordPick.gap
                      ? {
                          text: gapNotice(wordPick),
                          requested: requested.includes(wordLanguage),
                          onRequest: () => requestLanguage(wordLanguage),
                        }
                      : null
                  }
                />
              </>
            )}

            <SpSectionTitle t={t} label={SECTION_LABEL.meaning} onLayoutY={sectionTop("meaning")} />
            <SpMeaning
              t={t}
              central={central}
              rows={meaningRows}
              gap={
                meaningGap
                  ? {
                      text: gapNotice(meaningGap),
                      requested: requested.includes(meaningGap.wanted),
                      onRequest: () => requestLanguage(meaningGap.wanted),
                    }
                  : null
              }
            />

            {explanation ? (
              <>
                <SpSectionTitle t={t} label={SECTION_LABEL.explain} onLayoutY={sectionTop("explain")} />
                <SpExplain t={t} explanation={explanation} onAsk={askAbout} />
              </>
            ) : null}

            <SpSectionTitle t={t} label={SECTION_LABEL.chords} onLayoutY={sectionTop("chords")} />
            {!chart ? (
              <SpEmptyNote
                t={t}
                text={EMPTY_TEXT.chords}
                requested={askedContent("chords")}
                onRequest={() => requestContent("chords")}
                link={notationLink}
              />
            ) : (
              <>
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
            )}

            <SpSectionTitle t={t} label={SECTION_LABEL.watch} onLayoutY={sectionTop("watch")} />
            {hasRealVideo ? (
              <SpCard t={t}>
                {videos.map((video) => (
                  <WatchVideoCard key={video.id} video={video} songNumber={song.number} />
                ))}
              </SpCard>
            ) : !mock ? (
              <SpEmptyNote t={t} text={EMPTY_TEXT.video} />
            ) : (
              <SpWatch
                t={t}
                title={song.title}
                poster={
                  <ExpoImage
                    source={POSTER}
                    style={[StyleSheet.absoluteFill, { opacity: 0.8 }]}
                    contentFit="cover"
                    contentPosition={{ left: "50%", top: "12%" }}
                  />
                }
                onPlay={() => showToast("Video plays here")}
                more={watchMore}
              />
            )}
          </Reveal>
        </View>

        {/* Versions: the other recordings of this song; the one in the player is orange with the equalizer */}
        <View onLayout={(event) => (versionsTop.current = event.nativeEvent.layout.y)}>
          <SpSectionTitle t={t} label="Versions" />
          {listed.map((index) => {
            const version = versions[index]!
            const here = playingIndex === index
            return (
              <SpVersionRow
                key={version.id}
                t={t}
                songNumber={song.number}
                version={version}
                current={here}
                playing={here && showPause}
                onPlay={() => pickVersion(version)}
                onMore={() => setVersionsOpen(true)}
              />
            )
          })}
          {!versions.length ? (
            <Text style={[styles.quiet, { color: t.ink500 }]}>No recordings of this song yet.</Text>
          ) : null}
        </View>

        {about ? (
          <View style={styles.block}>
            <SpAboutCard t={t} preview={about.preview} onOpen={() => setSheet("about")} />
          </View>
        ) : null}

        <SpSectionTitle t={t} label="Credits" />
        <SpCredits t={t} rows={creditRows(performerName)} />

      </Animated.ScrollView>

      {/* pinned tab strip, over the page, under the bar */}
      <Animated.View style={[styles.strip, stripStyle]}>
        <SpTabStrip t={t} sections={sectionIds} active={active} hairline={hairline} onSelect={goTo} />
      </Animated.View>

      <SpStickyBar
        t={t}
        title={song.title}
        tint={washTop}
        scrollY={scrollY}
        marks={marks}
        topInset={topInset}
        onBack={() => (router.canGoBack() ? router.back() : router.replace(href("/v2/today")))}
        onAction={handlePlay}
        playing={showPause}
        highlight={Boolean(playing?.isCurrent)}
      />

      <SpToast t={t} message={toast} />

      <SpRecordingsSheet
        t={t}
        visible={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        versions={versions}
        selectedUrl={selectedUrl}
        onPick={pickVersion}
        downloadItem={downloadItem}
        sizeText={mock ? mockupSizeText(selectedVersion?.length ?? null) : undefined}
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
        requested={requested}
        onRequest={requestLanguage}
      />
      <ActionsSheet
        visible={sheet === "actions"}
        theme={am}
        songNumber={song.number}
        title={song.title}
        subtitle={[collection?.label, performerName].filter(Boolean).join(" · ") || `PS ${song.number}`}
        rows={actionRows}
        onAction={onAction}
        onClose={() => setSheet(null)}
      />
      <ShareSheet
        visible={sheet === "share"}
        theme={am}
        songNumber={song.number}
        title={song.title}
        performer={performerName}
        lyrics={song.lyrics}
        lyricsDevanagari={song.lyricsDevanagari}
        onShare={onShareTarget}
        onClose={() => setSheet(null)}
      />
      <AboutSheet
        visible={sheet === "about"}
        theme={am}
        songTitle={song.title}
        about={about}
        onOpenSong={() => setSheet(null)}
        showOpenSong={false}
        onClose={() => setSheet(null)}
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
  // web: the prototype sets -webkit-font-smoothing: antialiased on the whole app (thinner light-on-dark text)
  root: { flex: 1, ...({ WebkitFontSmoothing: "antialiased" } as object) },
  centered: { alignItems: "center", justifyContent: "center", gap: 16 },
  strip: { position: "absolute", top: 0, left: 0, right: 0, height: SP_TAB_HEIGHT, zIndex: 30 },
  learn: { marginHorizontal: 10, marginTop: 14 },
  block: { marginTop: 36 },
  quiet: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22, paddingHorizontal: 20 },
  cardGap: { marginTop: 10 },
  lyricGap: { paddingHorizontal: 20 },
})

/**
 * The route. Real builds show variant B ("Pages"). In the preview (MOCKUP_DATA) a small switcher picks A, B, C or the
 * current page; the choice is saved (store key `song-page-variant`) and `?variant=a|b|c|current` sets it.
 */
export default function SongPageV2() {
  const { variant, pick } = useResolvedVariant()
  if (variant === "current") {
    return (
      <>
        <CurrentSongPage />
        <VariantSwitcher variant={variant} onPick={pick} />
      </>
    )
  }
  return <SongPageVariants variant={variant} onPick={pick} />
}
