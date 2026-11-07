import { useCallback, useMemo } from "react"

import { useLearnHydrated } from "@/hooks/useLearnHydrated"
import { addSongToLearn, removeSongFromLearn, restoreSongToLearn, type AddSongResult } from "@/lib/learn/addSong"
import { listedNumbers } from "@/lib/learn/learnSongs"
import type { LearningSong } from "@/lib/learn/progress"
import { useLearnStore } from "@/stores/learnStore"

export { addSongToLearn, removeSongFromLearn, restoreSongToLearn, type AddSongResult }

/**
 * The songs the person is learning, as React state. Re-renders when the list changes.
 *
 *   const { has, add, remove } = useLearnSongs()
 *   has(7)            // true when PS 7 is on the list
 *   add(7, "Title")   // same as addSongToLearn(7, "Title")
 *   remove(7)         // takes it off, keeps its progress, returns the entry for Undo
 */
export function useLearnSongs() {
  const songs = useLearnStore((state) => state.songs)
  const hydrated = useLearnHydrated()
  const numbers = useMemo(() => listedNumbers(songs), [songs])
  const has = useCallback((songNumber: number) => numbers.has(songNumber), [numbers])
  const add = useCallback((songNumber: number, title?: string): AddSongResult => addSongToLearn(songNumber, title), [])
  const remove = useCallback((songNumber: number): LearningSong | null => removeSongFromLearn(songNumber), [])
  const restore = useCallback((song: LearningSong) => restoreSongToLearn(song), [])
  return { songs, numbers, count: songs.length, hydrated, has, add, remove, restore }
}
