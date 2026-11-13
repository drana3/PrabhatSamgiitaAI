import AsyncStorage from "@react-native-async-storage/async-storage"
import { useEffect } from "react"

import { PlayTracker } from "@/lib/authors/plays"
import { watchRadioSelection } from "@/lib/radio/applyChange"
import "@/lib/radio/live" // installs the Radio picker (the chosen categories); this host is mounted once at the root
import { demoHistory } from "@/lib/fixtures/searchMenuDemo"
import { kirtanById } from "@/lib/kirtan/catalog"
import { entryFromTrack, trackKey } from "@/lib/listening/capture"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useListeningHistoryStore } from "@/stores/listeningHistoryStore"
import { usePlayerStore } from "@/stores/playerStore"

/**
 * Mounted once at the root (app/_layout.tsx), draws nothing. It WATCHES the one player and never changes it. When a
 * track has been heard long enough to count (the same rule as an author's statistics, lib/authors/plays.ts) it adds ONE
 * entry to the local listening history (stores/listeningHistoryStore.ts). Songs and recordings both count here. Nothing
 * is sent anywhere. While the history is paused the store ignores the entry. Works in the preview too.
 */
const SEEDED_KEY = "prabhat-listening-history-demo-seeded"

export function ListeningHistoryHost() {
  // A change of the chosen categories (or of the blocked authors) while the Radio plays reaches the track queued next, on
  // whatever screen the person is: the Radio no longer stops when its screen is left.
  useEffect(() => watchRadioSelection(), [])

  // Preview only: a sample history once, so the screen can be seen filled. Clearing it afterwards stays cleared.
  useEffect(() => {
    if (!MOCKUP_DATA) return undefined
    let live = true
    const seed = async () => {
      try {
        if ((await AsyncStorage.getItem(SEEDED_KEY)) || !live) return
        await AsyncStorage.setItem(SEEDED_KEY, "1")
      } catch {
        return
      }
      const store = useListeningHistoryStore.getState()
      if (!store.entries.length) for (const entry of [...demoHistory("grown", Date.now())].reverse()) store.add(entry)
    }
    const run = () => void seed()
    if (useListeningHistoryStore.persist.hasHydrated()) run()
    const off = useListeningHistoryStore.persist.onFinishHydration(run)
    return () => {
      live = false
      off()
    }
  }, [])

  useEffect(() => {
    const tracker = new PlayTracker((event) => {
      const song = usePlayerStore.getState().currentSong
      if (!song || trackKey(song) !== event.recording_id) return
      const facts = song.kiirtan?.id ? kirtanById(song.kiirtan.id) : null
      const entry = entryFromTrack(song, Date.parse(event.played_at) || Date.now(), facts ? { kind: facts.kind, language: facts.language, author: facts.author, title: facts.title } : null)
      if (entry) useListeningHistoryStore.getState().add(entry)
    })
    return usePlayerStore.subscribe((state) => {
      tracker.feed({
        recordingId: trackKey(state.currentSong),
        playing: state.isPlaying,
        position: state.position,
        duration: state.duration,
        at: Date.now(),
      })
    })
  }, [])
  return null
}
