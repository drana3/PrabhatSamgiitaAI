import { useCallback, useState } from "react"
import { useRouter } from "expo-router"

import type { CatalogEntry } from "@/lib/songsV2/entry"
import { appendToQueue, playAllPlan, queueToast } from "@/lib/songsV2/playAll"
import { hasPlayableAudio } from "@/lib/playableAudio"
import { starterSongForNumber } from "@/lib/playPlaylist"
import { shareSong } from "@/lib/shareSong"
import { usePlayerStore } from "@/stores/playerStore"
import { openSaveSheet } from "@/stores/saveSheetStore"
import { href } from "@/utils/href"

/** Actions shared by the Songs v2 lists: open, save, queue, share, play all. */
export function useSongsV2Actions() {
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)

  const flash = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast((current) => (current === message ? null : current)), 2200)
  }, [])

  const open = useCallback((entry: CatalogEntry) => router.push(href(`/song/ps-${entry.number}`)), [router])

  /** Opens the "Save to" sheet (Mine and playlists); the sheet asks to sign in when it has to. */
  const toggleSave = useCallback((entry: CatalogEntry) => openSaveSheet({ kind: "song", number: entry.number }), [])

  const queue = useCallback(
    (entry: CatalogEntry) => {
      const state = usePlayerStore.getState()
      flash(queueToast(state.queue, entry.number))
      state.setQueue(appendToQueue(state.queue, entry.number))
    },
    [flash],
  )

  const share = useCallback((entry: CatalogEntry) => {
    void shareSong({ number: entry.number, title: entry.title })
  }, [])

  const playAll = useCallback(
    (numbers: readonly number[]) => {
      const plan = playAllPlan(numbers, hasPlayableAudio)
      if (!plan) return
      usePlayerStore.getState().loadSong(starterSongForNumber(plan.start), plan.queue, "playlist")
    },
    [],
  )

  return { open, toggleSave, queue, share, playAll, toast }
}
