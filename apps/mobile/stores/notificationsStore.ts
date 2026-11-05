import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import {
  EMPTY_INBOX,
  markAllRead,
  markRead,
  pruneInbox,
  receiveFired,
  removeItem,
  type AppNotification,
  type InboxState,
} from "@/lib/notifications"

type NotificationsState = InboxState & {
  /** the notifications that have fired since the last look; ids already there or deleted are skipped */
  receive: (fired: readonly AppNotification[], now: number) => void
  open: (id: string) => void
  markAll: (items: readonly AppNotification[]) => void
  remove: (item: Pick<AppNotification, "id" | "firedAt">) => void
  prune: (now: number) => void
  reset: () => void
}

/** Version 1 kept only the read ids; version 2 keeps the fired items too. */
export function migrateInbox(saved: unknown, _version: number): InboxState {
  const s = saved && typeof saved === "object" ? (saved as Partial<InboxState>) : {}
  return {
    items: Array.isArray(s.items) ? s.items : [],
    read: Array.isArray(s.read) ? s.read.filter((id): id is string => typeof id === "string") : [],
    deleted: s.deleted && typeof s.deleted === "object" ? s.deleted : {},
    syncedAt: typeof s.syncedAt === "number" ? s.syncedAt : null,
  }
}

/**
 * The inbox: notifications that have fired (with when), which are read, and which were deleted.
 * Kept on the phone for 30 days.
 */
export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      ...EMPTY_INBOX,
      receive: (fired, now) => set((s) => receiveFired(s, fired, now)),
      open: (id) => set((s) => ({ read: markRead(s.read, id) })),
      markAll: (items) => set((s) => ({ read: markAllRead(items, s.read) })),
      remove: (item) => set((s) => removeItem(s, item.id, item.firedAt)),
      prune: (now) => set((s) => pruneInbox(s, now)),
      reset: () => set({ ...EMPTY_INBOX }),
    }),
    {
      name: "prabhat-notifications",
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (saved, version) => migrateInbox(saved, version) as NotificationsState,
      partialize: (s) => ({ items: s.items, read: s.read, deleted: s.deleted, syncedAt: s.syncedAt }),
    },
  ),
)
