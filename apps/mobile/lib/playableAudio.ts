import playableNumbers from "@/assets/playable-audio-numbers.json"
import { isKiirtanNumber, kiirtanHasAudio } from "@/lib/kirtan/track"
import { MOCKUP_DATA } from "@/lib/mockupMode"

const PLAYABLE = new Set(playableNumbers as number[])
// The web preview uses the same list as the real build: a song "has audio" only if the catalog says so.
// (The preview simulates playback with a clock, but it never offers play on a song without a recording.)
const PLAYABLE_LIST = playableNumbers as number[]

function fallbackRandom(exclude: number, total = 5018): number {
  if (total <= 1) return 1
  let next = 1 + Math.floor(Math.random() * total)
  if (next === exclude) next = next === total ? 1 : next + 1
  return next
}

export function hasPlayableAudio(number: number): boolean {
  // A Kiirtan plays its uploaded file; the preview simulates playback, so every Kiirtan "has audio" there.
  if (isKiirtanNumber(number)) return MOCKUP_DATA || kiirtanHasAudio(number)
  return PLAYABLE.has(number)
}

export function playableAudioCount(): number {
  return PLAYABLE_LIST.length
}

/** Random PS with a known official audio file in corpus (~3.7k of 5018). */
export function randomPlayableSongNumber(exclude: number): number {
  if (!PLAYABLE_LIST.length) return fallbackRandom(exclude)
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const pick = PLAYABLE_LIST[Math.floor(Math.random() * PLAYABLE_LIST.length)]
    if (pick !== exclude) return pick
  }
  return PLAYABLE_LIST.find((n) => n !== exclude) ?? fallbackRandom(exclude)
}

export function nextPlayableInQueue(
  queue: number[],
  current: number,
  direction: 1 | -1,
): number | null {
  const index = queue.indexOf(current)
  if (index < 0) return null
  for (let step = 1; step < queue.length; step += 1) {
    const at = index + direction * step
    if (at < 0 || at >= queue.length) break
    const number = queue[at]
    if (!PLAYABLE_LIST.length || hasPlayableAudio(number)) return number
  }
  return null
}

/** Every PS number that has a known audio file, ascending. Do not mutate. */
export function playableNumbersList(): readonly number[] {
  return PLAYABLE_LIST
}
