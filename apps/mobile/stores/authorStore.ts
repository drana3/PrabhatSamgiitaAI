import { create } from "zustand"

import { authorsApi } from "@/lib/authors/api"
import type { AuthorProfileOwner, OwnerResponse } from "@/lib/authors/types"
import { errorKey } from "@/lib/authors/slug"
import { NetworkError, RemoteError } from "@/lib/kirtan/remote"

/**
 * The person's own author page, kept for the screens that need to know whether there is one (the Upload hub, the
 * profile row, the author line). Not persisted: the server is the source of truth, and a stale page here would show
 * "published" for a page the team suspended.
 */
type Load = "idle" | "loading" | "ready" | "error"

type AuthorState = {
  load: Load
  mine: AuthorProfileOwner | null
  canCreate: boolean
  suspendedReason: string | null
  /** i18n key of the sentence for the last load error */
  errorKey: string | null
  refresh: () => Promise<void>
  setMine: (profile: AuthorProfileOwner | null) => void
  reset: () => void
}

const INITIAL = { load: "idle" as Load, mine: null, canCreate: true, suspendedReason: null, errorKey: null }

export function errorKeyOf(error: unknown): string {
  if (error instanceof NetworkError) return errorKey({ network: true })
  if (error instanceof RemoteError) return errorKey({ code: error.code, status: error.status })
  return errorKey({})
}

export const useAuthorStore = create<AuthorState>()((set, get) => ({
  ...INITIAL,
  refresh: async () => {
    if (get().load === "loading") return
    set({ load: "loading", errorKey: null })
    try {
      const answer: OwnerResponse = await authorsApi().mine()
      set({ load: "ready", mine: answer.profile, canCreate: answer.can_create, suspendedReason: answer.suspended_reason, errorKey: null })
    } catch (error) {
      set({ load: "error", errorKey: errorKeyOf(error) })
    }
  },
  setMine: (profile) => set({ mine: profile, load: "ready", errorKey: null }),
  reset: () => set(INITIAL),
}))
