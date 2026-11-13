/**
 * The piano sound bank: 14 samples of the Salamander Grand Piano (Alexander Holm, CC BY 3.0), every minor third from A2
 * to C6, about 0.9 MB in all. Licence and source: assets/audio/piano/LICENSE.txt. The keys between two samples are made
 * by playing the nearest one faster or slower (at most three semitones). Keys are named by MIDI number.
 */
export const PIANO_SAMPLE_MODULES: ReadonlyArray<{ midi: number; module: number }> = [
  { midi: 45, module: require("../assets/audio/piano/A2.mp3") },
  { midi: 48, module: require("../assets/audio/piano/C3.mp3") },
  { midi: 51, module: require("../assets/audio/piano/Ds3.mp3") },
  { midi: 54, module: require("../assets/audio/piano/Fs3.mp3") },
  { midi: 57, module: require("../assets/audio/piano/A3.mp3") },
  { midi: 60, module: require("../assets/audio/piano/C4.mp3") },
  { midi: 63, module: require("../assets/audio/piano/Ds4.mp3") },
  { midi: 66, module: require("../assets/audio/piano/Fs4.mp3") },
  { midi: 69, module: require("../assets/audio/piano/A4.mp3") },
  { midi: 72, module: require("../assets/audio/piano/C5.mp3") },
  { midi: 75, module: require("../assets/audio/piano/Ds5.mp3") },
  { midi: 78, module: require("../assets/audio/piano/Fs5.mp3") },
  { midi: 81, module: require("../assets/audio/piano/A5.mp3") },
  { midi: 84, module: require("../assets/audio/piano/C6.mp3") },
]

/** The sample that plays a key, and how fast to play it: `rate` 2^(semitones / 12). Null when the key is out of reach. */
export function sampleFor(midi: number): { sampleMidi: number; rate: number } | null {
  let best: number | null = null
  for (const { midi: m } of PIANO_SAMPLE_MODULES) {
    if (best === null || Math.abs(m - midi) < Math.abs(best - midi)) best = m
  }
  if (best === null || Math.abs(best - midi) > 3) return null
  return { sampleMidi: best, rate: Math.pow(2, (midi - best) / 12) }
}
