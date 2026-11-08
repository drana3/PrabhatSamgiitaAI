import { Audio } from "expo-av"
import type { Event as RntpEvent } from "react-native-track-player"
import { create } from "zustand"

import type { MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import { readAudioRepeat, writeAudioRepeat } from "@/lib/audioRepeat"
import { isSameAudioTrack, isSameSong } from "@/lib/playback"
import { resolvePlaybackUri, setBeforeOfflineFileRemoved } from "@/lib/offlineAudio"
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
  nativeSetRate,
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
import {
  afterPlaybackError,
  LOAD_TIMEOUT_MS,
  noStreamReason,
  type PlayerErrorCode,
} from "@/lib/playback/playerError"
import { cancelPendingNumber } from "@/lib/playerV2/controller"
import { ensureUpcomingRadioTrack, hydratePlayableSong, hydratePlayableSongOutcome } from "@/lib/playback/radioAdvance"
import {
  getTrackPlayer,
  isTrackPlayerLinked,
  loadTrackPlayerModule,
} from "@/lib/playback/trackPlayerBridge"
import { setRadioSession } from "@/lib/playback/radioSession"
import {
  patchForSignal,
  signalFromState,
  type NativeSignal,
} from "@/lib/playback/nativeSignals"
import { clearTransition, inTransition, markTransition } from "@/lib/playback/transition"
import { runTrackEndHook } from "@/lib/playback/trackEndHook"
import { resolveStartPosition } from "@/lib/playback/startPosition"
import { songDetailToMockSong } from "@/lib/songMap"
import { driveBlurDecision } from "@/lib/radio/keepPlaying"
import { usePreferencesStore } from "@/stores/preferencesStore"

type PlayerState = {
  currentSong: MockSong | null
  queue: number[]
  isPlaying: boolean
  position: number
  duration: number
  volume: number
  /** Playback speed, 0.5 to 1.5 (redesigned player). */
  rate: number
  hasAudio: boolean
  /** Why the song did not play, as a code (lib/playback/playerError.ts); null when nothing is wrong. */
  audioError: PlayerErrorCode | null
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
  /** Replace the queue, adding or removing songs; a saved-playlist session follows it. */
  replaceQueue: (numbers: number[]) => void
  setRate: (rate: number) => void
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

let lastHydrateFetchFailed = false

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
  const outcome = await hydratePlayableSongOutcome(song.number, base ?? song)
  // Remembered for the one place that words the failure right after this call (no connection, or no audio).
  lastHydrateFetchFailed = outcome.fetchFailed
  const ready = outcome.song
  if (!ready) return { ...song, mediaHydrated: true }
  cacheSong(ready)
  return ready
}

function sameLocalPath(a: string, b: string): boolean {
  if (a === b) return true
  try {
    return decodeURIComponent(a) === decodeURIComponent(b)
  } catch {
    return false
  }
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

/**
 * A song that is still buffering long after it was handed over (no connection, a dead link) is given up on:
 * the spinner ends with a message and the play button tries again. Only the first start is timed, a stall
 * in the middle of a song is the network's business.
 */
function armLoadTimeout(generation: number): void {
  setTimeout(() => {
    if (generation !== playerExtras.__psLoadGeneration) return
    const state = usePlayerStore.getState()
    if (!state.isBuffering || !playerExtras.__psWantPlaying || state.position > 0) return
    playerExtras.__psWantPlaying = false
    setPlaybackIntent(null)
    markTransition()
    void nativePause().catch(() => undefined)
    usePlayerStore.setState({ isPlaying: false, isBuffering: false, audioError: "timeout" })
  }, LOAD_TIMEOUT_MS)
}

/** The load that has not yet handed its song to the native player (hydrating, preparing). Pause cancels it. */
let pendingStartGeneration: number | null = null

async function startNativeSong(song: MockSong, generation: number) {
  pendingStartGeneration = generation
  try {
    await startNativeSongInner(song, generation)
  } finally {
    if (pendingStartGeneration === generation) pendingStartGeneration = null
  }
}

async function startNativeSongInner(song: MockSong, generation: number) {
  // Buffer immediately — after Remove offline, hydrate may fetch a remote URL
  // before the player can start (felt like a hang with no progress).
  playerExtras.__psWantPlaying = true
  markTransition()
  setPlaybackIntent(song.number)
  usePlayerStore.setState({
    currentSong: song,
    isPlaying: true,
    isBuffering: true,
    position: 0,
    // The catalog 5:00 value is a placeholder; the real length arrives with the
    // first native progress event (BUG-27).
    duration: 0,
    audioError: null,
  })
  publishRadioSession()

  const ready = await hydrate(song)
  if (generation !== playerExtras.__psLoadGeneration) return
  if (!ready.audioUrl?.trim()) {
    playerExtras.__psWantPlaying = false
    usePlayerStore.setState({
      currentSong: ready,
      hasAudio: false,
      isPlaying: false,
      isBuffering: false,
      audioError: noStreamReason(lastHydrateFetchFailed),
    })
    return
  }
  cacheSong(ready)
  // Recent plays and resume points are Prabhat Samgiita history; a Kiirtan does not enter them.
  if (ready.kind !== "kiirtan") usePreferencesStore.getState().recordRecentPlay(ready)
  usePlayerStore.setState({
    currentSong: ready,
    isPlaying: true,
    isBuffering: true,
    position: 0,
    duration: 0,
    hasAudio: true,
    audioError: null,
  })
  publishRadioSession()
  await nativeSetRepeatTrack(shouldLoopCurrent())
  // A newer load may have started while the native player was busy; starting
  // this stream now would play two songs (BUG-05).
  if (generation !== playerExtras.__psLoadGeneration) return
  markTransition()
  await playTrackNow(songToTrack(ready, ready.audioUrl), resolveStartPosition(ready))
  // The song is with the native player now: a pause from here on pauses it instead of cancelling the load.
  if (pendingStartGeneration === generation) pendingStartGeneration = null
  armLoadTimeout(generation)
  if (generation !== playerExtras.__psLoadGeneration) {
    // Paused while it was being handed over: it must not keep playing. (A newer load wants to play and handles itself.)
    if (!playerExtras.__psWantPlaying) void nativePause().catch(() => undefined)
    return
  }
  const rate = usePlayerStore.getState().rate
  if (rate !== 1) void nativeSetRate(rate).catch(() => undefined)
  await ensureUpcomingRadioTrack()
}

/**
 * Hydrate and start one catalog song for a queue step (next, previous, track end).
 * Ignores the result when a newer load superseded it, and never leaves the
 * loading spinner stuck when the song has no stream or hydration throws.
 */
async function startSongByNumber(number: number, generation: number): Promise<void> {
  const failStep = (code: PlayerErrorCode) => {
    if (generation !== playerExtras.__psLoadGeneration) return
    playerExtras.__psWantPlaying = false
    usePlayerStore.setState({
      isPlaying: false,
      isBuffering: false,
      audioError: code,
    })
  }
  try {
    const { song, fetchFailed } = await hydratePlayableSongOutcome(number)
    if (generation !== playerExtras.__psLoadGeneration) return
    if (!song) {
      failStep(noStreamReason(fetchFailed))
      return
    }
    await startNativeSong(song, generation)
  } catch {
    failStep("failed")
  }
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
  await startSongByNumber(nextNumber, generation)
}

function handleCatalogQueueEnded(): void {
  if (runTrackEndHook()) return
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
      markTransition()
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

/** Failures in a row without a song playing in between. */
let errorStreak = 0

function handleCatalogPlaybackError(): void {
  const state = usePlayerStore.getState()
  if (listeningSessionFromStore(state).kind === "casual") {
    playerExtras.__psWantPlaying = false
    usePlayerStore.setState({
      isPlaying: false,
      isBuffering: false,
      audioError: "failed",
    })
    return
  }
  // In a list a bad song is skipped, but never forever: after a few failures in a row the list stops
  // (otherwise a list with no connection flips through songs and burns data).
  const verdict = afterPlaybackError(errorStreak)
  errorStreak = verdict.next
  if (verdict.stop) {
    errorStreak = 0
    playerExtras.__psWantPlaying = false
    markTransition()
    void nativePause().catch(() => undefined)
    usePlayerStore.setState({ isPlaying: false, isBuffering: false, audioError: "failed" })
    return
  }
  if (isTrackPlayerLinked()) {
    markTransition()
    void ensureUpcomingRadioTrack().then(() => nativeSkipToNext().catch(() => undefined))
  } else {
    void advanceCatalogAfterTrackEnd()
  }
}

/** Apply what the native player reports to the store: the one place isPlaying follows the sound. */
export function applyNativeSignal(signal: NativeSignal): void {
  const patch = patchForSignal(
    signal,
    { inTransition: inTransition() },
    { wantPlaying: playerExtras.__psWantPlaying },
  )
  if (!patch) return
  playerExtras.__psWantPlaying = patch.wantPlaying
  if (patch.endTransition) clearTransition()
  const next: Partial<PlayerState> = {}
  if (patch.isPlaying !== undefined) next.isPlaying = patch.isPlaying
  if (patch.isBuffering !== undefined) next.isBuffering = patch.isBuffering
  if (patch.clearError) next.audioError = null
  if (signal === "playing") errorStreak = 0
  usePlayerStore.setState(next)
  if (signal === "paused" || signal === "stopped" || signal === "wants-pause") {
    setPlaybackIntent(null)
  } else if (signal === "playing" || signal === "wants-play") {
    const song = usePlayerStore.getState().currentSong
    if (song) setPlaybackIntent(song.number)
  }
}

/**
 * Back in the foreground: the JS side may have missed events while it was
 * suspended (a pause from the lock screen, a call). Ask the native player.
 */
async function reconcilePlayStateFromNative(): Promise<void> {
  if (!isTrackPlayerLinked()) return
  try {
    const TrackPlayer = getTrackPlayer()
    const [{ state }, progress] = await Promise.all([
      TrackPlayer.getPlaybackState(),
      TrackPlayer.getProgress(),
    ])
    const signal = signalFromState(state as unknown as string)
    if (signal === "playing" || signal === "paused" || signal === "stopped" || signal === "ended") {
      const store = usePlayerStore.getState()
      // Only correct a disagreement; never start or stop anything here.
      if (signal === "playing" && !store.isPlaying) applyNativeSignal("playing")
      if (signal !== "playing" && store.isPlaying && !store.isBuffering) {
        applyNativeSignal(signal === "ended" ? "stopped" : signal)
      }
    }
    if (progress && Number.isFinite(progress.position) && usePlayerStore.getState().currentSong) {
      usePlayerStore.setState({ position: Math.floor(progress.position) })
    }
  } catch {
    /* player not set up yet */
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
    applyNativeSignal(signalFromState(event.state))
  })
  // Fired for every play/pause, whoever caused it (lock screen, headphones, a call, Siri).
  if (Event.PlaybackPlayWhenReadyChanged) {
    listen(Event.PlaybackPlayWhenReadyChanged, (event: { playWhenReady?: boolean }) => {
      applyNativeSignal(event.playWhenReady ? "wants-play" : "wants-pause")
    })
  }
  listen(Event.PlaybackProgressUpdated, (event) => {
    // Native reports duration 0 while loading; keep "unknown" (0) instead of faking 0:01.
    const reported = Number(event.duration)
    usePlayerStore.setState({
      position: Math.floor(event.position || 0),
      duration:
        reported > 0 ? Math.max(1, Math.floor(reported)) : usePlayerStore.getState().duration,
    })
  })
  listen(Event.PlaybackActiveTrackChanged, (event) => {
    const number = trackIdToSongNumber(typeof event.track?.id === "string" ? event.track.id : null)
    if (!number) return
    const cached = getCachedCatalogSong(number) ?? playerExtras.__psMediaCache.get(number)
    if (cached) {
      const changed = usePlayerStore.getState().currentSong?.number !== cached.number
      // The new song's length is unknown until the player reports it; the old song's must not show.
      usePlayerStore.setState({
        currentSong: cached,
        hasAudio: true,
        audioError: null,
        position: 0,
        ...(changed ? { duration: 0 } : {}),
      })
      // A song reached by itself (the list moved on) is a play too; Kiirtan stays out of the history.
      if (changed && cached.kind !== "kiirtan") usePreferencesStore.getState().recordRecentPlay(cached)
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
  rate: 1,
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
      // The Radio keeps playing when the person leaves its screen (lib/radio/keepPlaying.ts); only a drive playlist ends here.
      const decision = driveBlurDecision(get())
      if (decision === "keep") return
      if (decision === "forget") {
        set({ driveAutoAdvance: false, driveRepeat: false })
        publishRadioSession()
        return
      }
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
    // The web preview has no native engine: nothing to stop (leaving the Radio there raised an uncaught error).
    if (isTrackPlayerLinked()) void nativeStop()
  },

  prepareCatalogAudioForDriveEntry: async () => {
    playerExtras.__psLoadGeneration += 1
    playerExtras.__psWantPlaying = false
    // The web preview has no native engine: there is nothing to stop (Radio opened with an uncaught error there).
    if (!isTrackPlayerLinked()) return
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

  replaceQueue: (numbers) => {
    const mode = get().playbackMode
    set({
      queue: numbers,
      playlistBounds: mode === "playlist" ? numbers : get().playlistBounds,
    })
    publishRadioSession()
    if (mode === "playlist") void nativeRemoveUpcomingTracks().then(() => ensureUpcomingRadioTrack())
  },

  setRate: (rate) => {
    const clamped = Math.min(1.5, Math.max(0.5, rate))
    set({ rate: clamped })
    void nativeSetRate(clamped).catch(() => undefined)
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
    // Chosen by the person (or the controller): a song still loading from an earlier tap is dropped, the failure streak starts over.
    cancelPendingNumber()
    errorStreak = 0
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
    // The queue always contains what is playing: a stale list from an earlier screen must not
    // become the "next" of a song that is not in it. A lone song is a queue of one.
    if (!nextQueue.includes(song.number)) nextQueue = [song.number]
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
        audioError: "failed",
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
    errorStreak = 0
    // After an error the native player holds nothing useful: play is a retry, so load the song again.
    if (!get().hasAudio || get().audioError) {
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
    void reconcilePlayStateFromNative()
  },

  pause: () => {
    playerExtras.__psWantPlaying = false
    setPlaybackIntent(null)
    if (pendingStartGeneration === playerExtras.__psLoadGeneration) {
      // Paused on the spinner: the song is not with the native player yet. Cancel the load, or it would
      // start anyway when the network answers. Play starts it again from the beginning.
      playerExtras.__psLoadGeneration += 1
      pendingStartGeneration = null
      set({ isPlaying: false, isBuffering: false, hasAudio: false })
    } else {
      set({ isPlaying: false, isBuffering: false })
    }
    void nativePause()
  },

  stopIfPlayingLocalUri: (fileUri) => {
    const uri = fileUri?.trim()
    if (!uri) return
    const current = get().currentSong
    // Android plays a decoded address while the index keeps the encoded one: compare both ways.
    if (!current?.audioUrl?.trim() || !sameLocalPath(current.audioUrl.trim(), uri)) return
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
      audioError: "removed",
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
      void startSongByNumber(nextNumber, generation)
      return
    }
    void (async () => {
      markTransition()
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
      void startSongByNumber(stepped, generation)
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
// Every way of deleting a saved file stops it first when it is the one playing.
try {
  setBeforeOfflineFileRemoved((fileUri) => usePlayerStore.getState().stopIfPlayingLocalUri(fileUri))
} catch {
  /* a test double of the offline module may not have the hook */
}
playerExtras.__psRadioUnsub?.()
playerExtras.__psRadioUnsub = usePlayerStore.subscribe(() => {
  publishRadioSession()
})
