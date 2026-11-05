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

vi.mock("@/lib/client", () => ({
  api: {
    fetchMemberPlaylists: vi.fn(async () => []),
    createMemberPlaylist: vi.fn(),
    renameMemberPlaylist: vi.fn(),
    deleteMemberPlaylist: vi.fn(),
    addMemberPlaylistSong: vi.fn(),
    removeMemberPlaylistSong: vi.fn(),
    fetchMemberFavorites: vi.fn(async () => null),
  },
}))
vi.mock("@/lib/memberAuth", () => ({ memberAuthAvailable: () => true }))

import AsyncStorage from "@react-native-async-storage/async-storage"

import { dropSlot, GUEST_OWNER, ownerKeyOf, rotateOwner } from "@/lib/account/owner"
import { reconcileAllOwners } from "@/lib/account/ownership"
import { wipeLocalUserData } from "@/lib/account/wipeLocalUserData"
import { clearCachedMemberEmail, getCachedMemberEmail, resolveMemberEmail } from "@/lib/memberEmail"
import { peekPlaylistCache, readPlaylistCache, writePlaylistCache } from "@/lib/playlistCache"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { useKirtanOwnerStore } from "@/stores/kirtanOwnerStore"
import { useKirtanStore } from "@/stores/kirtanStore"
import { useLearnStore } from "@/stores/learnStore"
import { useNotificationsStore } from "@/stores/notificationsStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useResumeStore } from "@/stores/resumeStore"

function signInAs(memberId: string, email: string | null = `${memberId}@example.com`, provider = "google") {
  useAuthStore.getState().applyMemberSession({ displayName: memberId, email, memberId, identityProvider: provider })
}
function signOutQuietly() {
  useAuthStore.getState().signOut()
}
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeAll(async () => {
  await Promise.all([
    useAuthStore.persist.rehydrate(),
    useLearnStore.persist.rehydrate(),
    usePreferencesStore.persist.rehydrate(),
    useResumeStore.persist.rehydrate(),
    useKirtanStore.persist.rehydrate(),
    useKirtanOwnerStore.persist.rehydrate(),
  ])
  reconcileAllOwners()
})

beforeEach(async () => {
  signOutQuietly()
  await flush()
})

describe("owner rotation (pure)", () => {
  it("names a guest and an account", () => {
    expect(ownerKeyOf({ mode: "guest", memberId: "a", email: "a@x.co" })).toBe(GUEST_OWNER)
    expect(ownerKeyOf({ mode: "signed_in", memberId: "a", email: "a@x.co" })).toBe("member:a")
    expect(ownerKeyOf({ mode: "signed_in", memberId: null, email: "A@X.co" })).toBe("member:a@x.co")
  })

  it("lets a guest's data move into the first account that signs in", () => {
    const r = rotateOwner({ owner: "guest", slots: {} }, ["g"], "member:a", [] as string[])
    expect(r.data).toEqual(["g"])
    expect(r.slots.guest).toEqual([])
  })

  it("puts an account's data aside on sign-out and gives the guest an empty start", () => {
    const r = rotateOwner({ owner: "member:a", slots: { guest: [] as string[] } }, ["a1"], "guest", [] as string[])
    expect(r.data).toEqual([])
    expect(r.slots["member:a"]).toEqual(["a1"])
  })

  it("never hands one account the data of another", () => {
    const r = rotateOwner({ owner: "member:a", slots: {} }, ["a1"], "member:b", [] as string[])
    expect(r.data).toEqual([])
    expect(r.slots["member:a"]).toEqual(["a1"])
    const back = rotateOwner({ owner: r.owner, slots: r.slots }, ["b1"], "member:a", [] as string[])
    expect(back.data).toEqual(["a1"])
    expect(back.slots["member:b"]).toEqual(["b1"])
  })

  it("takes data saved before owners were stamped for whoever is signed in", () => {
    const r = rotateOwner({ owner: null, slots: {} }, ["old"], "member:a", [] as string[])
    expect(r.data).toEqual(["old"])
  })

  it("drops one account's slot", () => {
    expect(dropSlot({ "member:a": 1, guest: 2 }, "member:a")).toEqual({ guest: 2 })
  })
})

describe("learning progress follows the account", () => {
  it("account B never sees account A's songs, and A gets them back", async () => {
    signInAs("a")
    useLearnStore.getState().startLearning({ songId: "ps-1", number: 1, title: "One" })
    expect(useLearnStore.getState().songs.map((s) => s.number)).toEqual([1])

    signOutQuietly()
    expect(useLearnStore.getState().songs).toEqual([])
    signInAs("b")
    expect(useLearnStore.getState().songs).toEqual([])
    useLearnStore.getState().startLearning({ songId: "ps-2", number: 2, title: "Two" })

    signOutQuietly()
    signInAs("a")
    expect(useLearnStore.getState().songs.map((s) => s.number)).toEqual([1])
    signInAs("b")
    expect(useLearnStore.getState().songs.map((s) => s.number)).toEqual([2])
  })

  it("switching straight from one account to another also swaps the data", () => {
    signInAs("a")
    useLearnStore.getState().startLearning({ songId: "ps-5", number: 5, title: "Five" })
    signInAs("c")
    expect(useLearnStore.getState().songs).toEqual([])
    signInAs("a")
    const numbers = useLearnStore.getState().songs.map((s) => s.number)
    expect(numbers).toContain(5)
    expect(numbers).not.toContain(2)
  })

  it("keeps the review style as a setting of the phone", () => {
    signInAs("a")
    useLearnStore.getState().setReviewStyle("gentle" as never)
    const style = useLearnStore.getState().reviewStyle
    signInAs("b")
    expect(useLearnStore.getState().reviewStyle).toBe(style)
  })
})

describe("recent songs, searches and notes follow the account", () => {
  const song = { id: "ps-7", number: 7, title: "Seven", thumbnailUrl: "", themes: [] as string[] }

  it("B does not see A's history or notes", () => {
    signInAs("a")
    usePreferencesStore.getState().recordRecentPlay(song)
    usePreferencesStore.getState().addSearchRecent("moon")
    usePreferencesStore.getState().setSongNote("ps-7", "my note")
    signOutQuietly()
    expect(usePreferencesStore.getState().recentPlays).toEqual([])
    expect(usePreferencesStore.getState().searchRecents).toEqual([])
    expect(usePreferencesStore.getState().songNotes).toEqual({})
    signInAs("b")
    expect(usePreferencesStore.getState().recentPlays).toEqual([])
    signInAs("a")
    expect(usePreferencesStore.getState().recentPlays.map((r) => r.number)).toEqual([7])
    expect(usePreferencesStore.getState().songNotes["ps-7"]).toBe("my note")
  })
})

describe("where a song stopped follows the account", () => {
  it("B starts from the beginning", () => {
    signInAs("a")
    useResumeStore.getState().record(3, 100, 200)
    expect(useResumeStore.getState().get(3)).toBeDefined()
    signOutQuietly()
    expect(useResumeStore.getState().get(3)).toBeUndefined()
    signInAs("b")
    expect(useResumeStore.getState().get(3)).toBeUndefined()
    signInAs("a")
    expect(useResumeStore.getState().get(3)).toBeDefined()
  })
})

describe("Kiirtan uploads, saved and blocked authors follow the account", () => {
  it("B does not see A's saved recordings or blocks", () => {
    signInAs("a")
    useKirtanStore.getState().toggleSaved("k-1")
    useKirtanStore.getState().blockAuthor("author-9", "Nine")
    expect(useKirtanStore.getState().savedIds).toEqual(["k-1"])
    signOutQuietly()
    expect(useKirtanStore.getState().savedIds).toEqual([])
    expect(useKirtanStore.getState().blockedAuthorIds).toEqual([])
    signInAs("b")
    expect(useKirtanStore.getState().savedIds).toEqual([])
    expect(useKirtanStore.getState().blockedAuthorIds).toEqual([])
    signInAs("a")
    expect(useKirtanStore.getState().savedIds).toEqual(["k-1"])
    expect(useKirtanStore.getState().blockedNames["author-9"]).toBe("Nine")
  })
})

describe("AI chats are keyed by account, never by 'guest' for a signed-in person", () => {
  it("an Apple account with no email gets its own key", () => {
    const { getAccountId } = useChatStore.getState()
    expect(getAccountId("signed_in", null, "apple-001")).toBe("member:apple-001")
    expect(getAccountId("signed_in", "A@B.co", "x")).toBe("member:a@b.co")
    expect(getAccountId("guest", null, "apple-001")).toBe("guest")
    expect(getAccountId("signed_in", null, null)).not.toBe("guest")
  })

  it("the next guest does not see a hidden-email account's chat", () => {
    const store = useChatStore.getState()
    const id = store.getAccountId("signed_in", null, "apple-001")
    store.appendExchange(id, "hello", "hi")
    expect(useChatStore.getState().getAccountChat("guest").threads).toEqual([])
    expect(useChatStore.getState().getAccountChat(id).threads.length).toBe(1)
  })
})

describe("the cached email stays with its account", () => {
  it("is not handed to the next account", async () => {
    signInAs("a", "a@example.com")
    await resolveMemberEmail({ email: "a@example.com", memberId: "a" })
    expect(getCachedMemberEmail()).toBe("a@example.com")
    // account B signs in without an email of their own
    signInAs("b", null)
    expect(getCachedMemberEmail()).toBeNull()
    expect(await resolveMemberEmail({ email: null, memberId: "b", identityProvider: "google" })).toBeNull()
  })

  it("is dropped on sign-out", async () => {
    signInAs("a", "a@example.com")
    await resolveMemberEmail({ email: "a@example.com", memberId: "a" })
    clearCachedMemberEmail()
    expect(getCachedMemberEmail()).toBeNull()
  })
})

describe("playlists", () => {
  it("a cache written by one account is not read by another", async () => {
    signInAs("a")
    await writePlaylistCache([{ id: "p1", name: "Mine", songs: [], created_at: "" } as never])
    expect(peekPlaylistCache()?.length).toBe(1)
    signInAs("b")
    expect(peekPlaylistCache() ?? []).toEqual([])
    expect(await readPlaylistCache()).toEqual([])
  })

  it("a write for an account that is no longer signed in is dropped", async () => {
    signInAs("a")
    const ownerA = ownerKeyOf(useAuthStore.getState())
    signInAs("b")
    await writePlaylistCache([{ id: "late", name: "Late", songs: [], created_at: "" } as never], ownerA)
    expect(peekPlaylistCache() ?? []).toEqual([])
  })

  it("signing out empties the list shown on screen", async () => {
    signInAs("a")
    usePlaylistStore.setState({ playlists: [{ id: "p1", name: "Mine", songs: [], created_at: "" } as never] })
    signOutQuietly()
    await flush()
    expect(usePlaylistStore.getState().playlists).toEqual([])
  })

  it("another account signing in over the first one starts with no playlists", async () => {
    signInAs("a")
    usePlaylistStore.setState({ playlists: [{ id: "p1", name: "Mine", songs: [], created_at: "" } as never] })
    signInAs("b")
    await flush()
    expect(usePlaylistStore.getState().playlists).toEqual([])
  })
})

describe("wipeLocalUserData", () => {
  it("clears the account's chat, the email cache, upload notices and playlists, and leaves other notices", async () => {
    signInAs("a", "a@example.com")
    const id = useChatStore.getState().getAccountId("signed_in", "a@example.com", "a")
    useChatStore.getState().appendExchange(id, "q", "a")
    await resolveMemberEmail({ email: "a@example.com", memberId: "a" })
    useNotificationsStore.setState({
      items: [
        { id: "upload:1:removed", kind: "upload", title: "t", text: "x", target: "/", firedAt: 1 },
        { id: "festival:1", kind: "festival", title: "t", text: "x", target: "/", firedAt: 2 },
      ] as never,
    })
    usePlaylistStore.setState({ playlists: [{ id: "p1", name: "Mine", songs: [], created_at: "" } as never] })

    await wipeLocalUserData(id)

    expect(useChatStore.getState().getAccountChat(id).threads).toEqual([])
    expect(getCachedMemberEmail()).toBeNull()
    expect(useNotificationsStore.getState().items.map((i) => i.id)).toEqual(["festival:1"])
    expect(usePlaylistStore.getState().playlists).toEqual([])
    expect(await AsyncStorage.getItem("ps-member-playlists-v3")).toBeNull()
  })

  it("does not touch a guest chat", async () => {
    useChatStore.getState().appendExchange("guest", "q", "a")
    await wipeLocalUserData("guest")
    expect(useChatStore.getState().getAccountChat("guest").threads.length).toBe(1)
  })
})
