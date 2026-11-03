import type { MockSong } from "@/data/mock"
import type { TrackEndHook } from "@/lib/playback/trackEndHook"
import type { PlaybackMode } from "@/lib/playbackQueue"
import {
  afterVersionEnd,
  effectivePlayMode,
  shouldHoldUpcoming,
  type PlayMode,
} from "@/lib/playerV2/versionMode"
import { stepPlayable } from "@/lib/playerV2/queueOps"
import {
  selectedVersionIndex,
  versionsFromSong,
  type PlayerVersion,
} from "@/lib/playerV2/versions"

export type RepeatMode = "off" | "all" | "one"

export function nextRepeatMode(mode: RepeatMode): RepeatMode {
  return mode === "off" ? "all" : mode === "all" ? "one" : "off"
}

/** Everything the controller needs from the outside world, so it can be tested without a device. */
export type ControllerDeps = {
  getPlayer: () => {
    currentSong: MockSong | null
    queue: number[]
    playbackMode: PlaybackMode
    playlistBounds: number[] | null
    position: number
  }
  getPrefs: () => {
    playMode: PlayMode
    repeatMode: RepeatMode
    versionByNumber: Record<string, string>
  }
  loadSong: (song: MockSong, queue: number[], mode: PlaybackMode) => void
  /** Resolve a catalog number to a playable song (offline first, then API). */
  loadNumber: (number: number) => Promise<MockSong | null>
  isPlayable: (number: number) => boolean
  remember: (songNumber: number, versionId: string) => void
  seekTo: (seconds: number) => void
}

/** The list that auto-advance walks: the saved playlist if there is one, otherwise the queue. */
export function activeQueue(player: ReturnType<ControllerDeps["getPlayer"]>): number[] {
  return player.playbackMode === "playlist" && player.playlistBounds?.length
    ? player.playlistBounds
    : player.queue
}

function loadMode(mode: PlaybackMode): PlaybackMode {
  return mode === "playlist" || mode === "random" ? mode : "default"
}

export function currentVersionState(deps: ControllerDeps) {
  const { currentSong } = deps.getPlayer()
  if (!currentSong) return null
  const prefs = deps.getPrefs()
  const versions = versionsFromSong(currentSong)
  const index = selectedVersionIndex(
    versions,
    currentSong.audioUrl,
    prefs.versionByNumber[String(currentSong.number)],
  )
  return {
    song: currentSong,
    versions,
    index,
    mode: effectivePlayMode(prefs.playMode, versions.length),
  }
}

/** Play one version of a song, keeping the queue and the session as they are. */
export function playVersion(deps: ControllerDeps, song: MockSong, version: PlayerVersion): void {
  const player = deps.getPlayer()
  deps.remember(song.number, version.id)
  deps.loadSong(
    { ...song, audioUrl: version.url, mediaHydrated: true },
    activeQueue(player),
    loadMode(player.playbackMode),
  )
}

export async function playNumber(deps: ControllerDeps, number: number): Promise<void> {
  const player = deps.getPlayer()
  const song = await deps.loadNumber(number)
  if (!song) return
  deps.loadSong(song, activeQueue(player), loadMode(player.playbackMode))
}

export function canGoNext(deps: ControllerDeps): boolean {
  const player = deps.getPlayer()
  if (!player.currentSong) return false
  if (player.playbackMode === "random") return true
  return (
    stepPlayable(
      activeQueue(player),
      player.currentSong.number,
      1,
      deps.isPlayable,
      deps.getPrefs().repeatMode === "all",
    ) != null
  )
}

export function canGoPrevious(deps: ControllerDeps): boolean {
  const player = deps.getPlayer()
  return Boolean(player.currentSong)
}

/** The Next button. Returns false when the caller should fall back to the store (drive random). */
export function goNext(deps: ControllerDeps): boolean {
  const player = deps.getPlayer()
  const current = player.currentSong
  if (!current || player.playbackMode === "random") return false
  const target = stepPlayable(
    activeQueue(player),
    current.number,
    1,
    deps.isPlayable,
    deps.getPrefs().repeatMode === "all",
  )
  if (target == null) return true
  void playNumber(deps, target)
  return true
}

/** Previous restarts the song when it is already past 3 seconds, as every player does. */
export function goPrevious(deps: ControllerDeps): boolean {
  const player = deps.getPlayer()
  const current = player.currentSong
  if (!current || player.playbackMode === "random") return false
  if (player.position > 3) {
    deps.seekTo(0)
    return true
  }
  const target = stepPlayable(
    activeQueue(player),
    current.number,
    -1,
    deps.isPlayable,
    deps.getPrefs().repeatMode === "all",
  )
  if (target == null) {
    deps.seekTo(0)
    return true
  }
  void playNumber(deps, target)
  return true
}

/**
 * What follows a finished track. Installed on the engine through setTrackEndHook.
 * Returns true when it started playback itself.
 */
export function createTrackEndHook(deps: ControllerDeps): TrackEndHook {
  return {
    shouldHoldUpcoming: () => {
      const state = currentVersionState(deps)
      if (!state) return false
      return shouldHoldUpcoming(state.mode, state.index, state.versions.length)
    },
    onTrackEnded: () => {
      const state = currentVersionState(deps)
      const player = deps.getPlayer()
      if (!state || player.playbackMode === "random") return false
      const prefs = deps.getPrefs()
      const queue = activeQueue(player)
      const action = afterVersionEnd({
        mode: state.mode,
        versionIndex: state.index,
        versionCount: state.versions.length,
        repeatOne: prefs.repeatMode === "one",
        repeatAll: prefs.repeatMode === "all",
        hasNextSong: stepPlayable(queue, state.song.number, 1, deps.isPlayable) != null,
      })
      switch (action.kind) {
        case "next-version": {
          const version = state.versions[action.index]
          if (!version) return false
          playVersion(deps, state.song, version)
          return true
        }
        case "next-song": {
          // A saved playlist advances inside the engine; we only step in for
          // casual queues (which never advanced) and for the wrap-around.
          if (!action.wrap && player.playbackMode === "playlist") return false
          const target = stepPlayable(queue, state.song.number, 1, deps.isPlayable, action.wrap)
          if (target == null) return false
          void playNumber(deps, target)
          return true
        }
        case "repeat-version":
        case "stop":
          return false
      }
    },
  }
}
