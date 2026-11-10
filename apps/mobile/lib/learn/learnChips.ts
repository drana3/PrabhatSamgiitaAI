import { songLibraryState, type LearningSong, type PathState } from "@/lib/learn/progress"
import { songNumberOfId } from "@/lib/learn/learnSongs"

/**
 * The "Learning" and "Learned" chips of the Songs page, from what the Learn store keeps per song (pure, no React).
 *
 * What is stored per song: the learning list (`songs`, with the time each was started) and a three-step path per song id
 * (`paths`: listen, words, chords; lib/learn/progress.ts). So per-song progress exists and nothing new is needed.
 *   Learned  = the three steps are done (the existing rule, `songLibraryState === "learned"`), whether or not the song is
 *              still on the list: finished stays finished.
 *   Learning = the song is on the learning list and is not learned yet (started: the person put it on the list; a song
 *              with some steps done but taken off the list is not "learning" any more, its steps stay for when it comes back).
 * Order: Learning, the song started most recently first. Learned, the one started most recently first when it is on the list,
 * then the others by number.
 */
export type LearnChipLists = { learning: number[]; learned: number[] }

export function classifyLearnSongs(
  songs: readonly LearningSong[],
  paths: Readonly<Record<string, PathState>>,
): LearnChipLists {
  const startedAt = new Map<number, number>()
  for (const song of songs) startedAt.set(song.number, song.startedAt)

  const learning: number[] = []
  const learned = new Set<number>()
  for (const song of songs) {
    if (songLibraryState(paths[song.songId]) === "learned") learned.add(song.number)
    else if (!learning.includes(song.number)) learning.push(song.number)
  }
  for (const [songId, path] of Object.entries(paths)) {
    const number = songNumberOfId(songId)
    if (number != null && songLibraryState(path) === "learned") learned.add(number)
  }

  const byStart = (a: number, b: number) => (startedAt.get(b) ?? -Infinity) - (startedAt.get(a) ?? -Infinity) || a - b
  return { learning: learning.sort(byStart), learned: [...learned].sort(byStart) }
}
