/**
 * Play all and Add to queue for the redesigned Songs lists. Pure: the screen
 * passes in what it knows about playable audio and the player's queue.
 */
export type PlayAllPlan = { start: number; queue: number[] }

/**
 * `Play all` plays the filtered list in the order shown. It starts at the
 * first song that has audio, or the first song when none is known to.
 * Returns null for an empty list.
 */
export function playAllPlan(
  numbers: readonly number[],
  hasAudio: (number: number) => boolean,
): PlayAllPlan | null {
  if (!numbers.length) return null
  const unique = numbers.filter((n, i) => numbers.indexOf(n) === i)
  const start = unique.find((n) => hasAudio(n)) ?? unique[0]
  return { start, queue: unique }
}

/** Appends a song to the end of the queue unless it is already there. */
export function appendToQueue(queue: readonly number[], number: number): number[] {
  return queue.includes(number) ? [...queue] : [...queue, number]
}

/** Message for the toast after a queue action. */
export function queueToast(queue: readonly number[], number: number): string {
  return queue.includes(number) ? `PS ${number} is already in the queue` : `Added PS ${number} to the queue`
}
