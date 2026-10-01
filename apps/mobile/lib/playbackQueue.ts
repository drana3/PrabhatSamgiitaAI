export type PlaybackMode = "default" | "playlist" | "random"

/** Another catalog number, skipping the song that just played when possible. */
export function randomSongNumber(exclude: number, total = 5018): number {
  if (total <= 1) return 1
  let next = 1 + Math.floor(Math.random() * total)
  if (next === exclude) next = next === total ? 1 : next + 1
  return next
}

/** Next or previous number inside a playlist. Null means the playlist has no further song. */
export function playlistStep(current: number, queue: number[], direction: 1 | -1): number | null {
  const index = queue.indexOf(current)
  if (index < 0) return direction > 0 ? (queue[0] ?? null) : null
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= queue.length) return null
  return queue[nextIndex] ?? null
}
