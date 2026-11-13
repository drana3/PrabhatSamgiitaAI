import { demoSong } from "@/lib/fixtures/playerDemo"
import { kiirtanSongByNumber } from "@/lib/kirtan/catalog"
import { isKiirtanNumber } from "@/lib/kirtan/track"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { hasPlayableAudio } from "@/lib/playableAudio"
import { setTrackEndHook } from "@/lib/playback/trackEndHook"
import { hydratePlayableSong } from "@/lib/playback/radioAdvance"
import {
  createTrackEndHook,
  type ControllerDeps,
} from "@/lib/playerV2/controller"
import { installDemoPlayer } from "@/lib/playerV2/demoEngine"
import { createQueueActions } from "@/lib/playerV2/queueActions"
import { activeQueue } from "@/lib/playerV2/controller"
import { createResumeTracker, type ResumeTracker } from "@/lib/playerV2/resumeTracker"
import { resumePositionFor } from "@/lib/playerV2/resume"
import { useResumeNotice } from "@/lib/playerV2/resumeNotice"
import { setStartPositionResolver } from "@/lib/playback/startPosition"
import type { MockSong } from "@/data/mock"
import { createRepeatSync } from "@/lib/playerV2/repeatSync"
import { createSleepRuntime } from "@/lib/playerV2/sleepRuntime"
import { tickSleep } from "@/lib/playerV2/sleepWatcher"
import { ensureUpcomingRadioTrack } from "@/lib/playback/radioAdvance"
import { nativeRemoveUpcomingTracks, nativeSetRepeatTrack, nativeSetVolume } from "@/lib/playback/nativeCatalogPlayer"
import { selectedVersionIndex, versionsFromSong } from "@/lib/playerV2/versions"
import { setTransportDeps } from "@/lib/playerV2/transport"
import { setTransitionContext } from "@/lib/playback/levelingBridge"
import { createLongResumeRecorder } from "@/lib/playerV2/longResume"
import { useLongResumeOffer } from "@/lib/playerV2/longResumeOffer"
import { isRadioRunning, trackKeyOf, transitionSecondsFor } from "@/lib/playerV2/playbackPrefs"
import { startRateOf, usePlaybackPrefsStore } from "@/stores/playbackPrefsStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePlayerV2Store } from "@/stores/playerV2Store"
import { useResumeStore } from "@/stores/resumeStore"

/** The controller wired to the real stores and engine. */
export function realControllerDeps(): ControllerDeps {
  return {
    getPlayer: () => {
      const s = usePlayerStore.getState()
      return {
        currentSong: s.currentSong,
        queue: s.queue,
        playbackMode: s.playbackMode,
        playlistBounds: s.playlistBounds,
        position: s.position,
      }
    },
    getPrefs: () => {
      const s = usePlayerV2Store.getState()
      return { playMode: s.playMode, repeatMode: s.repeatMode, versionByNumber: s.versionByNumber }
    },
    loadSong: (song, queue, mode) => usePlayerStore.getState().loadSong(song, queue, mode),
    loadNumber: (number) => {
      // A Kiirtan number resolves to its track record; the engine reports a missing file itself.
      if (isKiirtanNumber(number)) return Promise.resolve(kiirtanSongByNumber(number))
      return MOCKUP_DATA ? Promise.resolve(demoSong(number)) : hydratePlayableSong(number)
    },
    isPlayable: (number) => hasPlayableAudio(number),
    remember: (songNumber, versionId) => usePlayerV2Store.getState().rememberVersion(songNumber, versionId),
    seekTo: (seconds) => usePlayerStore.getState().seekTo(seconds),
  }
}

/** Queue edits wired to the player and the v2 store. */
export function realQueueActions() {
  return createQueueActions({
    getQueue: () => {
      const s = usePlayerStore.getState()
      return {
        numbers: activeQueue({
          currentSong: s.currentSong,
          queue: s.queue,
          playbackMode: s.playbackMode,
          playlistBounds: s.playlistBounds,
          position: s.position,
        }),
        current: s.currentSong?.number ?? null,
        random: s.playbackMode === "random",
      }
    },
    replaceQueue: (numbers) => usePlayerStore.getState().replaceQueue(numbers),
    getShuffleOriginal: () => usePlayerV2Store.getState().shuffleOriginal,
    setShuffleOriginal: (queue) => usePlayerV2Store.getState().setShuffleOriginal(queue),
  })
}

// Next / Previous from every source (lock screen, headphones, mini player) use these dependencies.
setTransportDeps(realControllerDeps)

let started = false
let resumeTracker: ResumeTracker | null = null

/** The version of a song that is playing, for resume points; null for a song with one recording. */
function versionIdOf(song: MockSong): string | null {
  const versions = versionsFromSong(song)
  if (versions.length <= 1) return null
  const remembered = usePlayerV2Store.getState().versionByNumber[String(song.number)]
  return versions[selectedVersionIndex(versions, song.audioUrl, remembered)]?.id ?? null
}

/**
 * "Start over" on the player: forget the saved place of this song, go to 0 and play. If the song is still
 * loading, the late jump to the saved place is cancelled too.
 */
export function startSongOver(): void {
  const player = usePlayerStore.getState()
  const song = player.currentSong
  if (!song) return
  resumeTracker?.dismiss()
  useResumeStore.getState().forget(song.number)
  useResumeNotice.getState().clear()
  player.seekTo(0)
  if (!player.isPlaying) player.play()
}

/**
 * Starts what the redesigned player needs in the background: the "play all
 * versions" and repeat-list hook, the sleep timer and resume positions.
 * It runs once and keeps running for the life of the app, because the sleep
 * timer and the version hook must keep working after the Player screen is
 * closed. The root layout can call this once the redesign is switched on.
 */
export function startPlayerV2Services(): void {
  if (started) return
  started = true
  const sleepRuntime = createSleepRuntime({
    getTimer: () => usePlayerV2Store.getState().sleep,
    currentSongNumber: () => usePlayerStore.getState().currentSong?.number ?? null,
    holdNative: () => {
      void nativeSetRepeatTrack(false).catch(() => undefined)
      void nativeRemoveUpcomingTracks().catch(() => undefined)
    },
    releaseNative: () => {
      const s = usePlayerStore.getState()
      void nativeSetRepeatTrack((s.driveAutoAdvance && s.driveRepeat) || s.repeat).catch(() => undefined)
      void ensureUpcomingRadioTrack()
    },
    pause: () => usePlayerStore.getState().pause(),
    rewind: () => usePlayerStore.getState().seekTo(0),
    cancel: () => usePlayerV2Store.getState().cancelSleep(),
    getVolume: () => usePlayerStore.getState().volume,
    setNativeVolume: (volume) => void nativeSetVolume(volume).catch(() => undefined),
  })
  usePlayerV2Store.subscribe((state, previous) => {
    if (state.sleep !== previous.sleep) sleepRuntime.onTimerChange(previous.sleep, state.sleep)
  })

  // The sleep timer needs to know when another track starts (an "end of playlist" timer waits for the last one).
  usePlayerStore.subscribe((state, previous) => {
    if (state.currentSong?.number !== previous.currentSong?.number) sleepRuntime.onSongChange()
  })

  // Each recording starts at its own speed (or the listener's default), see stores/playbackPrefsStore.ts.
  usePlayerStore.subscribe((state, previous) => {
    const song = state.currentSong
    if (!song || song.number === previous.currentSong?.number) return
    const wanted = startRateOf(trackKeyOf(song))
    if (Math.abs(wanted - state.rate) > 1e-9) state.setRate(wanted)
  })

  // Smooth transitions: the fade lengths are in the playback settings; the radio has its own.
  setTransitionContext({
    getSeconds: () => {
      const prefs = usePlaybackPrefsStore.getState()
      return transitionSecondsFor({
        radio: isRadioRunning(usePlayerStore.getState()),
        radioSeconds: prefs.transitionRadioSeconds,
        listSeconds: prefs.transitionListSeconds,
      })
    },
    hasNext: () => {
      const s = usePlayerStore.getState()
      if (isRadioRunning(s)) return true
      const repeat = usePlayerV2Store.getState().repeatMode
      if (repeat === "one") return false
      if (repeat === "all") return true
      const numbers = activeQueue({
        currentSong: s.currentSong,
        queue: s.queue,
        playbackMode: s.playbackMode,
        playlistBounds: s.playlistBounds,
        position: s.position,
      })
      const at = numbers.indexOf(s.currentSong?.number ?? -1)
      return at >= 0 && at < numbers.length - 1
    },
    getRate: () => usePlayerStore.getState().rate,
  })

  const syncRepeat = createRepeatSync({
    getRepeatMode: () => usePlayerV2Store.getState().repeatMode,
    getEngineLoop: () => usePlayerStore.getState().repeat,
    toggleEngineLoop: () => usePlayerStore.getState().toggleRepeat(),
  })
  usePlayerV2Store.subscribe((state, previous) => {
    if (state.repeatMode !== previous.repeatMode) syncRepeat()
  })
  syncRepeat()

  const deps = { ...realControllerDeps(), sleep: sleepRuntime.controllerSleep }
  setTrackEndHook(createTrackEndHook(deps))

  resumeTracker = createResumeTracker({
    getEntry: (n) => useResumeStore.getState().get(n),
    record: (n, position, duration, versionId) => useResumeStore.getState().record(n, position, duration, versionId),
    // the late jump: the song started at 0 and is moved to its saved place (the start position below is the normal way)
    seekTo: (seconds) => {
      const number = usePlayerStore.getState().currentSong?.number
      if (number != null) useResumeNotice.getState().show(number, seconds)
      usePlayerStore.getState().seekTo(seconds)
    },
  })
  const observe = resumeTracker
  // A song stopped at 1:23 is handed to the native player already at 1:23: no moment of the beginning first.
  setStartPositionResolver((song) => {
    if (song.kind === "kiirtan") return 0
    const at = resumePositionFor(useResumeStore.getState().get(song.number), versionIdOf(song))
    if (at != null) useResumeNotice.getState().show(song.number, at)
    return at ?? 0
  })
  const feed = () => {
    const s = usePlayerStore.getState()
    const resumable = s.currentSong && s.currentSong.kind !== "kiirtan" ? s.currentSong : null
    observe({
      // resume points are for Prabhat Samgiita songs only
      songNumber: resumable ? resumable.number : null,
      versionId: resumable ? versionIdOf(resumable) : null,
      position: s.position,
      duration: s.duration,
      isPlaying: s.isPlaying,
      isBuffering: s.isBuffering,
    })
  }
  usePlayerStore.subscribe(feed)
  feed()

  // Long recordings (a Kiirtan of half an hour): remember the place and offer "Continue from ...", never jump.
  const observeLong = createLongResumeRecorder({
    getEntry: (n) => useResumeStore.getState().get(n),
    record: (n, position, duration) => useResumeStore.getState().record(n, position, duration, null),
    offer: (n, at) => useLongResumeOffer.getState().show(n, at),
    clearOffer: () => useLongResumeOffer.getState().clear(),
  })
  const feedLong = () => {
    const s = usePlayerStore.getState()
    const long = s.currentSong && s.currentSong.kind === "kiirtan" ? s.currentSong : null
    observeLong({
      songNumber: long ? long.number : null,
      position: s.position,
      duration: s.duration,
      isPlaying: s.isPlaying,
      isBuffering: s.isBuffering,
    })
  }
  usePlayerStore.subscribe(feedLong)
  feedLong()

  setInterval(() => {
    tickSleep({
      getTimer: () => usePlayerV2Store.getState().sleep,
      snapshot: () => {
        const s = usePlayerStore.getState()
        return {
          now: Date.now(),
          songNumber: s.currentSong?.number ?? null,
          position: s.position,
          duration: s.duration,
        }
      },
      pause: () => usePlayerStore.getState().pause(),
      rewind: () => usePlayerStore.getState().seekTo(0),
      cancel: () => usePlayerV2Store.getState().cancelSleep(),
      setFade: sleepRuntime.setFade,
    })
  }, 1000)
}

// Web preview with prototype data: the simulated player starts as soon as the app loads, so the
// Player tab and the mini player show the design's state from the first screen.
if (MOCKUP_DATA) installDemoPlayer(realControllerDeps())
