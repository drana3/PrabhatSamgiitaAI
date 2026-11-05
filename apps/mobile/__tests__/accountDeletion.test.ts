import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  available: true,
  deleteMemberAccount: vi.fn(async () => true),
  completeMemberSignOut: vi.fn(async () => undefined),
  clearAccountMemory: vi.fn(),
  resetProfile: vi.fn(),
  prefsSetState: vi.fn(),
  prefs: { favoritesByScope: { "member:oid-a": ["ps-1"], guest: [] as string[] } as Record<string, string[]> },
}))

vi.mock("@/lib/memberAuth", () => ({ memberAuthAvailable: () => h.available }))
vi.mock("@/lib/client", () => ({ api: { deleteMemberAccount: h.deleteMemberAccount } }))
vi.mock("@/lib/session", () => ({ completeMemberSignOut: h.completeMemberSignOut }))
vi.mock("@/stores/authStore", () => ({
  useAuthStore: {
    getState: () => ({ mode: "signed_in", memberId: "oid-a", identityProvider: "aad", email: "a@example.com" }),
  },
}))
vi.mock("@/stores/chatStore", () => ({ useChatStore: { getState: () => ({ clearAccountMemory: h.clearAccountMemory }) } }))
vi.mock("@/stores/profileStore", () => ({ useProfileStore: { getState: () => ({ reset: h.resetProfile }) } }))
vi.mock("@/stores/preferencesStore", () => ({
  usePreferencesStore: {
    setState: (fn: (s: typeof h.prefs) => Partial<typeof h.prefs>) => {
      h.prefsSetState(fn(h.prefs))
    },
  },
}))

import { deleteAccount, deleteAccountOnServer } from "@/lib/accountDeletion"

describe("account deletion is honest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.available = true
    h.deleteMemberAccount.mockResolvedValue(true)
  })

  it("with no member key it never calls the server, reports it, and keeps everything", async () => {
    h.available = false
    await expect(deleteAccount("acct")).resolves.toEqual({ ok: false, reason: "unavailable" })
    expect(h.deleteMemberAccount).not.toHaveBeenCalled()
    expect(h.completeMemberSignOut).not.toHaveBeenCalled()
    expect(h.clearAccountMemory).not.toHaveBeenCalled()
    expect(h.resetProfile).not.toHaveBeenCalled()
  })

  it("when the server does not confirm, nothing local is cleared and the person stays signed in", async () => {
    h.deleteMemberAccount.mockResolvedValue(false)
    await expect(deleteAccount("acct")).resolves.toEqual({ ok: false, reason: "failed" })
    expect(h.completeMemberSignOut).not.toHaveBeenCalled()
    expect(h.clearAccountMemory).not.toHaveBeenCalled()
    expect(h.prefsSetState).not.toHaveBeenCalled()
  })

  it("a thrown request is a failure, not a success", async () => {
    h.deleteMemberAccount.mockRejectedValue(new Error("offline"))
    await expect(deleteAccountOnServer()).resolves.toEqual({ ok: false, reason: "failed" })
  })

  it("after the server confirmed: local data is cleared, then the person is signed out", async () => {
    await expect(deleteAccount("acct")).resolves.toEqual({ ok: true })
    expect(h.deleteMemberAccount).toHaveBeenCalledTimes(1)
    expect(h.clearAccountMemory).toHaveBeenCalledWith("acct")
    expect(h.resetProfile).toHaveBeenCalledTimes(1)
    expect(h.prefsSetState).toHaveBeenCalledWith({ favoritesByScope: { guest: [] } })
    expect(h.completeMemberSignOut).toHaveBeenCalledTimes(1)
  })
})

describe("the delete screens use it", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require("node:fs") as typeof import("node:fs")
  for (const file of ["components/profile-v2/ProfileContent.tsx"]) {
    it(`${file} never says Deleted without the server`, () => {
      const source = readFileSync(`${__dirname}/../${file}`, "utf8")
      expect(source).toContain("deleteAccount(accountId)")
      expect(source).not.toContain("api.deleteMemberAccount")
      expect(source).not.toContain("member data request completed")
    })
  }
})
