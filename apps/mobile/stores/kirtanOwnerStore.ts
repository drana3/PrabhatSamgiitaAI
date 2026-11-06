import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { bindOwner } from "@/lib/account/bindOwner"
import { keepSavedState } from "@/lib/persistMigrate"
import type { OwnedData } from "@/lib/account/owner"
import { useKirtanStore } from "@/stores/kirtanStore"

/** What the Kiirtan store persists for one account: uploads, saved, reported, blocked authors. */
type KirtanAccountData = Record<string, unknown>

/**
 * Whose Kiirtan data the phone holds, and the data of the accounts that are not in use (lib/account/owner.ts).
 * It lives beside the Kiirtan store, not in it: the store persists exactly what `partialize` says, and this follows
 * that list, so a field added to the Kiirtan store later is rotated without anyone remembering to list it here.
 */
export const useKirtanOwnerStore = create<OwnedData<KirtanAccountData>>()(
  persist(() => ({ owner: null, slots: {} }) as OwnedData<KirtanAccountData>, {
    name: "prabhat-kirtan-owner",
    storage: createJSONStorage(() => AsyncStorage),
    version: 1,
    migrate: (saved) => keepSavedState<OwnedData<KirtanAccountData>>(saved),
    partialize: (state) => ({ owner: state.owner, slots: state.slots }),
  }),
)

type Persisted = { persist: { getOptions: () => { partialize?: (state: never) => unknown } } }

function accountPart(state: ReturnType<typeof useKirtanStore.getState>): KirtanAccountData {
  const partialize = (useKirtanStore as unknown as Persisted).persist.getOptions().partialize
  return ((partialize ? partialize(state as never) : state) ?? {}) as KirtanAccountData
}

export const reconcileKirtanOwner = bindOwner<ReturnType<typeof useKirtanStore.getState>, KirtanAccountData, OwnedData<KirtanAccountData>>(
  useKirtanStore,
  {
    holder: useKirtanOwnerStore,
    pick: accountPart,
    empty: () => accountPart(useKirtanStore.getInitialState()),
    apply: (data) => data as Partial<ReturnType<typeof useKirtanStore.getState>>,
  },
)
