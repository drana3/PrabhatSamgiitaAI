import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

/**
 * "Remind me" for live Kiirtan broadcasts, kept on this phone. The notifications host
 * (components/notifications) turns each id into a local notification 15 minutes before the start
 * (lib/notifications/schedule.ts) and asks for permission when the first one is set.
 * TODO(api): the broadcast list itself comes from the backend; until then the preview has fixtures.
 */
type LiveState = {
  remindIds: string[]
  toggleRemind: (id: string) => boolean
  reset: () => void
}

export const useKirtanLiveStore = create<LiveState>()(
  persist(
    (set, get) => ({
      remindIds: [],
      toggleRemind: (id) => {
        const has = get().remindIds.includes(id)
        set({ remindIds: has ? get().remindIds.filter((x) => x !== id) : [...get().remindIds, id] })
        return !has
      },
      reset: () => set({ remindIds: [] }),
    }),
    {
      name: "prabhat-kirtan-live",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ remindIds: state.remindIds }),
    },
  ),
)
