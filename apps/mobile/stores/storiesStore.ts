import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { markRead, markUnread, sanitizeReadMap, type ReadMap } from "@/lib/stories/readState"

type StoriesState = {
  /** slug -> when it was read (ms) */
  read: ReadMap
  markRead: (slug: string, now?: number) => void
  markUnread: (slug: string) => void
}

/** Which stories were read, kept on the device (key `prabhat-stories`). */
export const useStoriesStore = create<StoriesState>()(
  persist(
    (set, get) => ({
      read: {},
      markRead: (slug, now = Date.now()) => {
        const next = markRead(get().read, slug, now)
        if (next !== get().read) set({ read: next })
      },
      markUnread: (slug) => {
        const next = markUnread(get().read, slug)
        if (next !== get().read) set({ read: next })
      },
    }),
    {
      name: "prabhat-stories",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ read: state.read }),
      merge: (persisted, current) => ({
        ...current,
        read: sanitizeReadMap((persisted as { read?: unknown } | undefined)?.read),
      }),
    },
  ),
)
