/**
 * Bar heights (percent of the bar area) of the Player's waveform. The catalog has
 * no peak data yet, so, as in the prototype, a seeded pseudo-random shape that is
 * the same for the same song every time, higher in the middle than at the ends.
 * TODO(api): replace with real peaks when the audio service provides them.
 */
export function waveformHeights(seed: number, count = 56): number[] {
  let r = seed * 9301 + 49297
  const heights: number[] = []
  for (let i = 0; i < count; i += 1) {
    r = (r * 9301 + 49297) % 233280
    const base = 0.28 + 0.72 * (r / 233280)
    const envelope = 0.55 + 0.45 * Math.sin((i / count) * Math.PI)
    heights.push(Math.round(Math.max(12, Math.min(100, base * envelope * 100))))
  }
  return heights
}
