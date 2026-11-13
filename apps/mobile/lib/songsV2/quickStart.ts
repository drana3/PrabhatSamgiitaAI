import { playableNumbersList } from "@/lib/playableAudio"
import { buildShufflePlan, type PlayPlan } from "@/lib/songsV2/listPage"

/**
 * "Random Prabhat Samgiita" on the Mine segment: every song that has an official recording, in random
 * order, starting at the first. Null when the catalog lists no recording at all.
 */
export function buildQuickStartPlan(
  numbers: readonly number[] = playableNumbersList(),
  random: () => number = Math.random,
): PlayPlan | null {
  return buildShufflePlan(numbers, () => true, random)
}
