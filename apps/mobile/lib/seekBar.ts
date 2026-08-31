/** Map a touch X (inside the bar) to a playback time. */
export function seekSecondsFromTouch(x: number, barWidth: number, duration: number) {
  const max = Math.max(1, duration)
  if (barWidth <= 0) return 0
  const ratio = Math.min(1, Math.max(0, x / barWidth))
  return ratio * max
}
