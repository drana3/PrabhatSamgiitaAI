import { demoSong } from "@/lib/fixtures/playerDemo"
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
import { createResumeTracker } from "@/lib/playerV2/resumeTracker"
import { tickSleep } from "@/lib/playerV2/sleepWatcher"
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
    loadNumber: (number) => (MOCKUP_DATA ? Promise.resolve(demoSong(number)) : hydratePlayableSong(number)),
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

let started = false

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
  const deps = realControllerDeps()
  setTrackEndHook(createTrackEndHook(deps))

  const observe = createResumeTracker({
    getEntry: (n) => useResumeStore.getState().get(n),
    record: (n, position, duration) => useResumeStore.getState().record(n, position, duration),
    seekTo: (seconds) => usePlayerStore.getState().seekTo(seconds),
  })
  const feed = () => {
    const s = usePlayerStore.getState()
    observe({
      songNumber: s.currentSong?.number ?? null,
      position: s.position,
      duration: s.duration,
      isPlaying: s.isPlaying,
      isBuffering: s.isBuffering,
    })
  }
  usePlayerStore.subscribe(feed)
  feed()

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
    })
  }, 1000)
}

// Web preview with prototype data: the simulated player starts as soon as the app loads, so the
// Player tab and the mini player show the design's state from the first screen.
if (MOCKUP_DATA) installDemoPlayer(realControllerDeps())
