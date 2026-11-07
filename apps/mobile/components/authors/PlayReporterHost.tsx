import { useEffect } from "react"
import { AppState } from "react-native"

import { flushPlays } from "@/lib/authors/flush"
import { PlayTracker, recordingIdOfTrack } from "@/lib/authors/plays"
import { sendPlays } from "@/lib/authors/remote"
import { remoteConfig, canUseServer } from "@/lib/kirtan/api"
import { kirtanById } from "@/lib/kirtan/catalog"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { usePlayerStore } from "@/stores/playerStore"
import { usePlayQueueStore } from "@/stores/playQueueStore"

/** How often waiting events are tried again while the app is open. */
const RETRY_MS = 60_000

let busy = false

async function flush(): Promise<void> {
  if (busy || MOCKUP_DATA) return
  busy = true
  try {
    const store = usePlayQueueStore.getState()
    const signedIn = canUseServer()
    // signed out: a random id made on this phone; signed in: the server knows the member, no device id is sent
    const deviceId = signedIn ? null : store.ensureDeviceId()
    await flushPlays({
      next: () => usePlayQueueStore.getState().next(),
      done: (n) => usePlayQueueStore.getState().done(n),
      send: (events) => sendPlays(remoteConfig(), { events, deviceId }),
    })
  } finally {
    busy = false
  }
}

/**
 * Mounted once at the root (app/_layout.tsx), renders nothing. It WATCHES the one player (`usePlayerStore`) and never
 * changes it: when a recording has been heard long enough it queues one event and sends the line in batches.
 * What counts and what is private: docs/author-profiles.md, "Statistics". The preview (MOCKUP_DATA) sends nothing.
 */
export function PlayReporterHost() {
  useEffect(() => {
    if (MOCKUP_DATA) return undefined
    const tracker = new PlayTracker((event) => {
      usePlayQueueStore.getState().push(event)
      void flush()
    })
    const serverIdOf = (appId: string) => kirtanById(appId)?.serverId
    const unsubscribe = usePlayerStore.subscribe((state) => {
      tracker.feed({
        recordingId: recordingIdOfTrack(state.currentSong, serverIdOf),
        playing: state.isPlaying,
        position: state.position,
        duration: state.duration,
        at: Date.now(),
      })
    })
    const timer = setInterval(() => void flush(), RETRY_MS)
    const app = AppState.addEventListener("change", (next) => {
      if (next === "active") void flush()
    })
    void flush()
    return () => {
      unsubscribe()
      clearInterval(timer)
      app.remove()
    }
  }, [])
  return null
}
