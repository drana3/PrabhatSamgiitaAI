import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { bindOwner } from "@/lib/account/bindOwner"
import type { OwnedData } from "@/lib/account/owner"
import { upsertResume, type ResumeEntry, type ResumeMap } from "@/lib/playerV2/resume"

type ResumeState = OwnedData<{ entries: ResumeMap }> & {
  entries: ResumeMap
  record: (songNumber: number, position: number, duration: number, now?: number) => void
  get: (songNumber: number) => ResumeEntry | undefined
  forget: (songNumber: number) => void
}

/** Resume position per song (spec PLR-06), kept on the device. */
export const useResumeStore = create<ResumeState>()(
  persist(
    (set, get) => ({
      entries: {},
      owner: null,
      slots: {},
      record: (songNumber, position, duration, now = Date.now()) =>
        set({ entries: upsertResume(get().entries, songNumber, position, duration, now) }),
      get: (songNumber) => get().entries[String(songNumber)],
      forget: (songNumber) => {
        const next = { ...get().entries }
        delete next[String(songNumber)]
        set({ entries: next })
      },
    }),
    {
      name: "ps.resume",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ entries: state.entries, owner: state.owner, slots: state.slots }),
    },
  ),
)

/** Where each person stopped is theirs: another account on the phone starts from the beginning (lib/account/owner.ts). */
export const reconcileResumeOwner = bindOwner<ResumeState, { entries: ResumeMap }>(useResumeStore, {
  pick: (s) => ({ entries: s.entries }),
  empty: () => ({ entries: {} }),
  apply: (data) => data,
})
