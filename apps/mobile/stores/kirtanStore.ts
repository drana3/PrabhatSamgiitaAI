import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { KIRTAN_FIXTURES, KIRTAN_PENDING_FIXTURE } from "@/lib/fixtures/kirtan"
import { addSubmission, buildSubmission, decideSubmission, withdrawSubmission, type AddResult, type SubmissionInput } from "@/lib/kirtan/submissions"
import type { Kirtan } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * Kirtans on this phone: what the person submitted (with its review status), the kirtans they
 * saved and the ones they reported. Stored locally first.
 * TODO(api): submissions are POSTed to the backend and their status comes back from there; an
 * admin approves or rejects them (`decide` below stands in for that). Saved ids and reports sync.
 */
type KirtanState = {
  submissions: Kirtan[]
  savedIds: string[]
  reportedIds: string[]
  /** put the preview's pending submission in an empty store, once (MOCKUP_DATA only) */
  seedDemo: () => void
  submit: (input: SubmissionInput, now?: number) => AddResult
  /** admin stand-in for the backend review */
  decide: (id: string, to: "approved" | "rejected") => void
  withdraw: (id: string) => void
  toggleSaved: (id: string) => boolean
  report: (id: string) => void
  reset: () => void
}

const INITIAL = { submissions: [] as Kirtan[], savedIds: [] as string[], reportedIds: [] as string[] }

export const useKirtanStore = create<KirtanState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      seedDemo: () => {
        if (!MOCKUP_DATA || get().submissions.length) return
        set({ submissions: [KIRTAN_PENDING_FIXTURE] })
      },
      submit: (input, now = Date.now()) => {
        const result = addSubmission(get().submissions, buildSubmission(input, now), KIRTAN_FIXTURES.map((k) => k.videoId))
        if (result.added) set({ submissions: result.list })
        return result
      },
      decide: (id, to) => set({ submissions: decideSubmission(get().submissions, id, to) }),
      withdraw: (id) => set({ submissions: withdrawSubmission(get().submissions, id) }),
      toggleSaved: (id) => {
        const has = get().savedIds.includes(id)
        set({ savedIds: has ? get().savedIds.filter((s) => s !== id) : [...get().savedIds, id] })
        return !has
      },
      report: (id) => {
        if (!get().reportedIds.includes(id)) set({ reportedIds: [...get().reportedIds, id] })
      },
      reset: () => set(INITIAL),
    }),
    {
      name: "prabhat-kirtan",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ submissions: state.submissions, savedIds: state.savedIds, reportedIds: state.reportedIds }),
    },
  ),
)
