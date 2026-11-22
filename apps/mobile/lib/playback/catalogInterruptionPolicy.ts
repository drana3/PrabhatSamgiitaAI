import type { RemoteDuckEvent } from "react-native-track-player"

export type CatalogInterruptionAction = "none" | "resume" | "stop"

/** User intent to keep catalog audio going (survives headless playback service). */
export function readCatalogWantPlaying(): boolean {
  const bag = globalThis as typeof globalThis & { __psWantPlaying?: boolean }
  return bag.__psWantPlaying === true
}

/**
 * Prefer mix/duck with Meet and other VoIP; only yield on permanent focus loss.
 * Transient "paused" signals are not treated as a user pause — RNTP may still duck volume.
 */
export function planCatalogInterruptionAction(
  event: RemoteDuckEvent,
  wantPlaying: boolean,
): CatalogInterruptionAction {
  if (!wantPlaying) return "none"
  if (event.permanent) return "stop"
  if (event.paused) return "none"
  return "resume"
}

/** Literal RNTP values — avoids requiring full module mocks in unit tests. */
export function catalogPlayerSetupOptions() {
  return {
    autoHandleInterruptions: false,
    androidAudioContentType: "music",
    iosCategory: "playback",
    iosCategoryOptions: [
      "mixWithOthers",
      "interruptSpokenAudioAndMixWithOthers",
      "allowBluetoothA2DP",
      "allowAirPlay",
    ],
  }
}

export function catalogPlayerAndroidUpdateOptions(
  AppKilledPlaybackBehavior: (typeof import("react-native-track-player"))["AppKilledPlaybackBehavior"],
) {
  return {
    appKilledPlaybackBehavior:
      AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
    alwaysPauseOnInterruption: false,
  }
}