import type { TransposedNotation } from "@/lib/api"

export type PracticeResult = {
  isLikelyMatch: boolean
  score: number
  matchedNotes: number
  expectedNotes: number
  averageCents: number
  suggestions: string[]
}

export function midiFromWestern(note: string) {
  const match = note.match(/^([A-G])(#?)(-?\d+)$/)
  if (!match) return null
  const semitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  return (Number(match[3]) + 1) * 12 + semitones[match[1]] + (match[2] ? 1 : 0)
}

export function expectedMidi(notation: TransposedNotation) {
  return notation.notation.lines.flatMap((line) => line.measures.flatMap((measure) => measure.beats.flatMap((beat) => beat.notes.map((note) => note.western ? midiFromWestern(note.western) : null).filter((value): value is number => value !== null))))
}

export function comparePitchSequence(observed: number[], expected: number[]): PracticeResult {
  if (observed.length < 3 || expected.length < 3) return { isLikelyMatch: false, score: 0, matchedNotes: 0, expectedNotes: expected.length, averageCents: 0, suggestions: ["Sing a little longer so this Prabhat Samgiita melody can be identified."] }
  const shift = median(observed) - median(expected)
  const errors = expected.map((note, index) => {
    const observedIndex = Math.min(observed.length - 1, Math.round(index * (observed.length - 1) / Math.max(1, expected.length - 1)))
    return observed[observedIndex] - (note + shift)
  })
  const averageSemitones = errors.reduce((total, value) => total + Math.abs(value), 0) / errors.length
  const matchedNotes = errors.filter((value) => Math.abs(value) <= 0.75).length
  const score = Math.max(0, Math.round(100 * (1 - Math.min(1, averageSemitones / 3))))
  const isLikelyMatch = score >= 35 && matchedNotes >= Math.min(3, expected.length)
  const suggestions: string[] = []
  const sharp = errors.filter((value) => value > 0.75).length
  const flat = errors.filter((value) => value < -0.75).length
  if (!isLikelyMatch) suggestions.push("This audio does not appear to match the selected Prabhat Samgiita. Choose the correct song or try the recording again.")
  if (isLikelyMatch && sharp > errors.length * 0.25) suggestions.push("A few phrases rise above the reference. Relax into the note and approach it gently.")
  if (isLikelyMatch && flat > errors.length * 0.25) suggestions.push("A few phrases sit below the reference. Support the breath and lift the pitch slightly.")
  if (!suggestions.length) suggestions.push("The melodic contour is close. Practise once more slowly for steadier held notes.")
  return { isLikelyMatch, score, matchedNotes, expectedNotes: expected.length, averageCents: Math.round(averageSemitones * 100), suggestions }
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
