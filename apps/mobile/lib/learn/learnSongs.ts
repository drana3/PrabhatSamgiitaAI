import { EMPTY_PATH, type LearningSong, type PathState } from "@/lib/learn/progress"

/**
 * The rules of "which songs am I learning", with no React and no storage, so they are tested.
 * The Learn model today: a list of songs, any number of them, each with its own three-step path.
 * There is no single "active" song yet (docs/learn-system.md proposes one; it is not built), so
 * adding a song never replaces another one, and removing a song keeps its saved progress.
 */

/** Prabhat Samgiita has 5,018 numbered songs. */
export const PS_SONG_COUNT = 5018

export type LearnSongInput = { number: number; title: string }

export function isSongNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= PS_SONG_COUNT
}

/** `ps-7`: the id the Learn store, the song path route and the song page share. */
export function learnSongId(number: number): string {
  return `ps-${number}`
}

/** 7 from `ps-7`, or null. */
export function songNumberOfId(songId: string): number | null {
  const match = /^ps-(\d+)$/i.exec(songId.trim())
  if (!match) return null
  const number = Number(match[1])
  return isSongNumber(number) ? number : null
}

export function listedNumbers(songs: readonly LearningSong[]): Set<number> {
  return new Set(songs.map((song) => song.number))
}

export function isListed(songs: readonly LearningSong[], number: number): boolean {
  return songs.some((song) => song.number === number)
}

export type AddStatus = "added" | "already" | "invalid"

export type AddPlan = {
  status: AddStatus
  songs: LearningSong[]
  paths: Record<string, PathState>
}

/**
 * Put a song on the list. A song already there is left alone (its start time and progress stay).
 * The path of a song that was removed earlier is kept, so adding it again brings its progress back.
 */
export function planAddSong(
  songs: readonly LearningSong[],
  paths: Readonly<Record<string, PathState>>,
  input: LearnSongInput,
  now: number,
): AddPlan {
  if (!isSongNumber(input.number)) return { status: "invalid", songs: [...songs], paths: { ...paths } }
  const songId = learnSongId(input.number)
  if (songs.some((song) => song.songId === songId)) return { status: "already", songs: [...songs], paths: { ...paths } }
  const title = input.title.trim() || `Prabhat Samgiita ${input.number}`
  return {
    status: "added",
    songs: [...songs, { songId, number: input.number, title, startedAt: now }],
    paths: { ...paths, [songId]: paths[songId] ?? EMPTY_PATH },
  }
}

export type RemovePlan = {
  status: "removed" | "absent"
  songs: LearningSong[]
  /** the entry that was taken off, so the screen can offer Undo */
  removed: LearningSong | null
}

/** Take a song off the list. Its path and word cards are not touched. */
export function planRemoveSong(songs: readonly LearningSong[], number: number): RemovePlan {
  const removed = songs.find((song) => song.number === number) ?? null
  if (!removed) return { status: "absent", songs: [...songs], removed: null }
  return { status: "removed", songs: songs.filter((song) => song.number !== number), removed }
}

/** Put a song back as it was (Undo): same start time, so its place in the list does not change. */
export function planRestoreSong(
  songs: readonly LearningSong[],
  paths: Readonly<Record<string, PathState>>,
  song: LearningSong,
): AddPlan {
  if (songs.some((entry) => entry.songId === song.songId)) return { status: "already", songs: [...songs], paths: { ...paths } }
  return {
    status: "added",
    songs: [...songs, song],
    paths: { ...paths, [song.songId]: paths[song.songId] ?? EMPTY_PATH },
  }
}
