import type { LearningSong, PathState } from "@/lib/learn/progress"
import { songStatus, type SongStatus } from "@/lib/learn/songStatus"
import { songNumberOfId } from "@/lib/learn/learnSongs"

/**
 * The "Learning" and "Learned" chips of the Songs page, from what the Learn store keeps per song (pure, no React).
 *
 * What is stored per song: the learning list (`songs`, with the time each was started) and a path per song id (`paths`:
 * words, quiz, chords; lib/learn/progress.ts). The status of a path is ONE rule for the whole app, `songStatus` in
 * lib/learn/songStatus.ts (Not started, Learning, Learned; Words and Quiz decide it, Chords never do).
 *   Learned  = the status is "learned", whether or not the song is still on the list: finished stays finished.
 *   Learning = the song is on the learning list and is not learned. That includes the songs that are "Not started" yet
 *              (Dada, 10 Nov 2026, decision 14): they are on the person's list, so they are things to learn, and the Songs
 *              page is the only place besides Learn where a song that has no step done yet can be seen. A song with steps
 *              done but taken off the list is not "learning" any more, its steps stay for when it comes back.
 * Order: Learning, the song started most recently first. Learned, the one started most recently first when it is on the list,
 * then the others by number.
 */
export type LearnChipLists = { learning: number[]; learned: number[] }

/** What the chips do with each status: only "learned" leaves the Learning chip, "notStarted" stays in it. */
export function isInLearningChip(status: SongStatus): boolean {
  return status !== "learned"
}

export function classifyLearnSongs(
  songs: readonly LearningSong[],
  paths: Readonly<Record<string, PathState>>,
  statusOf: (path: PathState | undefined) => SongStatus = songStatus,
): LearnChipLists {
  const startedAt = new Map<number, number>()
  for (const song of songs) startedAt.set(song.number, song.startedAt)

  const learning: number[] = []
  const learned = new Set<number>()
  for (const song of songs) {
    if (!isInLearningChip(statusOf(paths[song.songId]))) learned.add(song.number)
    else if (!learning.includes(song.number)) learning.push(song.number)
  }
  for (const [songId, path] of Object.entries(paths)) {
    const number = songNumberOfId(songId)
    if (number != null && statusOf(path) === "learned") learned.add(number)
  }

  const byStart = (a: number, b: number) => (startedAt.get(b) ?? -Infinity) - (startedAt.get(a) ?? -Infinity) || a - b
  return { learning: learning.sort(byStart), learned: [...learned].sort(byStart) }
}
