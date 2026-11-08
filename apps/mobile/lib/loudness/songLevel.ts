import type { MockSong } from "@/data/mock"
import {
  computeLevel,
  type LevelResult,
  type LoudnessClass,
  type LoudnessInfo,
} from "@/lib/loudness/levels"

/** Loudness numbers as the API sends them (null or absent: not measured yet). */
export type LoudnessFields = {
  loudnessLufs?: number | null
  truePeakDb?: number | null
}

/** The class of a track: Baba's audio discourses are speech, everything else is music. */
export function loudnessClassOf(song: Pick<MockSong, "kiirtan"> | null | undefined): LoudnessClass {
  return song?.kiirtan?.recording === "baba_audio" ? "speech" : "music"
}

/** `{ lufs, truePeakDb }` from the two API fields, or null when the loudness is missing. */
export function loudnessInfoFrom(fields: LoudnessFields | null | undefined): LoudnessInfo | null {
  const lufs = fields?.loudnessLufs
  if (typeof lufs !== "number" || !Number.isFinite(lufs)) return null
  const peak = fields?.truePeakDb
  return { lufs, truePeakDb: typeof peak === "number" && Number.isFinite(peak) ? peak : null }
}

export function songLoudness(song: Pick<MockSong, "loudness"> | null | undefined): LoudnessInfo | null {
  const found = song?.loudness
  if (!found) return null
  return loudnessInfoFrom({ loudnessLufs: found.lufs, truePeakDb: found.truePeakDb })
}

export function levelForSong(
  song: Pick<MockSong, "loudness" | "kiirtan"> | null | undefined,
  options: { enabled: boolean; canBoost: boolean },
): LevelResult {
  return computeLevel({
    enabled: options.enabled,
    info: songLoudness(song),
    cls: loudnessClassOf(song),
    canBoost: options.canBoost,
  })
}
