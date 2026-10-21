import { Audio } from "expo-av"
import type { Event as RntpEvent } from "react-native-track-player"
import { create } from "zustand"

import type { MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import { readAudioRepeat, writeAudioRepeat } from "@/lib/audioRepeat"
import { isSameAudioTrack, isSameSong } from "@/lib/playback"
import { resolvePlaybackUri } from "@/lib/offlineAudio"
import {
  nextQueueNumber,
  playbackAdvanceQueue,
  playlistStep,
  previousQueueNumber,
  resolvePlaybackMode,
  type PlaybackMode,
} from "@/lib/playbackQueue"
import {
  isStaleRandomWithoutDrive,
  listeningSessionFromStore,
  sessionShouldAdvanceAfterTrackEnd,
} from "@/lib/playback/listeningSession"
import {
  setPlaybackIntent,
  setSongPlaybackYield,
  setSongPlayingGuard,
} from "@/lib/audioFocus"
import { nextPlayableInQueue } from "@/lib/playableAudio"
import type { ActivePlaylistMeta } from "@/lib/playlistPlayback"
import { setCatalogPlaybackHost } from "@/lib/playback/catalogPlaybackHost"
import {
  getActiveCatalogTrackNumber,
  nativePause,
  nativePlay,
  nativeRemoveUpcomingTracks,
  nativeSeek,
  nativeSetRepeatTrack,
  nativeSetVolume,
  nativeSkipToNext,
  nativeSkipToPrevious,
  nativeStop,
  playTrackNow,
  registerNativePlayerListeners,
  setupNativeCatalogPlayer,
  songToTrack,
  trackIdToSongNumber,
} from "@/lib/playback/nativeCatalogPlayer"
import { cacheCatalogSong, getCachedCatalogSong } from "@/lib/playback/catalogSongCache"
import { ensureUpcomingRadioTrack, hydratePlayableSong } from "@/lib/playback/radioAdvance"
import {
  getTrackPlayer,
  isTrackPlayerLinked,
  loadTrackPlayerModule,
} from "@/lib/playback/trackPlayerBridge"
import { setRadioSession } from "@/lib/playback/radioSession"
import { songDetailToMockSong } from "@/lib/songMap"
import { usePreferencesStore } from "@/stores/preferencesStore"

type PlayerState = {
  currentSong: MockSong | null
  queue: number[]
  isPlaying: boolean
  position: number
  duration: number
  volume: number
  hasAudio: boolean
  audioError: string | null
  isBuffering: boolean
  repeat: boolean
  playbackMode: PlaybackMode
  playlistBounds: number[] | null
  activePlaylist: ActivePlaylistMeta | null
  driveAutoAdvance: boolean
  driveScreenFocused: boolean
  driveRepeat: boolean
  stopQueueAfterCurrentTrack: boolean
  setDriveScreenFocused: (focused: boolean) => void
  scheduleDriveBlurExit: () => void
  cancelDriveBlurExit: () => void
  noteAppBackgroundPlayback: () => void
  enterDrivePlayback: () => void
  exitDriveMode: () => void
  prepareCatalogAudioForDriveEntry: () => Promise<void>
  toggleDriveRepeat: () => void
  toggleRepeat: () => void
  loadSong: (song: MockSong, queue?: number[], playbackMode?: PlaybackMode) => void
  syncCurrentSong: (song: MockSong, queue?: number[]) => void
  warmAudio: (song?: MockSong | null) => void
  playOrToggle: (song: MockSong, queue?: number[]) => void
  setQueue: (numbers: number[]) => void
  togglePlay: () => void
  play: () => void
  reassertBackgroundPlayback: () => void
  reconcileForegroundCatalogPlayback: () => void
  pause: () => void
  /** Stop if the active track is this local file (after Remove from this app). */
  stopIfPlayingLocalUri: (fileUri: string | null | undefined) => void
  prepareForSpeechCapture: () => Promise<void>
  seekTo: (position: number) => void
  seekBy: (deltaSeconds: number) => void
  setVolume: (volume: number) => void
  adjustVolume: (delta: number) => void
  next: () => void
  previous: () => void
  clear: () => void
}

type PlayerBagExtras = {
  __psMediaCache: Map<number, MockSong>
  __psLoadGeneration: number
  __psWantPlaying: boolean
  __psRntpUnsubs: Array<{ remove: () => void }>
  __psRadioUnsub?: () => void
}

const playerExtras = globalThis as typeof globalThis & PlayerBagExtras
if (!playerExtras.__psMediaCache) playerExtras.__psMediaCache = new Map()
if (typeof playerExtras.__psLoadGeneration !== "number") playerExtras.__psLoadGeneration = 0
if (typeof playerExtras.__psWantPlaying !== "boolean") playerExtras.__psWantPlaying = false
if (!playerExtras.__psRntpUnsubs) playerExtras.__psRntpUnsubs = []

let driveBlurExitTimer: ReturnType<typeof setTimeout> | null = null

function cancelDriveBlurExitTimer() {
  if (driveBlurExitTimer != null) {
    clearTimeout(driveBlurExitTimer)
    driveBlurExitTimer = null
  }
}

function appIsActive(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppState } = require("react-native") as { AppState: { currentState: string } }
    return AppState.currentState === "active"
  } catch {
    return true
  }
}

function cacheSong(song: MockSong) {
  cacheCatalogSong(song)
  if (song.audioUrl) playerExtras.__psMediaCache.set(song.number, song)
}

function publishRadioSession() {
  const state = usePlayerStore.getState()
  const session = listeningSessionFromStore(state)
  const playlistBounds =
    session.kind === "playlist" || session.kind === "drive-playlist"
      ? session.bounds
      : state.playlistBounds
  setRadioSession({
    kind: session.kind,
    currentNumber: state.currentSong?.number ?? null,
    playlistBounds,
    driveRepeat: state.driveRepeat,
    repeat: state.repeat,
  })
}

function mergeSong(current: MockSong | null, song: MockSong): MockSong {
  if (!current || !isSameSong(current, song)) return song
  return {
    ...current,
    ...song,
    audioUrl: song.audioUrl || current.audioUrl || null,
    audioRecordings: song.audioRecordings?.length ? song.audioRecordings : current.audioRecordings,
    mediaHydrated: Boolean(song.audioUrl || current.audioUrl || song.mediaHydrated || current.mediaHydrated),
  }
}

async function hydrate(song: MockSong): Promise<MockSong> {
  const cached = playerExtras.__psMediaCache.get(song.number)
  const base =
    song.mediaHydrated && song.audioUrl
      ? song
      : cached?.audioUrl
        ? {
            ...song,
            ...cached,
            audioUrl: cached.audioUrl || song.audioUrl || null,
            audioRecordings: cached.audioRecordings?.length ? cached.audioRecordings : song.audioRecordings,
            imageUrl: song.imageUrl || cached.imageUrl,
            thumbnailUrl: song.thumbnailUrl || cached.thumbnailUrl,
            mediaHydrated: true,
          }
        : null
  const ready = await hydratePlayableSong(song.number, base ?? song)
  if (!ready) return { ...song, mediaHydrated: true }
  cacheSong(ready)
  return ready
}

function shouldLoopCurrent() {
  const state = usePlayerStore.getState()
  return (state.driveAutoAdvance && state.driveRepeat) || state.repeat
}

function loopCurrentTrackForSession(
  session: ReturnType<typeof listeningSessionFromStore>,
  driveRepeat: boolean,
  repeat: boolean,
): boolean {
  if (driveRepeat) return true
  if (!repeat) return false
  return (
    session.kind === "playlist" ||
    session.kind === "drive-playlist" ||
    session.kind === "drive-random" ||
    session.kind === "casual"
  )
}

async function startNativeSong(song: MockSong, generation: number) {
  const ready = await hydrate(song)
  if (generation !== playerExtras.__psLoadGeneration) return
  if (!ready.audioUrl?.trim()) {
    playerExtras.__psWantPlaying = false
    usePlayerStore.setState({
      currentSong: ready,
      hasAudio: false,
      isPlaying: false,
      isBuffering: false,
      audioError: "No in-app audio stream is available for this song yet.",
    })
    return
  }
  cacheSong(ready)
  setPlaybackIntent(ready.number)
  playerExtras.__psWantPlaying = true
  usePreferencesStore.getState().recordRecentPlay(ready)
  usePlayerStore.setState({
    currentSong: ready,
    isPlaying: true,
    isBuffering: true,
    position: 0,
    duration: ready.durationSeconds,
    hasAudio: true,
    audioError: null,
  })
  publishRadioSession()
  await nativeSetRepeatTrack(shouldLoopCurrent())
  await playTrackNow(songToTrack(ready, ready.audioUrl))
  if (generation !== playerExtras.__psLoadGeneration) return
  await ensureUpcomingRadioTrack()
}

function songFromActiveTrack() {
  if (!isTrackPlayerLinked()) {
    const number = getActiveCatalogTrackNumber()
    if (!number) return Promise.resolve(null)
    return Promise.resolve(
      getCachedCatalogSong(number) ?? playerExtras.__psMediaCache.get(number) ?? null,
    )
  }
  return getTrackPlayer().getActiveTrack().then((track) => {
    const number = trackIdToSongNumber(typeof track?.id === "string" ? track.id : null)
    if (!number) return null
    return playerExtras.__psMediaCache.get(number) ?? null
  })
}

async function advanceCatalogAfterTrackEnd(): Promise<void> {
  const state = usePlayerStore.getState()
  const current = state.currentSong
  if (!current) return
  const mode = state.playbackMode
  const queue = playbackAdvanceQueue(mode, state.playlistBounds, state.queue)
  const nextNumber = nextQueueNumber(mode, current.number, queue)
  if (nextNumber == null) return
  playerExtras.__psWantPlaying = true
  playerExtras.__psLoadGeneration += 1
  const generation = playerExtras.__psLoadGeneration
  const song = await hydratePlayableSong(nextNumber)
  if (song) await startNativeSong(song, generation)
}

function handleCatalogQueueEnded(): void {
  const state = usePlayerStore.getState()
  const session = listeningSessionFromStore(state)
  const queue = playbackAdvanceQueue(state.playbackMode, state.playlistBounds, state.queue)
  const shouldAdvance = sessionShouldAdvanceAfterTrackEnd(
    session,
    loopCurrentTrackForSession(
      session,
      state.driveAutoAdvance && state.driveRepeat,
      state.repeat,
    ),
    state.currentSong?.number ?? null,
    queue,
  )
  if (shouldAdvance) {
    if (isTrackPlayerLinked()) {
      void ensureUpcomingRadioTrack().then(() => nativeSkipToNext().catch(() => undefined))
    } else {
      void advanceCatalogAfterTrackEnd()
    }
    return
  }
  playerExtras.__psWantPlaying = false
  void nativeSetRepeatTrack(false)
  if (session.kind === "playlist" || session.kind === "drive-playlist") {
    void nativeRemoveUpcomingTracks()
  }
  usePlayerStore.setState({ isPlaying: false, isBuffering: false })
}

function handleCatalogPlaybackError(): void {
  const state = usePlayerStore.getState()
  if (listeningSessionFromStore(state).kind === "casual") {
    playerExtras.__psWantPlaying = false
    usePlayerStore.setState({
      isPlaying: false,
      isBuffering: false,
      audioError: "Audio could not be played.",
    })
    return
  }
  if (isTrackPlayerLinked()) {
    void ensureUpcomingRadioTrack().then(() => nativeSkipToNext().catch(() => undefined))
  } else {
    void advanceCatalogAfterTrackEnd()
  }
}

function listen(event: RntpEvent, cb: (payload: any) => void) {
  const sub = getTrackPlayer().addEventListener(event, cb)
  playerExtras.__psRntpUnsubs.push(sub)
}

function installNativeListeners() {
  setCatalogPlaybackHost({
    onQueueEnded: handleCatalogQueueEnded,
    onPlaybackError: handleCatalogPlaybackError,
  })
  if (!isTrackPlayerLinked()) return

  const { Event, State } = loadTrackPlayerModule()
  for (const sub of playerExtras.__psRntpUnsubs.splice(0)) {
    sub.remove()
  }
  listen(Event.PlaybackState, (event: { state?: string }) => {
    const state = event.state
    if (state === State.Playing) {
      playerExtras.__psWantPlaying = true
      usePlayerStore.setState({ isPlaying: true, isBuffering: false, audioError: null })
      return
    }
    if (state === State.Buffering || state === State.Loading) {
      usePlayerStore.setState({ isBuffering: true, isPlaying: playerExtras.__psWantPlaying })
      return
    }
    if (state === State.Paused || state === State.Stopped) {
      if (!playerExtras.__psWantPlaying) {
        usePlayerStore.setState({ isPlaying: false, isBuffering: false })
      }
    }
  })
  listen(Event.PlaybackProgressUpdated, (event) => {
    usePlayerStore.setState({
      position: Math.floor(event.position || 0),
      duration: Math.max(1, Math.floor(event.duration || usePlayerStore.getState().duration || 1)),
    })
  })
  listen(Event.PlaybackActiveTrackChanged, (event) => {
    const number = trackIdToSongNumber(typeof event.track?.id === "string" ? event.track.id : null)
    if (!number) return
    const cached = getCachedCatalogSong(number) ?? playerExtras.__psMediaCache.get(number)
    if (cached) {
      usePlayerStore.setState({ currentSong: cached, hasAudio: true, audioError: null, position: 0 })
    }
    publishRadioSession()
    void nativeSetRepeatTrack(shouldLoopCurrent())
    void ensureUpcomingRadioTrack()
    const state = usePlayerStore.getState()
    const session = listeningSessionFromStore(state)
    const bounds =
      state.playlistBounds ??
      (session.kind === "playlist" || session.kind === "drive-playlist" ? session.bounds : null)
    if (
      bounds?.length &&
      state.currentSong &&
      playlistStep(state.currentSong.number, bounds, 1) == null
    ) {
      void nativeRemoveUpcomingTracks()
    }
  })
  listen(Event.PlaybackQueueEnded, () => {
    handleCatalogQueueEnded()
  })
  listen(Event.PlaybackError, () => {
    handleCatalogPlaybackError()
  })
}

function isIosPlatform() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native") as { Platform: { OS: string } }
    return Platform.OS === "ios"
  } catch {
    return false
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  queue: [],
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 1,
  hasAudio: false,
  audioError: null,
  isBuffering: false,
  repeat: readAudioRepeat(),
  playbackMode: "default",
  playlistBounds: null,
  activePlaylist: null,
  driveAutoAdvance: false,
  driveScreenFocused: false,
  driveRepeat: false,
  stopQueueAfterCurrentTrack: false,

  setDriveScreenFocused: (focused) => {
    set({ driveScreenFocused: focused })
    publishRadioSession()
  },

  scheduleDriveBlurExit: () => {
    set({ driveScreenFocused: false })
    cancelDriveBlurExitTimer()
    driveBlurExitTimer = setTimeout(() => {
      driveBlurExitTimer = null
      if (!appIsActive()) return
      if (get().driveScreenFocused) return
      get().exitDriveMode()
    }, 1200)
  },

  cancelDriveBlurExit: () => {
    cancelDriveBlurExitTimer()
  },

  noteAppBackgroundPlayback: () => {
    cancelDriveBlurExitTimer()
    if (get().driveAutoAdvance && !get().driveScreenFocused) {
      set({ driveScreenFocused: true })
    }
  },

  enterDrivePlayback: () => {
    set({ driveAutoAdvance: true })
    publishRadioSession()
  },

  exitDriveMode: () => {
    const state = get()
    const wasDriveSession =
      state.driveAutoAdvance ||
      state.playbackMode === "random" ||
      (state.playbackMode === "playlist" && state.driveScreenFocused)
    if (!wasDriveSession) return
    playerExtras.__psLoadGeneration += 1
    playerExtras.__psWantPlaying = false
    setPlaybackIntent(null)
    set({
      driveAutoAdvance: false,
      driveRepeat: false,
      playbackMode: "default",
      playlistBounds: null,
      activePlaylist: null,
      queue: [],
      currentSong: null,
      hasAudio: false,
      stopQueueAfterCurrentTrack: false,
      isPlaying: false,
      isBuffering: false,
      position: 0,
      duration: 0,
    })
    publishRadioSession()
    void nativeStop()
  },

  prepareCatalogAudioForDriveEntry: async () => {
    playerExtras.__psLoadGeneration += 1
    playerExtras.__psWantPlaying = false
    await nativeStop()
  },

  toggleDriveRepeat: () => {
    set({ driveRepeat: !get().driveRepeat })
    publishRadioSession()
    void nativeSetRepeatTrack(shouldLoopCurrent())
  },

  toggleRepeat: () => {
    const next = !get().repeat
    writeAudioRepeat(next)
    set({ repeat: next })
    publishRadioSession()
    void nativeSetRepeatTrack(shouldLoopCurrent())
  },

  setQueue: (numbers) => {
    const bounds = get().playlistBounds
    const samePlaylistReorder =
      bounds?.length &&
      numbers.length === bounds.length &&
      numbers.every((n) => bounds.includes(n))
    set({
      queue: numbers,
      playlistBounds: samePlaylistReorder ? numbers : bounds,
    })
    publishRadioSession()
  },

  syncCurrentSong: (song, queue) => {
    const current = get().currentSong
    const merged = mergeSong(current, song)
    cacheSong(merged)
    const holdQueue = get().stopQueueAfterCurrentTrack
    set({
      currentSong: merged,
      queue: holdQueue ? get().queue : queue?.length ? queue : get().queue,
      hasAudio: Boolean(merged.audioUrl) || get().hasAudio,
      audioError: null,
    })
  },

  warmAudio: (song) => {
    void setupNativeCatalogPlayer().catch(() => undefined)
    if (!song) return
    void hydrate(song).catch(() => undefined)
  },

  loadSong: (song, queue, playbackMode) => {
    const existing = get()
    const stopAfterCurrent =
      existing.stopQueueAfterCurrentTrack
    const sameCatalogSong = isSameSong(existing.currentSong, song)
    const wasSavedPlaylist =
      existing.playbackMode === "playlist" && !existing.driveAutoAdvance
    const keepPlaylist =
      !playbackMode &&
      wasSavedPlaylist &&
      Boolean(
        existing.playlistBounds?.length &&
          queue?.length === existing.playlistBounds.length &&
          queue.every((n, i) => n === existing.playlistBounds![i]),
      )
    const mode = resolvePlaybackMode(queue, playbackMode ?? (keepPlaylist ? "playlist" : undefined))
    if (mode === "random" && !existing.driveScreenFocused && !existing.driveAutoAdvance) return
    const bounds = existing.playlistBounds
    const inBounds = Boolean(bounds?.includes(song.number))
    let playlistBounds = bounds
    if (playbackMode === "playlist" && queue?.length) {
      playlistBounds = queue
    } else if (playbackMode === "random" || playbackMode === "default") {
      playlistBounds = null
    } else if (!isSameAudioTrack(existing.currentSong, song) && !inBounds) {
      playlistBounds = null
    }
    let nextQueue =
      keepPlaylist && playlistBounds?.length
        ? playlistBounds
        : queue?.length
          ? queue
          : existing.queue
    let resolvedMode = mode
    if (stopAfterCurrent && sameCatalogSong && playbackMode !== "playlist") {
      resolvedMode = "default"
      const hold = existing.currentSong?.number ?? song.number
      nextQueue = [hold]
      playlistBounds = null
    }
    const clearPlaylistMeta =
      playbackMode === "random" ||
      playbackMode === "default" ||
      (!isSameAudioTrack(get().currentSong, song) && !inBounds && playbackMode !== "playlist")
    const leavingSavedPlaylist = wasSavedPlaylist && resolvedMode !== "playlist"
    set({
      playbackMode: resolvedMode,
      queue: nextQueue,
      playlistBounds,
      activePlaylist: clearPlaylistMeta ? null : get().activePlaylist,
    })
    publishRadioSession()
    if (leavingSavedPlaylist) {
      playerExtras.__psLoadGeneration += 1
      playerExtras.__psWantPlaying = false
      setPlaybackIntent(null)
      void nativeStop()
      set({
        currentSong: null,
        hasAudio: false,
        isPlaying: false,
        isBuffering: false,
        position: 0,
        duration: 0,
      })
      publishRadioSession()
    }
    if (
      isSameAudioTrack(get().currentSong, song) &&
      get().hasAudio &&
      !leavingSavedPlaylist
    ) {
      get().syncCurrentSong(song, queue)
      return
    }
    if (!(stopAfterCurrent && sameCatalogSong)) {
      set({ stopQueueAfterCurrentTrack: false })
    }
    playerExtras.__psLoadGeneration += 1
    const generation = playerExtras.__psLoadGeneration
    publishRadioSession()
    void startNativeSong(song, generation).catch(() => {
      if (generation !== playerExtras.__psLoadGeneration) return
      usePlayerStore.setState({
        isPlaying: false,
        isBuffering: false,
        audioError: "Could not start audio.",
      })
    })
  },

  playOrToggle: (song, queue) => {
    const state = get()
    if (isSameAudioTrack(state.currentSong, song)) {
      if (queue?.length && !state.stopQueueAfterCurrentTrack) {
        // Stay in playlist when toggling the active playlist track; otherwise treat as casual.
        const keepPlaylist =
          state.playbackMode === "playlist" &&
          Boolean(state.playlistBounds?.includes(song.number))
        set({
          queue,
          playbackMode: resolvePlaybackMode(queue, keepPlaylist ? "playlist" : "default"),
        })
      }
      get().togglePlay()
      return
    }
    if (isSameSong(state.currentSong, song)) {
      get().loadSong(
        song,
        state.stopQueueAfterCurrentTrack ? [song.number] : queue,
        state.playbackMode === "playlist" && state.playlistBounds?.includes(song.number)
          ? "playlist"
          : "default",
      )
      return
    }
    // Casual Explore / song-page play always replaces a saved playlist session.
    get().loadSong(song, queue, "default")
  },

  togglePlay: () => {
    if (get().isPlaying || playerExtras.__psWantPlaying) {
      get().pause()
      return
    }
    get().play()
  },

  play: () => {
    const song = get().currentSong
    if (!song) return
    playerExtras.__psWantPlaying = true
    setPlaybackIntent(song.number)
    if (!get().hasAudio) {
      playerExtras.__psLoadGeneration += 1
      void startNativeSong(song, playerExtras.__psLoadGeneration)
      return
    }
    set({ isPlaying: true, audioError: null })
    void nativePlay().catch(() => {
      playerExtras.__psLoadGeneration += 1
      void startNativeSong(song, playerExtras.__psLoadGeneration)
    })
  },

  reassertBackgroundPlayback: () => {
    /* Native queue owns lock-screen audio — do not reset the session. */
  },

  reconcileForegroundCatalogPlayback: () => {
    void songFromActiveTrack().then((song) => {
      if (song) usePlayerStore.setState({ currentSong: song, hasAudio: true })
    })
  },

  pause: () => {
    playerExtras.__psWantPlaying = false
    setPlaybackIntent(null)
    set({ isPlaying: false, isBuffering: false })
    void nativePause()
  },

  stopIfPlayingLocalUri: (fileUri) => {
    const uri = fileUri?.trim()
    if (!uri) return
    const current = get().currentSong
    if (!current?.audioUrl?.trim() || current.audioUrl.trim() !== uri) return
    playerExtras.__psWantPlaying = false
    playerExtras.__psLoadGeneration += 1
    setPlaybackIntent(null)
    void nativeStop()
    set({
      isPlaying: false,
      isBuffering: false,
      hasAudio: false,
      position: 0,
      currentSong: { ...current, audioUrl: null, mediaHydrated: false },
      audioError:
        "Saved copy removed. Connect to the internet to stream, or save again for offline play.",
    })
    publishRadioSession()
  },

  prepareForSpeechCapture: async () => {
    playerExtras.__psWantPlaying = false
    set({ isPlaying: false, isBuffering: false })
    await nativePause()
    if (!isIosPlatform()) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      return
    }
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      })
    } catch {
      /* ignore */
    }
  },

  seekTo: (position) => {
    set({ position })
    void nativeSeek(position)
  },

  seekBy: (deltaSeconds) => {
    const { position, duration } = get()
    const max = duration > 0 ? duration : Math.max(0, position + deltaSeconds)
    get().seekTo(Math.max(0, Math.min(max, position + deltaSeconds)))
  },

  setVolume: (volume) => {
    const clamped = Math.min(1, Math.max(0, volume))
    set({ volume: clamped })
    void nativeSetVolume(clamped)
  },

  adjustVolume: (delta) => {
    get().setVolume(get().volume + delta)
  },

  next: () => {
    const current = get().currentSong
    if (!current) return
    if (get().stopQueueAfterCurrentTrack) return
    const mode = get().playbackMode
    if (mode === "default" && !get().driveAutoAdvance) {
      const q = get().queue
      if (q.length <= 1 && q[0] === current.number) return
    }
    const queue = playbackAdvanceQueue(mode, get().playlistBounds, get().queue)
    const nextNumber = nextQueueNumber(mode, current.number, queue)
    if (nextNumber == null) {
      if (mode === "playlist") return
      playerExtras.__psWantPlaying = false
      set({ isPlaying: false, isBuffering: false })
      return
    }
    playerExtras.__psWantPlaying = true
    if (mode === "playlist") {
      playerExtras.__psLoadGeneration += 1
      const generation = playerExtras.__psLoadGeneration
      set({ isBuffering: true })
      void (async () => {
        const song = await hydratePlayableSong(nextNumber)
        if (song) await startNativeSong(song, generation)
      })()
      return
    }
    void (async () => {
      await ensureUpcomingRadioTrack()
      try {
        await nativeSkipToNext()
      } catch {
        const song = await hydratePlayableSong(nextNumber)
        if (song) await startNativeSong(song, (playerExtras.__psLoadGeneration += 1))
      }
    })()
  },

  previous: () => {
    const current = get().currentSong
    if (!current) return
    const mode = get().playbackMode
    const queue = playbackAdvanceQueue(mode, get().playlistBounds, get().queue)
    if (mode === "random") {
      get().seekTo(0)
      if (!get().isPlaying) get().play()
      return
    }
    if (mode === "playlist") {
      const stepped = previousQueueNumber(mode, current.number, queue)
      if (stepped == null) {
        get().seekTo(0)
        if (!get().isPlaying) get().play()
        return
      }
      playerExtras.__psWantPlaying = true
      playerExtras.__psLoadGeneration += 1
      const generation = playerExtras.__psLoadGeneration
      set({ isBuffering: true })
      void (async () => {
        const song = await hydratePlayableSong(stepped)
        if (song) await startNativeSong(song, generation)
      })()
      return
    }
    void nativeSkipToPrevious().catch(() => get().seekTo(0))
  },

  clear: () => {
    playerExtras.__psLoadGeneration += 1
    playerExtras.__psWantPlaying = false
    setPlaybackIntent(null)
    void nativeStop()
    set({
      currentSong: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      hasAudio: false,
      audioError: null,
      isBuffering: false,
      playlistBounds: null,
      activePlaylist: null,
      driveAutoAdvance: false,
      driveRepeat: false,
    })
    publishRadioSession()
  },
}))

function installPlayerAudioFocusBridge(): void {
  setSongPlayingGuard(() => playerExtras.__psWantPlaying || usePlayerStore.getState().isPlaying)
  setSongPlaybackYield(async () => {
    playerExtras.__psWantPlaying = false
    setPlaybackIntent(null)
    usePlayerStore.setState({ isPlaying: false, isBuffering: false })
    await nativePause()
  })
}

registerNativePlayerListeners(installNativeListeners)
installPlayerAudioFocusBridge()
playerExtras.__psRadioUnsub?.()
playerExtras.__psRadioUnsub = usePlayerStore.subscribe(() => {
  publishRadioSession()
})
