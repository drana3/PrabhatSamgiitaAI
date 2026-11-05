import { catalogLyricRows } from "@/lib/lyricSearch"
import { learnSongId, isSongNumber } from "@/lib/learn/learnSongs"
import type { LearningSong } from "@/lib/learn/progress"
import { displayTitle } from "@/lib/songsV2/entry"
import { useLearnStore } from "@/stores/learnStore"

/**
 * The one way to put a song on the learner's list or take it off, for every screen: the Learn picker,
 * the "Learn this song" button on the song page, the Learn hub. They all end in the Learn store, so
 * the hub shows the change at once.
 */

export type AddSongResult =
  /** the song is on the list now */
  | { status: "added"; songNumber: number; songId: string; title: string }
  /** it was on the list already; nothing changed */
  | { status: "already"; songNumber: number; songId: string; title: string }
  /** the saved Learn state is still loading from the phone; the song is added the moment it is ready */
  | { status: "queued"; songNumber: number; songId: string; title: string }
  /** not a Prabhat Samgiita number (1 to 5018) */
  | { status: "invalid"; songNumber: number }

/** The title of a song from the song index that ships with the app, or "Prabhat Samgiita N". */
export function learnTitleFor(songNumber: number): string {
  const rows = catalogLyricRows()
  const row = rows[songNumber - 1]?.n === songNumber ? rows[songNumber - 1] : rows.find((entry) => entry.n === songNumber)
  return row?.t ? displayTitle(row.t) : `Prabhat Samgiita ${songNumber}`
}

/**
 * Add a song to Learn by its number. The title is looked up when you do not pass one (pass it when
 * the screen already has it). A song that is already there is left alone, and a song taken off earlier
 * comes back with the progress it had. Safe to call before the saved state has loaded.
 */
export function addSongToLearn(songNumber: number, title?: string): AddSongResult {
  if (!isSongNumber(songNumber)) return { status: "invalid", songNumber }
  const songId = learnSongId(songNumber)
  const name = title?.trim() || learnTitleFor(songNumber)
  const store = useLearnStore
  if (!store.persist.hasHydrated()) {
    // adding before the saved list is read would be overwritten by it; wait for it
    const off = store.persist.onFinishHydration(() => {
      off()
      store.getState().startLearning({ songId, number: songNumber, title: name })
    })
    return { status: "queued", songNumber, songId, title: name }
  }
  const status = store.getState().startLearning({ songId, number: songNumber, title: name })
  return { status: status === "added" ? "added" : "already", songNumber, songId, title: name }
}

/** Take a song off the list. Its progress and word cards stay saved. Returns the entry for Undo, or null. */
export function removeSongFromLearn(songNumber: number): LearningSong | null {
  const entry = useLearnStore.getState().songs.find((song) => song.number === songNumber) ?? null
  if (entry) useLearnStore.getState().stopLearning(entry.songId)
  return entry
}

/** Put a removed song back exactly as it was. */
export function restoreSongToLearn(song: LearningSong): void {
  useLearnStore.getState().restoreLearning(song)
}
