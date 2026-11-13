import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>()
  return {
    default: {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: async (key: string) => {
        memory.delete(key)
      },
    },
  }
})

const { api } = vi.hoisted(() => ({
  api: {
    fetchMemberFavorites: vi.fn(),
    addMemberFavorite: vi.fn(),
    removeMemberFavorite: vi.fn(),
    mergeMemberFavorites: vi.fn(),
    fetchMemberPlaylists: vi.fn(async () => []),
  },
}))
vi.mock("@/lib/client", () => ({ api }))
vi.mock("@/lib/memberAuth", () => ({ memberAuthAvailable: () => true }))

import { reconcileAllOwners } from "@/lib/account/ownership"
import { mergeGuestKiirtanSaves } from "@/lib/guest/mergeKiirtanSaves"
import { guestSavedCount, noteGuestSaved } from "@/lib/guest/afterSave"
import { missingNumbers, songNumberOfId, songNumbersOf, unionIds } from "@/lib/guest/guestSaves"
import { GUEST_PROMPT_WEEK_MS } from "@/lib/guest/signInPrompt"
import { toggleMine } from "@/lib/save/saveActions"
import { useAuthStore } from "@/stores/authStore"
import { useGuestPromptStore } from "@/stores/guestPromptStore"
import { useKirtanOwnerStore } from "@/stores/kirtanOwnerStore"
import { useKirtanStore } from "@/stores/kirtanStore"
import { usePreferencesStore } from "@/stores/preferencesStore"

const flush = () => new Promise((r) => setTimeout(r, 0))
const prefs = () => usePreferencesStore.getState()

function signInAs(memberId: string) {
  useAuthStore.getState().applyMemberSession({ displayName: memberId, email: `${memberId}@example.com`, memberId, identityProvider: "google" })
}

beforeAll(async () => {
  await Promise.all([
    useAuthStore.persist.rehydrate(),
    usePreferencesStore.persist.rehydrate(),
    useKirtanStore.persist.rehydrate(),
    useKirtanOwnerStore.persist.rehydrate(),
    useGuestPromptStore.persist.rehydrate(),
  ])
  reconcileAllOwners()
})

beforeEach(async () => {
  vi.clearAllMocks()
  useAuthStore.getState().signOut()
  await flush()
  usePreferencesStore.setState({ favoritesScope: "guest", savedSongIds: [], favoritesByScope: { guest: [] } })
  useKirtanStore.setState({ savedIds: [] })
  useGuestPromptStore.setState({ log: {}, pending: null, shown: null })
  api.fetchMemberFavorites.mockResolvedValue([])
  api.mergeMemberFavorites.mockImplementation(async (numbers: number[]) => numbers)
})

describe("merge helpers", () => {
  it("unions without doubling, account first", () => {
    expect(unionIds(["ps-5", "ps-1"], ["ps-1", "ps-9", "ps-9"])).toEqual(["ps-5", "ps-1", "ps-9"])
    expect(unionIds([], [])).toEqual([])
  })

  it("reads song numbers and ignores anything that is not a song id", () => {
    expect(songNumberOfId("ps-12")).toBe(12)
    expect(songNumberOfId("PS-7")).toBe(7)
    expect(songNumberOfId("kiirtan:abc")).toBeNull()
    expect(songNumberOfId("ps-0")).toBeNull()
    expect(songNumbersOf(["ps-3", "ps-3", "x", "ps-8"])).toEqual([3, 8])
  })

  it("finds what the account lacks", () => {
    expect(missingNumbers([1, 2, 3, 3], [2])).toEqual([1, 3])
    expect(missingNumbers([2], [2, 5])).toEqual([])
  })
})

describe("a guest saves songs on the phone", () => {
  it("keeps the song in the guest list and never calls the server", async () => {
    expect(await prefs().toggleSaved("ps-42")).toEqual({ needsAuth: false })
    expect(prefs().savedSongIds).toEqual(["ps-42"])
    expect(prefs().favoritesByScope.guest).toEqual(["ps-42"])
    await prefs().toggleSaved("ps-42")
    expect(prefs().savedSongIds).toEqual([])
    expect(api.addMemberFavorite).not.toHaveBeenCalled()
    expect(api.removeMemberFavorite).not.toHaveBeenCalled()
  })

  it("keeps the guest list on the phone while the person signs in", async () => {
    await prefs().toggleSaved("ps-1")
    await prefs().toggleSaved("ps-2")
    signInAs("anna")
    expect(prefs().savedSongIds).toEqual([])
    expect(prefs().favoritesByScope.guest).toEqual(["ps-1", "ps-2"])
  })
})

describe("the guest's songs join the account at sign-in", () => {
  it("an account with no saves ends with every guest song, sent in one request", async () => {
    await prefs().toggleSaved("ps-1")
    await prefs().toggleSaved("ps-2")
    await prefs().toggleSaved("ps-3")
    signInAs("anna")
    api.fetchMemberFavorites.mockResolvedValue([])

    await prefs().hydrateFavoritesFromServer()

    expect(api.mergeMemberFavorites).toHaveBeenCalledTimes(1)
    expect(api.mergeMemberFavorites).toHaveBeenCalledWith([1, 2, 3])
    expect(prefs().savedSongIds).toEqual(["ps-1", "ps-2", "ps-3"])
    expect(prefs().favoritesByScope.guest).toEqual([])
  })

  it("an account that already has saves ends with the union, no song twice", async () => {
    await prefs().toggleSaved("ps-1")
    await prefs().toggleSaved("ps-2")
    signInAs("anna")
    api.fetchMemberFavorites.mockResolvedValue([2, 9])
    api.mergeMemberFavorites.mockImplementation(async (numbers: number[]) => [2, 9, ...numbers])

    await prefs().hydrateFavoritesFromServer()

    expect(api.mergeMemberFavorites).toHaveBeenCalledWith([1])
    expect(prefs().savedSongIds).toEqual(["ps-2", "ps-9", "ps-1"])
    expect(new Set(prefs().savedSongIds).size).toBe(prefs().savedSongIds.length)
    expect(prefs().favoritesByScope.guest).toEqual([])
  })

  it("sends nothing when the account already holds every guest song, and still empties the guest list", async () => {
    await prefs().toggleSaved("ps-4")
    signInAs("anna")
    api.fetchMemberFavorites.mockResolvedValue([4, 5])

    await prefs().hydrateFavoritesFromServer()

    expect(api.mergeMemberFavorites).not.toHaveBeenCalled()
    expect(prefs().savedSongIds).toEqual(["ps-4", "ps-5"])
    expect(prefs().favoritesByScope.guest).toEqual([])
  })

  it("a second sync after the merge changes nothing", async () => {
    await prefs().toggleSaved("ps-6")
    signInAs("anna")
    api.fetchMemberFavorites.mockResolvedValue([])
    await prefs().hydrateFavoritesFromServer()
    api.fetchMemberFavorites.mockResolvedValue([6])
    api.mergeMemberFavorites.mockClear()

    await prefs().hydrateFavoritesFromServer()

    expect(api.mergeMemberFavorites).not.toHaveBeenCalled()
    expect(prefs().savedSongIds).toEqual(["ps-6"])
  })

  it("an older server with no merge route is told one song at a time", async () => {
    await prefs().toggleSaved("ps-1")
    await prefs().toggleSaved("ps-2")
    signInAs("anna")
    api.mergeMemberFavorites.mockRejectedValue(new Error("Not Found"))
    const held: number[] = []
    api.addMemberFavorite.mockImplementation(async (n: number) => {
      held.push(n)
      return [...held]
    })

    await prefs().hydrateFavoritesFromServer()

    expect(api.addMemberFavorite.mock.calls.map((c) => c[0])).toEqual([1, 2])
    expect(prefs().savedSongIds).toEqual(["ps-1", "ps-2"])
    expect(prefs().favoritesByScope.guest).toEqual([])
  })

  it("keeps the guest songs on the phone when the account cannot be reached, and sends them next time", async () => {
    await prefs().toggleSaved("ps-1")
    signInAs("anna")
    api.fetchMemberFavorites.mockResolvedValue(null)

    await prefs().hydrateFavoritesFromServer()
    expect(api.mergeMemberFavorites).not.toHaveBeenCalled()
    expect(prefs().favoritesByScope.guest).toEqual(["ps-1"])

    api.fetchMemberFavorites.mockResolvedValue([])
    await prefs().hydrateFavoritesFromServer()
    expect(api.mergeMemberFavorites).toHaveBeenCalledWith([1])
    expect(prefs().savedSongIds).toEqual(["ps-1"])
    expect(prefs().favoritesByScope.guest).toEqual([])
  })

  it("keeps the guest songs when the upload fails (nothing lost)", async () => {
    await prefs().toggleSaved("ps-1")
    await prefs().toggleSaved("ps-2")
    signInAs("anna")
    api.mergeMemberFavorites.mockRejectedValue(new Error("down"))
    api.addMemberFavorite.mockRejectedValue(new Error("down"))

    await prefs().hydrateFavoritesFromServer()

    expect(prefs().savedSongIds).toEqual(["ps-1", "ps-2"])
    expect(prefs().favoritesByScope.guest).toEqual(["ps-1", "ps-2"])
  })
})

describe("the guest's Kiirtans join the account", () => {
  it("joins them to the account's own when the account was here before", async () => {
    signInAs("anna")
    useKirtanStore.getState().toggleSaved("k-anna")
    useGuestPromptStore.setState({ log: {} })
    useAuthStore.getState().signOut()
    expect(useKirtanStore.getState().savedIds).toEqual([])
    useKirtanStore.getState().toggleSaved("k-guest")
    useKirtanStore.getState().toggleSaved("k-anna")

    signInAs("anna")
    // Anna's own list came back; the guest's is put aside under "guest" until it is joined
    expect(useKirtanStore.getState().savedIds).toEqual(["k-anna"])
    expect(mergeGuestKiirtanSaves()).toBe(1)

    expect(useKirtanStore.getState().savedIds).toEqual(["k-anna", "k-guest"])
    expect(mergeGuestKiirtanSaves()).toBe(0)
  })

  it("gives a first account the guest's Kiirtans without any merge", async () => {
    useKirtanStore.getState().toggleSaved("k-1")
    signInAs("newcomer")
    expect(useKirtanStore.getState().savedIds).toEqual(["k-1"])
    expect(mergeGuestKiirtanSaves()).toBe(0)
  })
})

describe("the 3rd saved song asks a guest to sign in", () => {
  const saveSong = (n: number) => toggleMine({ kind: "song", number: n })

  it("does not ask for the 1st and 2nd save, asks for the 3rd", async () => {
    await saveSong(1)
    await saveSong(2)
    expect(useGuestPromptStore.getState().pending).toBeNull()
    await saveSong(3)
    expect(useGuestPromptStore.getState().pending?.kind).toBe("saves")
  })

  it("counts saved Kiirtans too", async () => {
    await saveSong(1)
    await toggleMine({ kind: "kiirtan", id: "k1" })
    expect(useGuestPromptStore.getState().pending).toBeNull()
    await toggleMine({ kind: "kiirtan", id: "k2" })
    expect(guestSavedCount()).toBe(3)
    expect(useGuestPromptStore.getState().pending?.kind).toBe("saves")
  })

  it("does not ask when a song is taken out of the list", async () => {
    await saveSong(1)
    await saveSong(2)
    await saveSong(3)
    useGuestPromptStore.getState().present()
    useGuestPromptStore.getState().close()
    useGuestPromptStore.setState({ log: {} })
    await saveSong(3) // removes
    expect(useGuestPromptStore.getState().pending).toBeNull()
  })

  it("asks a signed-in person nothing", async () => {
    signInAs("anna")
    usePreferencesStore.setState({ favoritesScope: "member:anna", savedSongIds: ["ps-1", "ps-2"], favoritesByScope: { "member:anna": ["ps-1", "ps-2"] } })
    useKirtanStore.setState({ savedIds: ["k1", "k2"] })
    expect(noteGuestSaved()).toBe(false)
    expect(useGuestPromptStore.getState().pending).toBeNull()
  })
})

describe("the prompt store and its weekly limit", () => {
  const store = () => useGuestPromptStore.getState()
  const DAY = 24 * 60 * 60 * 1000

  it("shows a kind once, then waits a week", () => {
    expect(store().request("upload", { now: 1_000 })).toBe(true)
    store().present(1_000)
    store().close()
    expect(store().request("upload", { now: 1_000 + 3 * DAY })).toBe(false)
    expect(store().request("upload", { now: 1_000 + GUEST_PROMPT_WEEK_MS })).toBe(true)
  })

  it("keeps a separate week for each kind", () => {
    expect(store().request("saves", { now: 5 })).toBe(true)
    store().present(5)
    store().close()
    expect(store().request("comment", { now: 6 })).toBe(true)
    store().dropPending()
    expect(store().request("saves", { now: 7 })).toBe(false)
  })

  it("stamps the time when the sheet is shown, not when it is asked for", () => {
    store().request("saves", { now: 10 })
    expect(store().log.saves).toBeUndefined()
    store().dropPending() // the music never stopped: it does not count as shown
    expect(store().request("saves", { now: 11 })).toBe(true)
    store().present(11)
    expect(store().log.saves).toBe(11)
  })

  it("answers a second tap while the sheet is on its way with 'asking', and a different kind with 'no'", () => {
    expect(store().request("upload", { now: 1 })).toBe(true)
    expect(store().request("upload", { now: 2 })).toBe(true)
    expect(store().request("comment", { now: 3 })).toBe(false)
  })

  it("hands back what was to follow (the Upload page), once", () => {
    const after = vi.fn()
    store().request("upload", { now: 1, then: after })
    store().present(1)
    const next = store().close()
    expect(next).toBe(after)
    expect(store().close()).toBeNull()
  })

  it("never asks a signed-in person", () => {
    signInAs("anna")
    expect(store().request("upload", { now: 1 })).toBe(false)
    expect(store().pending).toBeNull()
  })
})
