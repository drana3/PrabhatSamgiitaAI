import { HARMONIUM_TONICS } from "@prabhat/core"

/**
 * The arithmetic of the piano keyboard. A step holds semitones above Sa; the reader's Sa turns them into keys.
 * Easy keys (the default) put Sa on C, so the shuddha swaras are the white keys.
 */
export const EASY_SA = "C"
export const SA_NAMES: readonly string[] = HARMONIUM_TONICS
/** Middle C in MIDI: Sa on C sounds here. */
export const MIDDLE_C = 60

/** Names of the 12 swaras by semitones above Sa, as the song page prints them. */
export const SWARA_NAMES = ["Sa", "re", "Re", "ga", "Ga", "Ma", "Ma#", "Pa", "dha", "Dha", "ni", "Ni"] as const
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const
const WHITE_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11])

export const mod12 = (n: number) => ((n % 12) + 12) % 12

/** MIDI number of Sa (middle octave) for a note name; an unknown name falls back to C. */
export function saMidi(sa: string): number {
  const index = SA_NAMES.indexOf(sa)
  return MIDDLE_C + (index < 0 ? 0 : index)
}

/** The Sa the reader plays with: C while easy keys are on, else the one picked. */
export function effectiveSa(reader: { easy: boolean; sa: string }): string {
  return reader.easy ? EASY_SA : SA_NAMES.includes(reader.sa) ? reader.sa : EASY_SA
}

export function keyMidi(k: number, sa: string): number {
  return saMidi(sa) + k
}

export function isWhiteKey(midi: number): boolean {
  return WHITE_PITCH_CLASSES.has(mod12(midi))
}

/** `C#4` for the sound bank (middle C is C4). */
export function westernOfMidi(midi: number): string {
  return `${SHARP_NAMES[mod12(midi)]}${Math.floor(midi / 12) - 1}`
}

export function noteNameOfMidi(midi: number): string {
  return SHARP_NAMES[mod12(midi)]!
}

/** The swara printed on a key, for the Sa in use. */
export function swaraOfMidi(midi: number, sa: string): string {
  return SWARA_NAMES[mod12(midi - saMidi(sa))]!
}

/** `Sa`, `Re'` (an octave up) or `.Pa` (an octave down): the way the text line writes a key. */
export function swaraText(k: number): string {
  const octave = Math.floor(k / 12)
  const base = SWARA_NAMES[mod12(k)]!
  return octave > 0 ? `${base}${"'".repeat(octave)}` : octave < 0 ? `${".".repeat(-octave)}${base}` : base
}

/** True when every key of the steps is a white key for this Sa (the sheet plays on the white keys). */
export function whiteOnly(steps: ReadonlyArray<{ k: number[] }>, sa: string): boolean {
  return steps.every((step) => step.k.every((k) => isWhiteKey(keyMidi(k, sa))))
}

export type KeyboardWindow = { start: number; end: number }

/**
 * The part of the keyboard to draw: from the C under the lowest key to the B over the highest, two octaves at least,
 * three at most (a sheet that wanders wider scrolls). Without any key: the two octaves that start at middle C.
 */
export function windowFor(midis: readonly number[]): KeyboardWindow {
  if (midis.length === 0) return { start: MIDDLE_C, end: MIDDLE_C + 23 }
  const low = Math.min(...midis)
  const high = Math.max(...midis)
  const start = low - mod12(low)
  const octaves = Math.max(2, Math.ceil((high - start + 1) / 12))
  return { start, end: start + octaves * 12 - 1 }
}
