/**
 * Volume leveling: how much a track is turned up or down so that every track is heard at about the
 * same loudness (docs/loudness-leveling.md). Pure: no React, no stores, no native code.
 *
 * Loudness is measured once on the server in LUFS (ITU-R BS.1770 / EBU R128, the unit streaming
 * services use) together with the true peak in dBTP. The phone only does arithmetic:
 *
 *     gain (dB) = reference level - the track's loudness
 *
 * A track at -9 LUFS with a reference of -18 gets -9 dB; a track at -22 gets +4 dB, as far as that
 * is safe. Two limits come from the sound itself:
 *
 *  - Turning DOWN is always safe.
 *  - Turning UP raises the peaks too. A track whose peak is at -2 dBTP can be raised by 1 dB only
 *    before it passes the ceiling of -1 dBTP and distorts, so the boost is cut to the room left.
 *
 * And one limit from the player: the native player's volume only goes from 0 to 1, never above the
 * file's own level. So on the phone the leveling can only turn down (`canBoost: false`), and the
 * reference is placed a few dB lower so that most tracks need only turning down (see
 * ATTENUATION_ONLY_DROP_DB). A player that can boost (the Web Audio engine) uses the full target.
 */

/** What a track is: music (Prabhat Samgiita, Kiirtan, Bhajan...) or speech (Baba's audio discourses). */
export type LoudnessClass = "music" | "speech"

/** Measured numbers of one recording. `truePeakDb` is null when it is not known. */
export type LoudnessInfo = { lufs: number; truePeakDb: number | null }

/**
 * Reference loudness of each class, in LUFS.
 *  - Music -14: Spotify's default (support.spotify.com, "Loudness normalization").
 *  - Speech -16: 2 LU below music. Speech at the same BS.1770 number sounds 2 to 3 LU louder than
 *    music (AES TD1008, as reported by Production Expert), and -16 LKFS is the Apple Podcasts level.
 *    A discourse that follows a Kiirtan therefore does not jump out of the speakers.
 */
export const TARGET_LUFS: Readonly<Record<LoudnessClass, number>> = { music: -14, speech: -16 }

/** Highest peak a boosted track may reach: Spotify keeps 1 dB for lossy encoding, EBU R128 says -1 dBTP. */
export const TRUE_PEAK_CEILING_DB = -1

/**
 * When the player can only turn down, the reference moves this far below the target (music -18,
 * speech -20; Spotify's own "Quiet" setting is -19). More tracks then sit above the reference and
 * can be brought exactly to it; tracks below it stay as they are.
 */
export const ATTENUATION_ONLY_DROP_DB = 4

/** A cut is never deeper than this (a broken measurement must not mute a track). */
export const MAX_CUT_DB = 24
/** A boost is never higher than this, whatever the peak allows. */
export const MAX_BOOST_DB = 12

export type LevelReason =
  /** the setting is off, or nothing is known about the track */
  | "off"
  | "unmeasured"
  /** turned down (or left alone, when it already sits on the reference) */
  | "matched"
  /** turned up to the reference */
  | "boosted"
  /** wanted a bigger boost, the peak left less room */
  | "peak-limited"
  /** wanted a boost the player cannot give (volume only goes down) */
  | "cannot-boost"

export type LevelInput = {
  /** the switch in the profile */
  enabled: boolean
  /** null when the track has not been measured */
  info: LoudnessInfo | null
  cls: LoudnessClass
  /** true for a player that can go above the file's level (Web Audio); false for the native volume */
  canBoost: boolean
}

export type LevelResult = {
  /** what to apply, in dB (negative: quieter) */
  gainDb: number
  /** the same as a multiplier for a volume or a gain node (10^(dB/20)) */
  gain: number
  reason: LevelReason
  /** the level the track is brought to, in LUFS; null when nothing is applied */
  referenceLufs: number | null
  /** how many dB short of the reference the track stays (0 when it reaches it) */
  shortfallDb: number
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20)
}

export function gainToDb(gain: number): number {
  return gain > 0 ? 20 * Math.log10(gain) : -Infinity
}

function round1(x: number): number {
  // keeps 0 as +0 (never -0) and avoids 1.2000000000000002 in readouts
  const r = Math.round(x * 10) / 10
  return r === 0 ? 0 : r
}

/** The reference loudness for a class on a player: the target, lowered when the player cannot boost. */
export function referenceLufs(cls: LoudnessClass, canBoost: boolean): number {
  return TARGET_LUFS[cls] - (canBoost ? 0 : ATTENUATION_ONLY_DROP_DB)
}

function neutral(reason: LevelReason): LevelResult {
  return { gainDb: 0, gain: 1, reason, referenceLufs: null, shortfallDb: 0 }
}

/** Is this a usable loudness number? Silence is reported by the meter as -70 LUFS or -inf. */
export function isUsableInfo(info: LoudnessInfo | null | undefined): info is LoudnessInfo {
  if (!info || !Number.isFinite(info.lufs)) return false
  if (info.lufs > 0 || info.lufs <= -70) return false
  return info.truePeakDb === null || Number.isFinite(info.truePeakDb)
}

export function computeLevel(input: LevelInput): LevelResult {
  if (!input.enabled) return neutral("off")
  if (!isUsableInfo(input.info)) return neutral("unmeasured")
  const { lufs, truePeakDb } = input.info
  const reference = referenceLufs(input.cls, input.canBoost)
  const wanted = reference - lufs

  if (wanted <= 0) {
    const gainDb = round1(Math.max(wanted, -MAX_CUT_DB))
    return { gainDb, gain: dbToGain(gainDb), reason: "matched", referenceLufs: reference, shortfallDb: 0 }
  }

  // The track is quieter than the reference.
  if (!input.canBoost) {
    return { gainDb: 0, gain: 1, reason: "cannot-boost", referenceLufs: reference, shortfallDb: round1(wanted) }
  }
  // Without a known peak there is no way to tell how much room there is: do not boost.
  const room = truePeakDb === null ? 0 : Math.max(0, TRUE_PEAK_CEILING_DB - truePeakDb)
  const gainDb = round1(Math.min(wanted, MAX_BOOST_DB, room))
  const reached = gainDb >= round1(wanted)
  return {
    gainDb,
    gain: dbToGain(gainDb),
    reason: reached ? "boosted" : "peak-limited",
    referenceLufs: reference,
    shortfallDb: reached ? 0 : round1(wanted - gainDb),
  }
}

/** The loudness a listener hears after the gain (for a readout and for the tests). */
export function loudnessAfter(info: LoudnessInfo, gainDb: number): number {
  return round1(info.lufs + gainDb)
}
