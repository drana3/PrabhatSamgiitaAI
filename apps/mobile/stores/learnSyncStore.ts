import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { SyncMeta } from "@/lib/learn/syncMerge"

/**
 * The bookkeeping of Learn sync, per account (owner key, see lib/account/owner.ts): for each song, what was last in
 * step with the server and what still has to be sent. It is the sync's own state; the Learn store itself is not
 * changed by it. Kept on the phone so that a restart or being offline does not forget what is waiting to be sent.
 */
type State = {
  byOwner: Record<string, SyncMeta>
  setMeta: (owner: string, meta: SyncMeta) => void
  drop: (owner: string) => void
}

export const useLearnSyncStore = create<State>()(
  persist(
    (set) => ({
      byOwner: {},
      setMeta: (owner, meta) => set((state) => ({ byOwner: { ...state.byOwner, [owner]: meta } })),
      drop: (owner) =>
        set((state) => {
          const { [owner]: _gone, ...rest } = state.byOwner
          return { byOwner: rest }
        }),
    }),
    {
      name: "prabhat-learn-sync",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ byOwner: state.byOwner }),
    },
  ),
)
