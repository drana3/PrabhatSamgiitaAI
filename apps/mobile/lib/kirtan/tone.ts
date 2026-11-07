import { amColors } from "@/constants/tokens/amColors"

/**
 * The gradient of a recording's TYPE (and kind), so the same colours run through the tab, the rows, the
 * pill and the player. Colours come from the existing palette (docs/ui-colour-system.md); no text sits on
 * them except white labels on the deep end of the gradient. Pure.
 */
export const KIIRTAN_TYPE_TONES: Record<string, readonly [string, string]> = {
  bnk: [amColors.orange500, amColors.orange700],
  lila: [amColors.sage700, amColors.sage900],
  festival: [amColors.gold500, amColors.orange600],
  other: [amColors.sage500, amColors.sage800],
  // Bhajan types (lib/kirtan/types BHAJAN_TYPES). "other" is shared with Kiirtans; see BHAJAN_OTHER_TONE.
  morning: [amColors.gold500, amColors.orange700],
  evening: [amColors.olive700, amColors.sage900],
  devotional: [amColors.orange800, amColors.sage800],
}

/** "Other" Bhajans: a darker green than "Other" Kiirtans, so the two kinds stay apart. */
export const BHAJAN_OTHER_TONE: readonly [string, string] = [amColors.sage700, amColors.ink900]

/** Prabhat Samgiita recordings have no sub-types, so the kind has one gradient of its own. */
export const PRABHAT_SAMGIITA_TONE: readonly [string, string] = [amColors.orange600, amColors.ink900]

/** Spiritual songs and Dance songs have no sub-types either: one gradient each, apart from the other three kinds. */
export const SPIRITUAL_SONG_TONE: readonly [string, string] = [amColors.olive700, amColors.sage800]
export const DANCE_SONG_TONE: readonly [string, string] = [amColors.gold500, amColors.orange800]

/** The gradient of a type. Give the kind so "other" Bhajans differ from "other" Kiirtans, and Prabhat Samgiita has its own. */
export function kiirtanTone(type: string | null | undefined, kind?: string | null): readonly [string, string] {
  if (kind === "prabhat_samgiita") return PRABHAT_SAMGIITA_TONE
  if (kind === "spiritual_song") return SPIRITUAL_SONG_TONE
  if (kind === "dance_song") return DANCE_SONG_TONE
  if (kind === "bhajan" && (type ?? "other") === "other") return BHAJAN_OTHER_TONE
  return KIIRTAN_TYPE_TONES[type ?? "other"] ?? KIIRTAN_TYPE_TONES.other
}

/** Same as kiirtanTone, named for callers that think in kinds. */
export const kindTone = kiirtanTone

