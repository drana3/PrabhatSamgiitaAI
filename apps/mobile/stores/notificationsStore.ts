import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { markAllRead, markRead, type AppNotification } from "@/lib/notifications"

type NotificationsState = {
  /** ids the person has opened or marked read */
  read: string[]
  open: (id: string) => void
  markAll: (items: readonly AppNotification[]) => void
  reset: () => void
}

/** Which notifications are read. Only the ids are stored; the items come from the source. */
export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      read: [],
      open: (id) => set((s) => ({ read: markRead(s.read, id) })),
      markAll: (items) => set((s) => ({ read: markAllRead(items, s.read) })),
      reset: () => set({ read: [] }),
    }),
    { name: "prabhat-notifications", storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ read: s.read }) },
  ),
)
