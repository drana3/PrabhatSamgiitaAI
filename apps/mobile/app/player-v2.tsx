import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useRouter } from "expo-router"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AboutCard, AboutSheet } from "@/components/player-v2/AboutSong"
import { ActionsSheet } from "@/components/player-v2/ActionsSheet"
import { CrossfadeGradient } from "@/components/player-v2/CrossfadeGradient"
import { DriveControls } from "@/components/player-v2/DriveControls"
import { EmptyPlayer, type EmptyAction } from "@/components/player-v2/EmptyPlayer"
import { LyricsOptionsSheet } from "@/components/player-v2/LyricsOptionsSheet"
import { LyricsPanel } from "@/components/player-v2/LyricsPanel"
import { PlaybackSheet } from "@/components/player-v2/PlaybackSheet"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { PlayerToast, usePlayerToast } from "@/components/player-v2/PlayerToast"
import { PlaylistSheet, type PlaylistSheetRow } from "@/components/player-v2/PlaylistSheet"
import { playerColors, playerSize } from "@/components/player-v2/playerTokens"
import { QueueSheet, splitQueue, type QueueRow } from "@/components/player-v2/QueueSheet"
import { ThickScrubber, Waveform } from "@/components/player-v2/Scrubber"
import { ShareSheet } from "@/components/player-v2/ShareSheet"
import { SourceSheet } from "@/components/player-v2/SourceSheet"
import { TouchButton } from "@/components/player-v2/TouchButton"
import { TransportRow } from "@/components/player-v2/TransportRow"
import { PlayModeToggle, VersionChip } from "@/components/player-v2/VersionControls"
import { demoDownloadKey, demoDownloadSize, useDemoDownloads } from "@/lib/playerV2/demoDownloads"
import { VersionsSheet } from "@/components/player-v2/VersionsSheet"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { allCollections } from "@/data/collections"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { sampleGloss, sampleRussianLines } from "@/lib/fixtures/player"
import { DEMO_LINE_SECONDS, demoSeconds, demoTitle } from "@/lib/fixtures/playerDemo"
import { mockupSong } from "@/lib/fixtures/songMockup"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { catalogSongsByNumbers } from "@/lib/lyricSearch"
import { hasPlayableAudio, playableAudioCount, playableNumbersList, randomPlayableSongNumber } from "@/lib/playableAudio"
import { hydratePlayableSong } from "@/lib/playback/radioAdvance"
import { playlistSongNumbers, playPlaylist, starterSongForNumber } from "@/lib/playPlaylist"
import {
  activeQueue,
  canGoNext,
  goNext,
  goPrevious,
  playNumber,
  playVersion,
} from "@/lib/playerV2/controller"
import {
  activeLineIndex,
  activeWordIndex,
  alignTranslation,
  buildLyricLines,
  lineTimings,
  seekTargetForLine,
  sentenceCaseLine,
  splitLines,
  splitWords,
} from "@/lib/playerV2/lyricsSync"
import { hexAlpha, tintForSong } from "@/lib/playerV2/coverTint"
import {
  aboutContent,
  buildActionRows,
  collectionForSong,
  queueAddMessage,
  repeatMessage,
  REPORT_THANKS,
  type ActionId,
} from "@/lib/playerV2/playerActions"
import { runShare } from "@/lib/playerV2/playerActionsIO"
import { buildSharePayload, shareToast, type ShareTargetId } from "@/lib/playerV2/playerShare"
import { formatRate, nextRate } from "@/lib/playerV2/playbackSpeed"
import { sourceLabel } from "@/lib/playerV2/queueOps"
import { realControllerDeps, realQueueActions, startPlayerV2Services } from "@/lib/playerV2/services"
import { nextSleepStep, sleepLabel, sleepToast } from "@/lib/playerV2/sleepTimer"
import {
  activeSourceKey,
  MINE_SOURCE_ID,
  sourcePickedMessage,
  sourceRows,
  startNumber,
  type SourceKey,
} from "@/lib/playerV2/sources"
import { knownDuration, playButtonState } from "@/lib/playerV2/transportState"
import { effectivePlayMode, versionPositionLabel } from "@/lib/playerV2/versionMode"
import { selectedVersionIndex, versionsFromSong, versionSummary } from "@/lib/playerV2/versions"
import { readTodayCache } from "@/lib/todayCache"
import { todayItemToMockSong } from "@/lib/today"
import { recentPlayToSong } from "@/lib/todayView"
import { offlineRecordingState, useOfflineAudioStore } from "@/lib/offlineAudio"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePlayerV2Store } from "@/stores/playerV2Store"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useResumeStore } from "@/stores/resumeStore"
import { resumePositionFor } from "@/lib/playerV2/resume"
import type { MockSong } from "@/data/mock"
import { href } from "@/utils/href"

type SheetName = null | "versions" | "queue" | "lyrics" | "playback" | "source" | "playlist" | "actions" | "share" | "about"

/** The photograph of Shrii Shrii Anandamurti used by the design (public/mockup/img/c21a6e97...jpg). */
const PLAYER_PHOTO = require("../assets/player-baba.jpg")

/**
 * Player (prototype PLAYER, Main.dc.html). Dark forest ground in both themes, the
 * photograph fading in from the top, the playing-from header, version chip and
 * title, the "Play: This version | All N versions" switch, the word-by-word
 * karaoke card, the waveform, the transport and the utility bar; Drive mode swaps
 * the lyrics and transport for big controls. One audio engine: this screen only
 * renders playerStore state and sends commands to it.
 */
export default function PlayerV2Screen() {
  const router = useRouter()
  const theme = useAmTheme()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const toast = usePlayerToast()

  useEffect(() => {
    startPlayerV2Services()
  }, [])

  const song = usePlayerStore((s) => s.currentSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isBuffering = usePlayerStore((s) => s.isBuffering)
  const audioError = usePlayerStore((s) => s.audioError)
  const position = usePlayerStore((s) => s.position)
  const duration = usePlayerStore((s) => s.duration)
  const rate = usePlayerStore((s) => s.rate)
  const legacyRepeat = usePlayerStore((s) => s.repeat)
  const queue = usePlayerStore((s) => s.queue)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const playlistBounds = usePlayerStore((s) => s.playlistBounds)
  const activePlaylist = usePlayerStore((s) => s.activePlaylist)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const play = usePlayerStore((s) => s.play)
  const seekTo = usePlayerStore((s) => s.seekTo)
  const setRate = usePlayerStore((s) => s.setRate)
  const toggleLegacyRepeat = usePlayerStore((s) => s.toggleRepeat)
  const storeNext = usePlayerStore((s) => s.next)
  const storePrevious = usePlayerStore((s) => s.previous)

  const v2 = usePlayerV2Store()
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const toggleSaved = usePreferencesStore((s) => s.toggleSaved)
  const recentPlays = usePreferencesStore((s) => s.recentPlays)
  const resumeEntries = useResumeStore((s) => s.entries)
  const playlists = usePlaylistStore((s) => s.playlists)
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist)
  const addSong = usePlaylistStore((s) => s.addSong)
  const removeSong = usePlaylistStore((s) => s.removeSong)
  const flushPlaylists = usePlaylistStore((s) => s.flushSync)
  const authMode = useAuthStore((s) => s.mode)
  const offlineFiles = useOfflineAudioStore((s) => s.files)
  const offlineProgress = useOfflineAudioStore((s) => s.progress)
  const offlineErrors = useOfflineAudioStore((s) => s.errors)
  const offlineActive = useOfflineAudioStore((s) => s.activeBySong)
  const downloadAudio = useOfflineAudioStore((s) => s.download)
  const removeAudio = useOfflineAudioStore((s) => s.remove)
  const stopIfPlayingLocalUri = usePlayerStore((s) => s.stopIfPlayingLocalUri)

  const [sheet, setSheet] = useState<SheetName>(null)
  const [drive, setDrive] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [todaySong, setTodaySong] = useState<MockSong | null>(null)

  // The legacy repeat flag is the engine's "loop this track". Keep it in step with repeat "one".
  useEffect(() => {
    const wantOne = v2.repeatMode === "one"
    if (legacyRepeat !== wantOne) toggleLegacyRepeat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v2.repeatMode])

  // Sleep timer countdown label ticks once a second only while a timer runs.
  useEffect(() => {
    if (v2.sleep.kind !== "minutes") return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [v2.sleep.kind])

  // Drive mode keeps the screen awake.
  useEffect(() => {
    if (!drive) return
    void activateKeepAwakeAsync("player-v2-drive").catch(() => undefined)
    return () => {
      void deactivateKeepAwake("player-v2-drive").catch(() => undefined)
    }
  }, [drive])

  useEffect(() => {
    let alive = true
    void readTodayCache().then((cache) => {
      const first = cache?.recommendations?.[0]
      if (alive && first) setTodaySong(todayItemToMockSong(first, 0))
    })
    return () => {
      alive = false
    }
  }, [])

  const deps = useMemo(() => realControllerDeps(), [])
  const queueActions = useMemo(() => realQueueActions(), [])

  const versions = useMemo(() => (song ? versionsFromSong(song) : []), [song])
  const versionIndex = song
    ? selectedVersionIndex(versions, song.audioUrl, v2.versionByNumber[String(song.number)])
    : -1
  const selectedVersion = versions[versionIndex]
  const mode = effectivePlayMode(v2.playMode, versions.length)

  const playState = playButtonState({ isPlaying, isBuffering, audioError })
  const knownLength = knownDuration({
    duration,
    position,
    isBuffering,
    placeholder: song?.durationSeconds,
  })

  // Lyrics
  const romanLines = useMemo(() => splitLines(song?.lyrics).map(sentenceCaseLine), [song?.lyrics])
  const devanagariLines = useMemo(() => splitLines(song?.lyricsDevanagari), [song?.lyricsDevanagari])
  const useDevanagari = v2.script === "devanagari" && devanagariLines.length > 0
  const scriptLines = useDevanagari ? devanagariLines : romanLines

  const englishLines = useMemo(() => alignTranslation(scriptLines, song?.translation), [scriptLines, song?.translation])
  // TODO(api): Russian translations and word glosses come from lib/fixtures/player.ts until the catalog has them.
  const russianLines = useMemo(
    () => (song ? sampleRussianLines(song.number, scriptLines.length) : null),
    [song, scriptLines.length],
  )
  const translationLines = v2.translation === "en" ? englishLines : v2.translation === "ru" ? russianLines : null
  const showTranslation = translationLines != null
  const hasTranslation = v2.translation === "en" ? englishLines != null : russianLines != null

  const glosses = useMemo(() => {
    const rows = scriptLines.map((line, i) => {
      const roman = splitWords(romanLines[i] ?? "")
      const words = splitWords(line)
      // Devanagari shows the gloss of the Roman word in the same position.
      const source = useDevanagari && roman.length === words.length ? roman : words
      return source.map((word) => sampleGloss(word))
    })
    return rows.some((row) => row.some(Boolean)) ? rows : null
  }, [scriptLines, romanLines, useDevanagari])
  const showGloss = v2.wordMeanings && glosses != null

  const lyricLines = useMemo(
    () => buildLyricLines(scriptLines, translationLines, showGloss ? glosses : null),
    [scriptLines, translationLines, glosses, showGloss],
  )
  // The prototype steps the karaoke highlight one line every 7 seconds and loops, so the preview does the same.
  const timings = useMemo(
    () =>
      MOCKUP_DATA
        ? scriptLines.map((_, i) => ({ start: i * DEMO_LINE_SECONDS, end: (i + 1) * DEMO_LINE_SECONDS }))
        : lineTimings(scriptLines, knownLength ?? 0),
    [scriptLines, knownLength],
  )
  const loopSlot = Math.floor(position / DEMO_LINE_SECONDS)
  const activeLine =
    MOCKUP_DATA && scriptLines.length ? loopSlot % scriptLines.length : activeLineIndex(timings, position)
  const activeWord =
    activeLine < 0
      ? -1
      : activeWordIndex(
          splitWords(scriptLines[activeLine] ?? ""),
          MOCKUP_DATA
            ? { start: loopSlot * DEMO_LINE_SECONDS, end: (loopSlot + 1) * DEMO_LINE_SECONDS }
            : timings[activeLine]!,
          position,
        )

  const playableOrUnknown = useCallback((n: number) => hasPlayableAudio(n), [])

  const savedNumbers = useMemo(() => {
    const set = new Set<number>()
    for (const id of savedSongIds) {
      const n = Number(/^ps-(\d+)$/i.exec(id)?.[1])
      if (Number.isFinite(n) && n > 0) set.add(n)
    }
    return set
  }, [savedSongIds])
  const isSaved = song ? savedSongIds.includes(song.id) : false

  const list = song
    ? activeQueue({ currentSong: song, queue, playbackMode, playlistBounds, position })
    : queue
  const queueRows: QueueRow[] = useMemo(() => {
    if (sheet !== "queue") return []
    // Only the rows the sheet will draw look up a title; a long catalog list keeps cheap placeholders after them.
    const { head, upcoming } = splitQueue(list.map((number) => ({ number })), song?.number ?? null)
    const shown = [...head, ...upcoming].map((r) => r.number)
    const titles = new Map(
      MOCKUP_DATA
        ? shown.flatMap((n) => (demoTitle(n) ? ([[n, demoTitle(n)!]] as Array<[number, string]>) : []))
        : catalogSongsByNumbers(shown, shown.length).map((hit) => [hit.number, hit.firstLine || hit.title] as [number, string]),
    )
    return list.map((number) => ({
      key: `ps-${number}`,
      number,
      title: sentenceCaseLine(titles.get(number) ?? `Prabhat Samgiita ${number}`),
      seconds: MOCKUP_DATA ? demoSeconds(number) : undefined,
    }))
  }, [sheet, list, song?.number])
  const source = sourceLabel({ playbackMode, playlistName: activePlaylist?.name ?? null })

  // Offline state of the selected version, for the Download pill in the Versions sheet.
  const offline = offlineRecordingState(
    selectedVersion?.url,
    { files: offlineFiles, progress: offlineProgress, errors: offlineErrors, activeBySong: offlineActive },
    { songNumber: song?.number },
  )
  const demoKey = song ? demoDownloadKey(song.number, versionIndex) : ""
  const demoDone = useDemoDownloads((d) => d.done[demoKey] === true)
  const demoProgress = useDemoDownloads((d) => d.progress[demoKey])
  const downloadPill = !song || !selectedVersion
    ? null
    : MOCKUP_DATA
      ? {
          label: demoDone
            ? "Downloaded"
            : demoProgress !== undefined
              ? `Downloading ${Math.round(demoProgress * 100)}%`
              : `Download · ${demoDownloadSize(selectedVersion.lengthSeconds ?? 0)}`,
          done: demoDone,
          tone: demoDone ? ("brand" as const) : ("ink" as const),
          disabled: demoProgress !== undefined,
          onPress: () => {
            if (useDemoDownloads.getState().toggle(demoKey) === "removed") toast.show("Removed from this phone")
          },
        }
    : authMode !== "signed_in"
      ? { label: "Sign in to download", disabled: false, onPress: () => router.push(href("/signin")) }
      : offline.downloading
        ? {
            label: `Downloading ${Math.round((offline.progress ?? 0) * 100)}%`,
            disabled: true,
            onPress: () => undefined,
          }
        : offline.downloaded
          ? {
              label: "Downloaded · tap to remove",
              done: true,
              disabled: false,
              onPress: () => {
                void removeAudio(offline.key).then(() => stopIfPlayingLocalUri(offline.fileUri))
              },
            }
          : {
              label: "Download",
              disabled: false,
              onPress: () => {
                void downloadAudio(selectedVersion.url, song.number, { userInitiated: true }).catch(() => undefined)
              },
            }

  // Actions
  const onPlayPause = () => {
    if (playState === "error") play()
    else togglePlay()
  }
  const onNext = () => {
    if (!goNext(deps)) storeNext()
  }
  const onPrevious = () => {
    if (!goPrevious(deps)) storePrevious()
  }
  const onRepeat = () => {
    const next = v2.cycleRepeat()
    toast.show(repeatMessage(next, source))
  }
  const onShuffle = () => {
    queueActions.toggleShuffle()
  }
  /** `silent`: the row in the More sheet changes its own label, so no toast over the sheet. */
  const onFavourite = (silent = false) => {
    if (!song) return
    const wasSaved = isSaved
    void toggleSaved(song.id).then((result) => {
      if (result.needsAuth) {
        setSheet(null)
        router.push(href("/signin"))
      } else if (!silent) toast.show(wasSaved ? "Removed from Mine" : "Saved to Mine")
    })
  }
  const onSeekLine = (index: number) => {
    const target = seekTargetForLine(timings, index)
    if (target != null) seekTo(target)
  }
  const onPlayMode = (next: "this" | "all") => {
    v2.setPlayMode(next)
    toast.show(next === "this" ? "Playing this version only" : `Playing all ${versions.length} versions in a row`)
  }

  // Lyrics display: each row steps through its options.
  const onCycleScript = () => v2.setScript(v2.script === "roman" ? "devanagari" : "roman")
  const onCycleTranslation = () => v2.setTranslation(v2.translation === "en" ? "ru" : v2.translation === "ru" ? "off" : "en")

  // Play songs from
  const sourceChoices = useMemo(
    () =>
      sourceRows({
        catalogCount: playableAudioCount() || 5018,
        savedCount: savedNumbers.size,
        playlists: playlists.map((p) => ({ id: p.id, name: p.name, count: p.songs.length })),
      }),
    [savedNumbers.size, playlists],
  )
  const onPickSource = (key: SourceKey) => {
    setSheet(null)
    const current = song?.number ?? null
    if (key === "all") {
      const numbers = [...playableNumbersList()]
      const first = startNumber(numbers, current, hasPlayableAudio)
      if (first == null) return toast.show(sourcePickedMessage("All songs", 0))
      usePlayerStore.setState({ activePlaylist: null })
      usePlayerStore.getState().loadSong(starterSongForNumber(first), numbers, "default")
      return toast.show(sourcePickedMessage("All songs", numbers.length))
    }
    if (key === "mine") {
      const numbers = [...savedNumbers].sort((a, b) => a - b)
      const first = startNumber(numbers, current, hasPlayableAudio)
      if (first == null) return toast.show(sourcePickedMessage("Mine", 0))
      usePlayerStore.setState({ activePlaylist: { id: MINE_SOURCE_ID, name: "Mine" } })
      usePlayerStore.getState().loadSong(starterSongForNumber(first), numbers, "playlist")
      return toast.show(sourcePickedMessage("Mine", numbers.length))
    }
    const playlist = playlists.find((p) => `pl:${p.id}` === key)
    if (!playlist) return
    const count = playlistSongNumbers(playlist).length
    void playPlaylist(playlist)
    toast.show(sourcePickedMessage(playlist.name, count))
  }

  // Add to playlist, in place
  const playlistRows: PlaylistSheetRow[] = playlists.map((p) => ({
    id: p.id,
    name: p.name,
    meta: `${p.songs.length} ${p.songs.length === 1 ? "song" : "songs"}`,
    has: song ? playlistSongNumbers(p).includes(song.number) : false,
  }))
  const reportPlaylistFailure = (result: unknown) => {
    if (result && typeof result === "object" && "needsAuth" in result) {
      setSheet(null)
      router.push(href("/signin"))
    } else if (result && typeof result === "object" && "error" in result) {
      Alert.alert("Playlist", String((result as { error: string }).error))
    }
  }
  const onTogglePlaylist = (id: string, has: boolean) => {
    if (!song) return
    const name = playlists.find((p) => p.id === id)?.name ?? "playlist"
    void (has ? removeSong(id, song.number) : addSong(id, song.number)).then((result) => {
      if (!isPlaylist(result)) return reportPlaylistFailure(result)
      toast.show(has ? `Removed from ${name}` : `Saved to ${name}`)
      void flushPlaylists()
    })
  }
  const onNewPlaylist = () => {
    if (!song) return
    const name = `Playlist ${playlists.length + 1}`
    void createPlaylist(name).then((created) => {
      if (!isPlaylist(created)) return reportPlaylistFailure(created)
      void addSong(created.id, song.number).then((result) => {
        if (!isPlaylist(result)) return reportPlaylistFailure(result)
        toast.show(`Created ${name}`)
        void flushPlaylists()
      })
    })
  }

  // Empty state data
  const continuePlay = recentPlays[0]
  const continueSong = continuePlay ? recentPlayToSong(continuePlay) : null
  const emptyContinue = continueSong
    ? {
        id: "continue",
        title: continueSong.title,
        resumeSeconds: resumePositionFor(resumeEntries[String(continueSong.number)]),
        onPress: () => usePlayerStore.getState().playOrToggle(continueSong, [continueSong.number]),
      }
    : null
  const emptyToday: EmptyAction = {
    id: "today",
    title: "Play today's song",
    hint: todaySong ? todaySong.title : "Waiting for today's song",
    disabled: !todaySong,
    onPress: () => todaySong && usePlayerStore.getState().playOrToggle(todaySong, [todaySong.number]),
  }
  const emptyRandom: EmptyAction = {
    id: "random",
    title: "Play random",
    hint: "A song with audio, chosen for you",
    onPress: () => {
      const number = randomPlayableSongNumber(0)
      void hydratePlayableSong(number).then((picked) => {
        if (picked) usePlayerStore.getState().loadSong(picked, [number], "default")
      })
    },
  }
  const emptyPlaylists: EmptyAction[] = playlists.slice(0, 3).map((p) => ({
    id: p.id,
    title: p.name,
    hint: `${playlistSongNumbers(p).length} songs`,
    onPress: () => void playPlaylist(p),
  }))

  const sleepValue = v2.sleep.kind === "off" ? "Off" : sleepLabel(v2.sleep, now)

  // More actions, Share and About this song
  const songTitle = sentenceCaseLine(song?.title ?? "")
  const collection = useMemo(() => (song ? collectionForSong(song.number, allCollections) : null), [song])
  const performer = selectedVersion?.performer ?? song?.performer ?? ""
  const actionRows = useMemo(
    () =>
      buildActionRows({
        saved: isSaved,
        inQueue: song ? list.includes(song.number) : false,
        collectionName: collection?.label ?? null,
        speedText: formatRate(rate).replace("x", "×"),
        sleepText: sleepValue,
      }),
    [isSaved, song, list, collection, rate, sleepValue],
  )
  const sharePayload = useMemo(
    () => (song ? buildSharePayload({ number: song.number, title: songTitle, performer }) : null),
    [song, songTitle, performer],
  )
  // TODO(api): the story text comes from the song's central idea; the prototype's sample text stands in
  // while MOCKUP_DATA is on (its "Placeholder." lines are skipped).
  const about = useMemo(() => {
    if (!song) return null
    const sample = MOCKUP_DATA ? mockupSong(song.number)?.centralIdea : null
    return aboutContent(song, sample && !/^placeholder/i.test(sample) ? sample : null)
  }, [song])
  const showAbout = about != null && !drive && windowHeight >= 740
  const openSongPage = () => {
    if (!song) return
    setSheet(null)
    router.push(href(`/song-v2/ps-${song.number}`))
  }
  const onAction = (id: ActionId) => {
    if (!song) return
    switch (id) {
      case "share":
        return setSheet("share")
      case "save":
        return onFavourite(true)
      case "playlist":
        return setSheet("playlist")
      case "queue": {
        const there = list.includes(song.number)
        if (!there) queueActions.add(song.number)
        setSheet(null)
        return toast.show(queueAddMessage(there))
      }
      case "goQueue":
        return setSheet("queue")
      case "songPage":
        return openSongPage()
      case "collection": {
        setSheet(null)
        const label = collection?.label
        return router.push(
          href(label ? `/songs-v2-collection?id=${encodeURIComponent(label)}&title=${encodeURIComponent(label)}` : "/songs-v2-index"),
        )
      }
      case "playback":
        return setSheet("playback")
      case "report":
        // TODO(api): send the report (song number, version, text) to the catalog team. Nothing leaves the phone yet.
        setSheet(null)
        return toast.show(REPORT_THANKS)
    }
  }
  const onShareTarget = (target: ShareTargetId) => {
    if (!sharePayload) return
    void runShare(target, sharePayload).then((outcome) => {
      const message = shareToast(outcome)
      // A copied link closes the sheet, so the toast rises over the Player and not over the buttons.
      if (message) {
        setSheet(null)
        toast.show(message)
      }
    })
  }
  const coverTint = tintForSong(song?.number ?? null)
  const canAdvance = canGoNext(deps) || playbackMode === "random"
  const sourceKey = activeSourceKey(playbackMode, activePlaylist?.id)

  return (
    <View style={[styles.root, { backgroundColor: playerColors.ground }]}>
      <Image
        source={PLAYER_PHOTO}
        style={styles.photo}
        contentFit="cover"
        contentPosition="top"
        accessibilityLabel="Shrii Shrii Anandamurti"
      />
      <LinearGradient
        pointerEvents="none"
        colors={[playerColors.fadeTop, playerColors.fadeMid, playerColors.ground]}
        locations={[0, 0.46, 0.82]}
        style={styles.photo}
      />

      <CrossfadeGradient
        colors={[hexAlpha(coverTint, 0.42), hexAlpha(coverTint, 0.3), hexAlpha(coverTint, 0.26)]}
        locations={[0, 0.5, 1]}
        duration={400}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.column, { paddingTop: insets.top || playerSize.topBand, paddingBottom: playerSize.tabBarClearance }]}>
        <Reveal index={0}>
          <View style={styles.topBar}>
            <TouchButton
              accessibilityRole="button"
              accessibilityLabel={`${drive ? "Drive mode" : `Playing from ${source}`}. Change`}
              onAction={() => setSheet("source")}
              containerStyle={styles.sourceHit}
              style={styles.sourceChip}
            >
              <Text style={styles.sourceText} numberOfLines={1}>
                {drive ? "Drive mode" : `Playing from ${source}`}
              </Text>
              <PlayerIcon name="chevronDown" size={playerSize.chevron} color={amColors.white} />
            </TouchButton>
            {song ? (
              <View style={styles.topActions}>
                {!drive ? (
                  <TouchButton
                    accessibilityRole="button"
                    accessibilityLabel="Lyrics display: script, translation, word meanings"
                    onAction={() => setSheet("lyrics")}
                    style={styles.aaButton}
                  >
                    <PlayerIcon name="aa" size={playerSize.topIcon} color={amColors.white} />
                  </TouchButton>
                ) : null}
                <TouchButton
                  accessibilityRole="button"
                  accessibilityLabel="More actions: share, save, add to playlist, queue, song page"
                  onAction={() => setSheet("actions")}
                  style={styles.aaButton}
                >
                  <PlayerIcon name="more" size={playerSize.topIcon} color={amColors.white} />
                </TouchButton>
              </View>
            ) : null}
          </View>
        </Reveal>

        {!song ? (
          <Reveal index={1} style={[styles.flex, styles.emptyPad]}>
            <EmptyPlayer
              title={"Nothing\nplaying"}
              continueCard={emptyContinue}
              today={emptyToday}
              random={emptyRandom}
              playlists={emptyPlaylists}
            />
          </Reveal>
        ) : (
          <>
            <Reveal index={1}>
              <View style={styles.titleBlock}>
                {selectedVersion ? (
                  <VersionChip
                    songNumber={song.number}
                    summary={versionSummary(selectedVersion)}
                    position={versionPositionLabel(mode, versionIndex, versions.length)}
                    onPress={() => setSheet("versions")}
                  />
                ) : (
                  <Text style={styles.noAudio}>PS {song.number} · No recording available yet</Text>
                )}
                <Text style={styles.title} accessibilityRole="header">
                  {song.title}
                </Text>
              </View>
              <PlayModeToggle mode={mode} versionCount={versions.length} onChange={onPlayMode} />
            </Reveal>

            {drive ? (
              <>
                <View style={styles.driveSpace} />
                <Reveal index={2}>
                  <ThickScrubber position={position} duration={knownLength} onSeek={seekTo} />
                </Reveal>
                <Reveal index={3}>
                  <View style={styles.driveControls}>
                    <DriveControls
                      playState={playState}
                      canNext={canAdvance}
                      onPlayPause={onPlayPause}
                      onPrevious={onPrevious}
                      onNext={onNext}
                      onExit={() => setDrive(false)}
                    />
                  </View>
                </Reveal>
              </>
            ) : (
              <>
                <Reveal index={2} style={styles.flex}>
                  <LyricsPanel
                    lines={lyricLines}
                    devanagari={useDevanagari}
                    activeLine={activeLine}
                    activeWord={activeWord}
                    showGloss={showGloss}
                    showTranslation={showTranslation}
                    onSeekToLine={onSeekLine}
                    emptyText="Lyrics are not available for this song yet."
                  />
                </Reveal>
                <View style={styles.gap} />
                <Reveal index={3}>
                  <Waveform position={position} duration={knownLength} songNumber={song.number} onSeek={seekTo} />
                </Reveal>
                <Reveal index={4}>
                  <TransportRow
                    playState={playState}
                    shuffleOn={v2.shuffleOriginal != null}
                    repeatMode={v2.repeatMode}
                    canNext={canAdvance}
                    onPlayPause={onPlayPause}
                    onPrevious={onPrevious}
                    onNext={onNext}
                    onShuffle={onShuffle}
                    onRepeat={onRepeat}
                  />
                </Reveal>
                <Reveal index={5}>
                  <View style={styles.iconRow}>
                    <UtilButton label="Drive mode" onPress={() => setDrive(true)}>
                      <PlayerIcon name="drive" size={playerSize.utilGlyph} color={playerColors.utilIcon} />
                    </UtilButton>
                    <UtilButton label="Add to playlist" onPress={() => setSheet("playlist")}>
                      <PlayerIcon name="playlistAdd" size={playerSize.utilGlyph} color={playerColors.utilIcon} />
                    </UtilButton>
                    <UtilButton label="Queue" onPress={() => setSheet("queue")}>
                      <PlayerIcon name="queue" size={playerSize.utilGlyph} color={playerColors.utilIcon} />
                    </UtilButton>
                    <UtilButton label={isSaved ? "Remove from Mine" : "Save to Mine"} onPress={() => onFavourite()}>
                      <PlayerIcon
                        name="heart"
                        size={playerSize.utilGlyph}
                        color={isSaved ? playerColors.brand : playerColors.utilIcon}
                        filled={isSaved}
                      />
                    </UtilButton>
                    <UtilButton label="Share" onPress={() => setSheet("share")}>
                      <PlayerIcon name="share" size={playerSize.utilGlyph} color={playerColors.utilIcon} />
                    </UtilButton>
                    <UtilButton label="Playback: speed, sleep timer" onPress={() => setSheet("playback")}>
                      <PlayerIcon name="timer" size={playerSize.utilGlyph} color={playerColors.utilIcon} />
                    </UtilButton>
                  </View>
                </Reveal>
                {showAbout && about ? (
                  <Reveal index={6}>
                    <View style={styles.aboutWrap}>
                      <AboutCard preview={about.preview} onOpen={() => setSheet("about")} />
                    </View>
                  </Reveal>
                ) : null}
              </>
            )}
          </>
        )}
      </View>

      <PlayerToast message={toast.message} theme={theme} />

      <VersionsSheet
        visible={sheet === "versions"}
        theme={theme}
        versions={versions}
        selectedIndex={versionIndex}
        download={downloadPill}
        onSelect={(index) => {
          const picked = versions[index]
          if (song && picked && index !== versionIndex) playVersion(deps, song, picked)
        }}
        onClose={() => setSheet(null)}
      />
      <QueueSheet
        visible={sheet === "queue"}
        theme={theme}
        sourceTitle={source}
        rows={queueRows}
        currentNumber={song?.number ?? null}
        currentTitle={sentenceCaseLine(song?.title ?? "")}
        playing={isPlaying}
        savedNumbers={savedNumbers}
        isPlayable={playableOrUnknown}
        onPlay={(number) => {
          void playNumber(deps, number)
          setSheet(null)
        }}
        onRemove={queueActions.remove}
        onOrder={queueActions.setOrder}
        onClearUpcoming={queueActions.clearUpcoming}
        compact={MOCKUP_DATA}
        footer={{
          shuffleOn: v2.shuffleOriginal != null,
          repeat: v2.repeatMode,
          timerOn: v2.sleep.kind !== "off",
          onShuffle,
          onRepeat,
          onTimer: () => setSheet("playback"),
        }}
        onClose={() => setSheet(null)}
      />
      <LyricsOptionsSheet
        visible={sheet === "lyrics"}
        theme={theme}
        script={v2.script}
        translation={v2.translation}
        wordMeanings={v2.wordMeanings}
        hasDevanagari={devanagariLines.length > 0}
        hasTranslation={hasTranslation}
        hasWordMeanings={glosses != null}
        onCycleScript={onCycleScript}
        onCycleTranslation={onCycleTranslation}
        onToggleWordMeanings={() => v2.setWordMeanings(!v2.wordMeanings)}
        onClose={() => setSheet(null)}
      />
      <PlaybackSheet
        visible={sheet === "playback"}
        theme={theme}
        rate={rate}
        sleepValue={sleepValue}
        onCycleSpeed={() => setRate(nextRate(rate))}
        onCycleSleep={() => {
          const next = nextSleepStep(v2.sleep, song?.number ?? 0, Date.now())
          if (next.kind === "off") v2.cancelSleep()
          else if (next.kind === "minutes") v2.startSleepMinutes(next.minutes)
          else v2.startSleepEndOfSong(next.songNumber)
          toast.show(sleepToast(next))
        }}
        onDrive={() => {
          setSheet(null)
          setDrive(true)
        }}
        onClose={() => setSheet(null)}
      />
      <SourceSheet
        visible={sheet === "source"}
        theme={theme}
        rows={sourceChoices}
        activeKey={sourceKey}
        onPick={onPickSource}
        onClose={() => setSheet(null)}
      />
      <PlaylistSheet
        visible={sheet === "playlist"}
        theme={theme}
        songTitle={sentenceCaseLine(song?.title ?? "")}
        rows={playlistRows}
        onToggle={onTogglePlaylist}
        onNew={onNewPlaylist}
        onClose={() => setSheet(null)}
      />
      {song ? (
        <>
          <ActionsSheet
            visible={sheet === "actions"}
            theme={theme}
            songNumber={song.number}
            title={songTitle}
            subtitle={[collection?.label, performer].filter(Boolean).join(" · ") || `PS ${song.number}`}
            rows={actionRows}
            onAction={onAction}
            onClose={() => setSheet(null)}
          />
          <ShareSheet
            visible={sheet === "share"}
            theme={theme}
            songNumber={song.number}
            title={songTitle}
            performer={performer}
            onShare={onShareTarget}
            onClose={() => setSheet(null)}
          />
          <AboutSheet
            visible={sheet === "about"}
            theme={theme}
            songTitle={songTitle}
            about={about}
            onOpenSong={openSongPage}
            onClose={() => setSheet(null)}
          />
        </>
      ) : null}
    </View>
  )
}

function UtilButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchButton accessibilityRole="button" accessibilityLabel={label} onAction={onPress} style={styles.util}>
      {children}
    </TouchButton>
  )
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject },
  photo: { position: "absolute", top: 0, left: 0, right: 0, height: playerSize.photoHeight },
  column: { flex: 1 },
  flex: { flex: 1, minHeight: 0 },
  gap: { height: 8 },
  emptyPad: { paddingHorizontal: 20 },
  topBar: {
    height: playerSize.topBar,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: playerSize.topBarInsetLeft,
    paddingRight: playerSize.topBarInsetRight,
  },
  sourceHit: { flexShrink: 1 },
  sourceChip: { flexDirection: "row", alignItems: "center", gap: 4, height: playerSize.topButton },
  sourceText: { ...amType.label, color: amColors.white, flexShrink: 1 },
  topActions: { flexDirection: "row", alignItems: "center" },
  aboutWrap: { marginTop: 10 },
  aaButton: { width: playerSize.topButton, height: playerSize.topButton, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  titleBlock: { paddingHorizontal: 20, gap: playerSize.titleGap, marginTop: playerSize.titleLift },
  title: {
    fontFamily: amFonts.display,
    fontSize: playerSize.titleFont,
    lineHeight: playerSize.titleLine,
    letterSpacing: playerSize.titleFont * -0.02,
    textTransform: "uppercase",
    color: playerColors.text,
  },
  noAudio: { fontFamily: amFonts.bold, fontSize: 13, color: playerColors.gold },
  driveSpace: { flex: 1, minHeight: 12 },
  driveControls: { marginTop: 16 },
  iconRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, marginHorizontal: 24 },
  util: { width: playerSize.util, height: playerSize.util, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
})
