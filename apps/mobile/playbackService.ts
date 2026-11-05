import TrackPlayer, { Event } from "react-native-track-player"

import { ensureUpcomingRadioTrack } from "./lib/playback/radioAdvance"
import { createRemoteHandlers } from "./lib/playback/remoteCommands"

type PlayerStoreModule = typeof import("./stores/playerStore")
type TransportModule = typeof import("./lib/playerV2/transport")

export type ServiceAccess = {
  /** The app's player store, when the JS side has one (a cold headless service may not). */
  playerStore: () => PlayerStoreModule["usePlayerStore"] | null
  transport: () => TransportModule | null
}

const defaultAccess: ServiceAccess = {
  playerStore: () => {
    try {
      return (require("./stores/playerStore") as PlayerStoreModule).usePlayerStore
    } catch {
      return null
    }
  },
  transport: () => {
    try {
      return require("./lib/playerV2/transport") as TransportModule
    } catch {
      return null
    }
  },
}

/**
 * Headless service: lock screen, headphones, car, Android notification.
 * Every command goes through the same app-level actions as the on-screen
 * buttons, so the UI state follows the sound (and never the other way round).
 */
export async function playbackService(access: ServiceAccess = defaultAccess) {
  const playerStore = access.playerStore
  const transport = access.transport
  const remote = createRemoteHandlers({
    hasSong: () => Boolean(playerStore()?.getState().currentSong),
    isPlaying: () => Boolean(playerStore()?.getState().isPlaying),
    appPlay: () => playerStore()?.getState().play(),
    appPause: () => playerStore()?.getState().pause(),
    appNext: () => {
      const t = transport()
      if (t) t.skipToNextSong()
      else playerStore()?.getState().next()
    },
    appPrevious: () => {
      const t = transport()
      if (t) t.skipToPreviousSong()
      else playerStore()?.getState().previous()
    },
    appSeek: (seconds) => playerStore()?.getState().seekTo(seconds),
    nativePlay: () => TrackPlayer.play(),
    nativePause: () => TrackPlayer.pause(),
    nativeStop: () => TrackPlayer.stop(),
    nativeSeek: (seconds) => TrackPlayer.seekTo(seconds),
    nativeNext: () => TrackPlayer.skipToNext(),
    nativePrevious: () => TrackPlayer.skipToPrevious(),
  })

  TrackPlayer.addEventListener(Event.RemotePlay, remote.onPlay)
  TrackPlayer.addEventListener(Event.RemotePause, remote.onPause)
  TrackPlayer.addEventListener(Event.RemoteStop, remote.onStop)
  TrackPlayer.addEventListener(Event.RemoteNext, remote.onNext)
  TrackPlayer.addEventListener(Event.RemotePrevious, remote.onPrevious)
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    if (typeof event.position === "number") remote.onSeek(event.position)
  })
  // Only delivered when the system does not auto-handle interruptions; harmless otherwise.
  if (Event.RemoteDuck) {
    TrackPlayer.addEventListener(Event.RemoteDuck, (event) => remote.onDuck(event))
  }
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, () => {
    void ensureUpcomingRadioTrack()
  })
}
