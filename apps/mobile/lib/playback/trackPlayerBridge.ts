/** Lazy RNTP load — RNTP v5 (New Architecture) is linked on both iOS and Android. */

let playbackServiceRegistered = false

export function isTrackPlayerLinked(): boolean {
  return true
}

export function ensurePlaybackServiceRegistered(): void {
  if (!isTrackPlayerLinked() || playbackServiceRegistered) return
  playbackServiceRegistered = true
  const TrackPlayer = require("react-native-track-player").default
  TrackPlayer.registerPlaybackService(() => require("../../playbackService").playbackService)
}

export function loadTrackPlayerModule(): typeof import("react-native-track-player") {
  if (!isTrackPlayerLinked()) {
    throw new Error("react-native-track-player is not linked on this platform")
  }
  ensurePlaybackServiceRegistered()
  return require("react-native-track-player")
}

export function getTrackPlayer(): typeof import("react-native-track-player").default {
  return loadTrackPlayerModule().default
}
