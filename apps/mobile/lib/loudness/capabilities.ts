/**
 * What each player can do for volume leveling. One answer per kind of player, so the rest of the
 * code asks "can it boost?" and never "is this a phone?".
 *
 *  - `native-volume`: the phone (react-native-track-player). Volume goes 0 to 1 only, so tracks are
 *    turned DOWN to the reference, never up. One track follows the next gaplessly from the native
 *    queue; the level is handed over at the join. No overlap (the player holds one track at a time).
 *  - `web-audio`: a browser with the Web Audio API (lib/loudness/webAudioEngine.ts). Gain nodes can
 *    go above 1, so quiet tracks are raised up to the true-peak ceiling, and two tracks can overlap
 *    for an equal-power crossfade.
 *  - `demo`: the web preview of the redesign. It has no sound at all (the player is simulated, see
 *    lib/playerV2/demoEngine.ts); the settings screen shows what the phone would do.
 */
export type LevelingEngine = "native-volume" | "web-audio" | "demo"

export type LevelingCapabilities = {
  engine: LevelingEngine
  /** can raise a track above the level of its file */
  canBoost: boolean
  /** can play two tracks at once for a crossfade */
  canCrossfade: boolean
  /** can play the next track with no gap (preloaded) */
  gapless: boolean
}

export const NATIVE_CAPABILITIES: LevelingCapabilities = {
  engine: "native-volume",
  canBoost: false,
  canCrossfade: false,
  gapless: true,
}

export const WEB_AUDIO_CAPABILITIES: LevelingCapabilities = {
  engine: "web-audio",
  canBoost: true,
  canCrossfade: true,
  gapless: true,
}

export const DEMO_CAPABILITIES: LevelingCapabilities = {
  // the preview shows the PHONE's behaviour (it is a model of the app, with no sound)
  ...NATIVE_CAPABILITIES,
  engine: "demo",
}

export function capabilitiesFor(input: { platform: string | undefined; mockup: boolean }): LevelingCapabilities {
  if (input.platform === "web") return input.mockup ? DEMO_CAPABILITIES : WEB_AUDIO_CAPABILITIES
  return NATIVE_CAPABILITIES
}
