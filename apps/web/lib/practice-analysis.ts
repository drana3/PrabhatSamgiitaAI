import type { TransposedNotation } from "@/lib/api"

export type PracticeStatus = "matched" | "needs_practice" | "insufficient_audio" | "reference_unavailable" | "analysis_error"

export type PracticeResult = {
  status: PracticeStatus
  isLikelyMatch: boolean
  score: number | null
  matchedNotes: number
  expectedNotes: number
  averageCents: number | null
  suggestions: string[]
}

export function unavailablePracticeResult(status: Exclude<PracticeStatus, "matched" | "needs_practice">, suggestion: string): PracticeResult {
  return { status, isLikelyMatch: false, score: null, matchedNotes: 0, expectedNotes: 0, averageCents: null, suggestions: [suggestion] }
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

export function extractPitchTrack(samples: Float32Array, sampleRate: number) {
  const windowSize = 2048
  const hop = 4096
  const sampleLimit = Math.min(samples.length, sampleRate * 45)
  const pitches: number[] = []
  for (let offset = 0; offset + windowSize < sampleLimit; offset += hop) {
    let mean = 0
    let rms = 0
    for (let index = 0; index < windowSize; index++) mean += samples[offset + index]
    mean /= windowSize
    for (let index = 0; index < windowSize; index++) rms += (samples[offset + index] - mean) ** 2
    if (Math.sqrt(rms / windowSize) < 0.012) continue

    const minLag = Math.floor(sampleRate / 800)
    const maxLag = Math.min(windowSize - 1, Math.floor(sampleRate / 80))
    const correlations: number[] = []
    for (let lag = minLag; lag <= maxLag; lag++) {
      let cross = 0
      let energyA = 0
      let energyB = 0
      for (let index = 0; index < windowSize - lag; index += 4) {
        const left = samples[offset + index] - mean
        const right = samples[offset + index + lag] - mean
        cross += left * right
        energyA += left * left
        energyB += right * right
      }
      const correlation = cross / Math.sqrt(Math.max(energyA * energyB, Number.EPSILON))
      correlations.push(correlation)
    }
    let bestLag = 0
    for (let index = 1; index < correlations.length - 1; index++) {
      const correlation = correlations[index]
      if (correlation >= 0.72 && correlation >= correlations[index - 1] && correlation >= correlations[index + 1]) {
        bestLag = minLag + index
        break
      }
    }
    if (bestLag) {
      pitches.push(69 + 12 * Math.log2((sampleRate / bestLag) / 440))
    }
  }
  return medianSmooth(pitches, 5)
}

export function comparePitchSequence(observed: number[], expected: number[]): PracticeResult {
  const observedContour = prepareContour(observed)
  const expectedContour = prepareContour(expected)
  if (observedContour.length < 4) {
    return unavailablePracticeResult("insufficient_audio", "Sing a clear 10 to 30 second phrase, away from background noise, so the melody can be measured.")
  }
  if (expectedContour.length < 3) {
    return unavailablePracticeResult("reference_unavailable", "This song does not yet have enough reference notes for a responsible comparison.")
  }

  const observedMedian = median(observedContour)
  const expectedMedian = median(expectedContour)
  const normalizedObserved = observedContour.map((note) => note - observedMedian)
  const normalizedExpected = expectedContour.map((note) => note - expectedMedian)
  const averageSemitones = dynamicTimeWarpingError(normalizedObserved, normalizedExpected)
  const matchedNotes = normalizedExpected.filter((note) => normalizedObserved.some((candidate) => Math.abs(candidate - note) <= 0.75)).length
  const score = Math.max(1, Math.min(100, Math.round(100 * Math.exp(-averageSemitones / 1.45))))
  const isLikelyMatch = score >= 45 && matchedNotes >= Math.min(3, normalizedExpected.length)
  const status: PracticeStatus = isLikelyMatch ? "matched" : "needs_practice"
  const suggestions: string[] = []

  if (!isLikelyMatch) suggestions.push("The melodic contour is not close enough yet to confirm this rendition. Try one short line while listening to the reference first.")
  if (isLikelyMatch && averageSemitones > 0.45) suggestions.push("The overall melody is recognizable. Slow down and steady the held notes for a closer match.")
  if (isLikelyMatch && averageSemitones <= 0.45) suggestions.push("The melodic contour is close. Practise once more slowly for steadier held notes.")
  return {
    status,
    isLikelyMatch,
    score,
    matchedNotes,
    expectedNotes: normalizedExpected.length,
    averageCents: Math.round(averageSemitones * 100),
    suggestions,
  }
}

function prepareContour(values: number[]) {
  const finite = medianSmooth(values.filter((value) => Number.isFinite(value) && value >= 24 && value <= 108), 3)
  const collapsed: number[] = []
  for (const value of finite) {
    const previous = collapsed.at(-1)
    if (previous === undefined || Math.abs(previous - value) >= 0.3) collapsed.push(value)
    else collapsed[collapsed.length - 1] = (previous + value) / 2
  }
  if (collapsed.length <= 160) return collapsed
  return Array.from({ length: 160 }, (_, index) => collapsed[Math.round(index * (collapsed.length - 1) / 159)])
}

function dynamicTimeWarpingError(observed: number[], expected: number[]) {
  const rows = expected.length + 1
  const columns = observed.length + 1
  const costs = Array.from({ length: rows }, () => new Float64Array(columns).fill(Number.POSITIVE_INFINITY))
  const lengths = Array.from({ length: rows }, () => new Uint16Array(columns))
  costs[0][0] = 0
  for (let row = 1; row < rows; row++) {
    for (let column = 1; column < columns; column++) {
      const options = [
        { cost: costs[row - 1][column - 1], length: lengths[row - 1][column - 1] },
        { cost: costs[row - 1][column] + 0.08, length: lengths[row - 1][column] },
        { cost: costs[row][column - 1] + 0.08, length: lengths[row][column - 1] },
      ]
      const best = options.reduce((left, right) => left.cost <= right.cost ? left : right)
      costs[row][column] = best.cost + Math.abs(expected[row - 1] - observed[column - 1])
      lengths[row][column] = best.length + 1
    }
  }
  return costs[rows - 1][columns - 1] / Math.max(1, lengths[rows - 1][columns - 1])
}

function medianSmooth(values: number[], width: number) {
  const radius = Math.floor(width / 2)
  return values.map((_, index) => median(values.slice(Math.max(0, index - radius), index + radius + 1)))
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
