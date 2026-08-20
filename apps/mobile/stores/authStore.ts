import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { friendlyPersonName } from "@/lib/displayName"

type AuthMode = "guest" | "signed_in"

type AuthState = {
  mode: AuthMode
  displayName: string
  email: string | null
  memberId: string | null
  isAdmin: boolean
  memberBackend: boolean
  identityProvider: string | null
  /** Bumped on every sign-out so in-flight member sync cannot revive the session. */
  sessionEpoch: number
  hasCompletedWelcome: boolean
  setMode: (mode: AuthMode) => void
  applyMemberSession: (input: {
    displayName: string
    email: string | null
    memberId?: string | null
    isAdmin?: boolean
    memberBackend?: boolean
    identityProvider?: string | null
  }) => void
  signOut: () => void
  completeWelcome: () => void
  resetWelcome: () => void
  toggleAdminPreview: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      mode: "guest",
      displayName: "Guest",
      email: null,
      memberId: null,
      isAdmin: false,
      memberBackend: false,
      identityProvider: null,
      sessionEpoch: 0,
      hasCompletedWelcome: false,

      setMode: (mode) => {
        if (mode !== "guest") return
        set({
          mode: "guest",
          displayName: "Guest",
          email: null,
          memberId: null,
          isAdmin: false,
          memberBackend: false,
          identityProvider: null,
          sessionEpoch: get().sessionEpoch + 1,
        })
      },

      applyMemberSession: (input) =>
        set({
          mode: "signed_in",
          displayName: friendlyPersonName(input.displayName, input.email),
          email: input.email,
          memberId: input.memberId ?? null,
          isAdmin: Boolean(input.isAdmin),
          memberBackend: Boolean(input.memberBackend),
          identityProvider: input.identityProvider ?? "aad",
        }),

      signOut: () =>
        set({
          mode: "guest",
          displayName: "Guest",
          email: null,
          memberId: null,
          isAdmin: false,
          memberBackend: false,
          identityProvider: null,
          sessionEpoch: get().sessionEpoch + 1,
        }),

      completeWelcome: () => set({ hasCompletedWelcome: true }),
      resetWelcome: () => set({ hasCompletedWelcome: false }),
      toggleAdminPreview: () => {
        if (!__DEV__) return
        if (get().mode !== "signed_in") return
        set({ isAdmin: !get().isAdmin })
      },
    }),
    {
      name: "prabhat-auth",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        mode: state.mode,
        displayName: state.displayName,
        email: state.email,
        memberId: state.memberId,
        isAdmin: state.isAdmin,
        memberBackend: state.memberBackend,
        identityProvider: state.identityProvider,
        hasCompletedWelcome: state.hasCompletedWelcome,
        // sessionEpoch stays in-memory only — survives the current JS lifetime / in-flight syncs.
      }),
    },
  ),
)
