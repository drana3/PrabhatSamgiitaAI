import type { LoudnessClass } from "@/lib/loudness/levels"

/**
 * Which time-stretch the engine uses when the speed is not 1. Only iOS reads this (react-native-track-player maps it to
 * AVAudioTimePitchAlgorithm); on Android the value is ignored and ExoPlayer always keeps the pitch.
 *  - keep pitch (default): "music" (spectral, best quality) for songs, "voice" (time domain, made for speech) for talks;
 *  - pitch follows speed: "linear" (varispeed, like a tape).
 * It is set when a track is handed to the player, so a change of the switch applies from the next track.
 */
export type PitchChoice = "linear" | "music" | "voice"

export function pitchChoiceFor(input: { keepPitch: boolean; cls?: LoudnessClass }): PitchChoice {
  if (!input.keepPitch) return "linear"
  return input.cls === "speech" ? "voice" : "music"
}

/** The player module's enum value for a choice, or undefined when the module has no such enum (tests, web). */
export function pitchEnumValue(module: { PitchAlgorithm?: Record<string, unknown> } | undefined, choice: PitchChoice): number | undefined {
  const table = module?.PitchAlgorithm
  if (!table) return undefined
  const key = choice === "linear" ? "Linear" : choice === "music" ? "Music" : "Voice"
  const value = table[key]
  return typeof value === "number" ? value : undefined
}
