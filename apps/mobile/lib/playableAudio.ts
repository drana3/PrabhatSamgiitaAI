import playableNumbers from "@/assets/playable-audio-numbers.json"
import { DEMO_CATALOG_COUNT, demoNumbers } from "@/lib/fixtures/playerDemo"
import { isKiirtanNumber, kiirtanHasAudio } from "@/lib/kirtan/track"
import { MOCKUP_DATA } from "@/lib/mockupMode"

const PLAYABLE = new Set(playableNumbers as number[])
// Web preview with prototype data: every song of the design plays (simulated), the list is the design's 64.
const PLAYABLE_LIST = MOCKUP_DATA ? demoNumbers() : (playableNumbers as number[])

function fallbackRandom(exclude: number, total = 5018): number {
  if (total <= 1) return 1
  let next = 1 + Math.floor(Math.random() * total)
  if (next === exclude) next = next === total ? 1 : next + 1
  return next
}

export function hasPlayableAudio(number: number): boolean {
  // A Kiirtan plays its uploaded file; the preview simulates playback, so every Kiirtan "has audio" there.
  if (isKiirtanNumber(number)) return MOCKUP_DATA || kiirtanHasAudio(number)
  if (MOCKUP_DATA) return number >= 1 && number <= DEMO_CATALOG_COUNT
  return PLAYABLE.has(number)
}

export function playableAudioCount(): number {
  return MOCKUP_DATA ? DEMO_CATALOG_COUNT : PLAYABLE_LIST.length
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
