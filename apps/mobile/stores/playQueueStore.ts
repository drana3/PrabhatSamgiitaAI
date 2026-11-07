import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { PlayEventOut } from "@/lib/authors/types"
import { enqueue, fresh, newDeviceId, takeBatch } from "@/lib/authors/plays"

/**
 * Listening events waiting to be sent (docs/author-profiles.md, "Statistics"), and the random device id used only
 * when nobody is signed in. Kept on the phone so an offline spell does not lose plays; the line is capped and old
 * events are dropped (the server refuses events older than a week anyway).
 */
type PlayQueueState = {
  queue: PlayEventOut[]
  deviceId: string | null
  push: (event: PlayEventOut) => void
  /** the next batch to send; it stays in the line until `done` is called */
  next: (now?: number) => PlayEventOut[]
  done: (sent: number) => void
  ensureDeviceId: () => string
  /** forget the id (sign-in, "Delete my data") */
  clearDeviceId: () => void
  reset: () => void
}

export const usePlayQueueStore = create<PlayQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      deviceId: null,
      push: (event) => set({ queue: enqueue(get().queue, event) }),
      next: (now = Date.now()) => {
        const cleaned = fresh(get().queue, now)
        if (cleaned.length !== get().queue.length) set({ queue: cleaned })
        return takeBatch(cleaned).batch
      },
      done: (sent) => set({ queue: get().queue.slice(sent) }),
      ensureDeviceId: () => {
        const known = get().deviceId
        if (known) return known
        const id = newDeviceId()
        set({ deviceId: id })
        return id
      },
      clearDeviceId: () => set({ deviceId: null }),
      reset: () => set({ queue: [], deviceId: null }),
    }),
    {
      name: "prabhat-play-queue",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ queue: state.queue, deviceId: state.deviceId }),
    },
  ),
)
