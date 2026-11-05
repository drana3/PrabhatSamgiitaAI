import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

/**
 * "Remind me" for live Kiirtan broadcasts, kept on this phone.
 * TODO(api): a reminder should become a real push notification from the backend; today it only
 * remembers the choice and shows the bell as on.
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
