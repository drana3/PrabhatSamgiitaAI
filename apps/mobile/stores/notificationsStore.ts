import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { PlannedNotification } from "@/lib/notifications/schedule"
import {
  EMPTY_INBOX,
  clearAll,
  markAllRead,
  markRead,
  pruneInbox,
  receiveFired,
  removeItem,
  restoreItem,
  type AppNotification,
  type InboxState,
} from "@/lib/notifications"

/** What the phone was told to deliver: the only notifications that can have reached the person. */
export type ScheduledLedger = PlannedNotification[]

type NotificationsState = InboxState & {
  /**
   * The notifications handed to the phone at the last scheduling (at most 60). The inbox takes in what has
   * fired from this list, not from the plan: a reminder the phone never held (permission off, past the
   * phone's limit, the app not opened for weeks) did not arrive, so it is not in the bell.
   */
  scheduled: ScheduledLedger
  setScheduled: (planned: readonly PlannedNotification[]) => void
  /** the notifications that have fired since the last look; ids already there or deleted are skipped */
  receive: (fired: readonly AppNotification[], now: number) => void
  open: (id: string) => void
  markAll: (items: readonly AppNotification[]) => void
  remove: (item: Pick<AppNotification, "id" | "firedAt">) => void
  /** undo a delete */
  restore: (item: AppNotification, now: number) => void
  /** "Clear all": everything goes except unread important items; returns how many stayed */
  clear: (now: number) => number
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

/** Version 3 added the scheduled ledger; older saves have none (the next scheduling fills it). */
export function migrateScheduled(saved: unknown): ScheduledLedger {
  const list = saved && typeof saved === "object" ? (saved as { scheduled?: unknown }).scheduled : undefined
  return Array.isArray(list)
    ? list.filter(
        (n): n is PlannedNotification =>
          !!n && typeof n === "object" && typeof n.id === "string" && typeof n.fireAt === "number" && typeof n.kind === "string",
      )
    : []
}

/**
 * The inbox: notifications that have fired (with when), which are read, and which were deleted.
 * Kept on the phone per kind (lib/notifications/retention.ts): reminders 14 days, notices about uploads 90.
 */
export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      ...EMPTY_INBOX,
      scheduled: [],
      setScheduled: (planned) => set({ scheduled: [...planned] }),
      receive: (fired, now) => set((s) => receiveFired(s, fired, now)),
      open: (id) => set((s) => ({ read: markRead(s.read, id) })),
      markAll: (items) => set((s) => ({ read: markAllRead(items, s.read) })),
      remove: (item) => set((s) => removeItem(s, item.id, item.firedAt)),
      restore: (item, now) => set((s) => restoreItem(s, item, now)),
      clear: (now) => {
        let kept = 0
        set((s) => {
          const out = clearAll(s, now)
          kept = out.kept
          return out.state
        })
        return kept
      },
      prune: (now) => set((s) => pruneInbox(s, now)),
      reset: () => set({ ...EMPTY_INBOX, scheduled: [] }),
    }),
    {
      name: "prabhat-notifications",
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (saved, version) => ({ ...migrateInbox(saved, version), scheduled: migrateScheduled(saved) }) as NotificationsState,
      partialize: (s) => ({ items: s.items, read: s.read, deleted: s.deleted, syncedAt: s.syncedAt, scheduled: s.scheduled }),
    },
  ),
)
