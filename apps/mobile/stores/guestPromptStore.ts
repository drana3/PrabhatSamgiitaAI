import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import {
  cleanPromptLog,
  promptAllowed,
  type GuestPromptKind,
  type GuestPromptLog,
} from "@/lib/guest/signInPrompt"
import { useAuthStore } from "@/stores/authStore"

/** What the sheet is about and what to do when it closes (for example, go on to the Upload page). */
export type GuestPromptRequest = { kind: GuestPromptKind; then: (() => void) | null; requestedAt: number }

type GuestPromptState = {
  /** when each kind was last shown; on this phone only, kept across sign-out */
  log: GuestPromptLog
  /** asked for, waiting for a quiet moment (the Save sheet closed, the music stopped) */
  pending: GuestPromptRequest | null
  /** on screen now */
  shown: GuestPromptRequest | null
  /**
   * A moment came up (a save, Upload, the comment box). Returns true when the sheet will be shown, so the caller
   * waits for it; false when it will not (signed in, shown in the last week, or one is already open), so the caller
   * carries on as it did before.
   */
  request: (kind: GuestPromptKind, options?: { then?: () => void; now?: number }) => boolean
  /** The host found the quiet moment: put it on screen and stamp the time. */
  present: (now?: number) => void
  /** Drops a request that waited too long. */
  dropPending: () => void
  /** Closed by any way (Not now, swipe, sign-in done). Returns what was to follow, once; the host runs it. */
  close: () => (() => void) | null
}

export const useGuestPromptStore = create<GuestPromptState>()(
  persist(
    (set, get) => ({
      log: {},
      pending: null,
      shown: null,
      request: (kind, options = {}) => {
        if (useAuthStore.getState().mode !== "guest") return false
        const now = options.now ?? Date.now()
        const { pending, shown, log } = get()
        // already asking (a second tap while the sheet is on its way): the one sheet is enough
        if (shown?.kind === kind || pending?.kind === kind) return true
        if (shown || pending) return false
        if (!promptAllowed(log, kind, now)) return false
        set({ pending: { kind, then: options.then ?? null, requestedAt: now } })
        return true
      },
      present: (now = Date.now()) => {
        const { pending, log } = get()
        if (!pending) return
        set({ pending: null, shown: pending, log: { ...log, [pending.kind]: now } })
      },
      dropPending: () => set({ pending: null }),
      close: () => {
        const { shown } = get()
        if (!shown) return null
        set({ shown: null })
        return shown.then
      },
    }),
    {
      name: "prabhat-guest-prompts",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (saved) => ({ log: cleanPromptLog((saved as { log?: unknown } | null)?.log) }) as never,
      partialize: (state) => ({ log: state.log }),
    },
  ),
)
