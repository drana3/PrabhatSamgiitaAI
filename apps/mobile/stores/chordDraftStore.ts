import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { Draft } from "@/lib/songChords/draft"
import { draftKey, migrateDrafts, putDraft, removeDraft, type DraftBook } from "@/lib/songChords/drafts"

/**
 * The unfinished charts a member is working on, kept on the device so that leaving the screen (a phone call, the back
 * button, a crash, a dead connection while sending) does not lose half an hour of chords. A small book of drafts, one
 * per song and instrument (lib/songChords/drafts.ts); a draft goes when its chart is sent or the member discards it.
 */
type ChordDraftState = {
  drafts: DraftBook
  /** save (or, when it holds nothing worth keeping, forget) this draft */
  save: (draft: Draft) => void
  discard: (key: string) => void
  discardFor: (draft: Draft) => void
  clear: () => void
}

export const useChordDraftStore = create<ChordDraftState>()(
  persist(
    (set) => ({
      drafts: {},
      save: (draft) => set((s) => ({ drafts: putDraft(s.drafts, draft, Date.now()) })),
      discard: (key) => set((s) => ({ drafts: removeDraft(s.drafts, key) })),
      discardFor: (draft) => set((s) => ({ drafts: removeDraft(s.drafts, draftKey(draft)) })),
      clear: () => set({ drafts: {} }),
    }),
    {
      // v2: a new key drops the drafts made while testing (lib/songChords/retireTestData.ts removes the old one)
      name: "prabhat-chord-draft-v2",
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (saved) => ({ drafts: migrateDrafts(saved, Date.now()) }) as ChordDraftState,
      partialize: (s) => ({ drafts: s.drafts }),
    },
  ),
)
