import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

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
vi.mock("@/lib/client", () => ({ apiBaseUrl: "https://api.example.test" }))
vi.mock("@/lib/memberAuth", () => ({
  authHeadersFromStore: () => ({ "X-Member-Proxy-Key": "key", "X-MS-CLIENT-PRINCIPAL": "principal" }),
  memberAuthAvailable: () => true,
}))
// the stores of the other features that learnStore pulls in through its owner binding
vi.mock("@/lib/mockupMode", () => ({ MOCKUP_DATA: false }))

import { reconcileAllOwners } from "@/lib/account/ownership"
import { PUSH_DEBOUNCE_MS, startLearnSync, syncLearnNow } from "@/lib/learn/sync"
import { addSongToLearn } from "@/lib/learn/addSong"
import { useAuthStore } from "@/stores/authStore"
import { useLearnStore } from "@/stores/learnStore"
import { useLearnSyncStore } from "@/stores/learnSyncStore"

type Wire = {
  song_id: string
  number: number
  title: string
  started_at: number
  removed: boolean
  path: Record<string, boolean>
  updated_at: number
}

const server = new Map<string, Wire>()
let requests: Array<{ method: string; body: { songs: Wire[] } | null }> = []
let offline = false

function installFetch() {
  globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    if (offline) throw new TypeError("Network request failed")
    const method = init?.method ?? "GET"
    const body = init?.body ? (JSON.parse(String(init.body)) as { songs: Wire[] }) : null
    requests.push({ method, body })
    if (method === "PUT" && body) {
      for (const incoming of body.songs) {
        const current = server.get(incoming.song_id)
        if (!current || incoming.updated_at > current.updated_at) server.set(incoming.song_id, incoming)
      }
    }
    return new Response(JSON.stringify({ songs: [...server.values()], updated_at: null, max_entries: 1000 }), { status: 200 })
  }) as unknown as typeof fetch
}

const flush = async (ms = 0) => {
  await vi.advanceTimersByTimeAsync(ms)
}

function signIn(id = "member-a") {
  useAuthStore.getState().applyMemberSession({ displayName: id, email: `${id}@example.com`, memberId: id, identityProvider: "google" })
}

let stop = () => undefined as void

beforeAll(async () => {
  await Promise.all([
    useAuthStore.persist.rehydrate(),
    useLearnStore.persist.rehydrate(),
    useLearnSyncStore.persist.rehydrate(),
  ])
  reconcileAllOwners()
})

beforeEach(async () => {
  vi.useFakeTimers()
  server.clear()
  requests = []
  offline = false
  installFetch()
  useAuthStore.getState().signOut()
  useLearnStore.setState({ songs: [], paths: {}, cards: {}, quizBest: {}, owner: null, slots: {} })
  useLearnSyncStore.setState({ byOwner: {} })
  reconcileAllOwners()
  await flush()
  stop = startLearnSync()
})

afterEach(() => {
  stop()
  vi.useRealTimers()
})

describe("Learn sync at runtime", () => {
  it("a guest is never synced", async () => {
    addSongToLearn(7, "Seven")
    await flush(PUSH_DEBOUNCE_MS + 5000)
    expect(requests).toEqual([])
    expect(useLearnSyncStore.getState().byOwner).toEqual({})
    expect(useLearnStore.getState().songs).toHaveLength(1)
  })

  it("pulls on sign-in and fills an empty phone from the account", async () => {
    server.set("ps-3", {
      song_id: "ps-3",
      number: 3,
      title: "Three",
      started_at: 1000,
      removed: false,
      path: { listen: true, words: false, meaning: false, chords: false },
      updated_at: 2000,
    })
    signIn()
    await flush(1500)
    expect(requests.map((r) => r.method)).toEqual(["GET"])
    expect(useLearnStore.getState().songs.map((s) => s.songId)).toEqual(["ps-3"])
    expect(useLearnStore.getState().paths["ps-3"]?.listen).toBe(true)
    // taking the server's copy is not a local change: nothing is sent back
    await flush(PUSH_DEBOUNCE_MS + 5000)
    expect(requests.every((r) => r.method === "GET")).toBe(true)
  })

  it("pushes once, a few seconds after a burst of changes", async () => {
    signIn()
    await flush(1500)
    requests = []
    addSongToLearn(1, "One")
    addSongToLearn(2, "Two")
    useLearnStore.getState().markPart("ps-1", "listen")
    await flush(PUSH_DEBOUNCE_MS - 100)
    expect(requests).toEqual([])
    await flush(200)
    const puts = requests.filter((r) => r.method === "PUT")
    expect(puts).toHaveLength(1)
    expect(puts[0]?.body?.songs.map((s) => s.song_id).sort()).toEqual(["ps-1", "ps-2"])
    expect(server.get("ps-1")?.path.listen).toBe(true)
    // and the second look finds nothing waiting
    requests = []
    await syncLearnNow()
    expect(requests.map((r) => r.method)).toEqual(["GET"])
  })

  it("a guest's songs go to the account that signs in, and nothing is lost", async () => {
    addSongToLearn(9, "Nine")
    useLearnStore.getState().markPart("ps-9", "chords")
    signIn()
    await flush(1500)
    expect(requests.some((r) => r.method === "PUT")).toBe(true)
    expect(server.get("ps-9")?.path.chords).toBe(true)
    expect(useLearnStore.getState().songs.map((s) => s.songId)).toEqual(["ps-9"])
  })

  it("offline: local data stays, the change waits, and goes out when the network is back", async () => {
    signIn()
    await flush(1500)
    offline = true
    addSongToLearn(4, "Four")
    await flush(PUSH_DEBOUNCE_MS + 100)
    expect(useLearnStore.getState().songs.map((s) => s.songId)).toEqual(["ps-4"])
    expect(server.size).toBe(0)
    const waiting = Object.values(useLearnSyncStore.getState().byOwner["member:member-a"] ?? {})
    expect(waiting.some((e) => e.dirty)).toBe(true)

    offline = false
    const outcome = await syncLearnNow()
    expect(outcome.status).toBe("ok")
    expect(server.get("ps-4")?.title).toBe("Four")
  })

  it("an older server copy does not overwrite newer local progress", async () => {
    server.set("ps-5", {
      song_id: "ps-5",
      number: 5,
      title: "Five",
      started_at: 1000,
      removed: false,
      path: { listen: true, words: false, meaning: false, chords: false },
      updated_at: 2000,
    })
    signIn()
    await flush(1500)
    useLearnStore.getState().markPart("ps-5", "words")
    await flush(PUSH_DEBOUNCE_MS + 100)
    expect(useLearnStore.getState().paths["ps-5"]).toMatchObject({ listen: true, words: true })
    expect(server.get("ps-5")?.path.words).toBe(true)
  })

  it("after sign-out nothing is sent, and the other account never sees this one's songs", async () => {
    signIn("member-a")
    await flush(1500)
    addSongToLearn(6, "Six")
    await flush(PUSH_DEBOUNCE_MS + 100)
    expect(server.has("ps-6")).toBe(true)

    useAuthStore.getState().signOut()
    await flush(100)
    requests = []
    addSongToLearn(8, "Eight") // a guest again
    await flush(PUSH_DEBOUNCE_MS + 5000)
    expect(requests).toEqual([])
    expect(server.has("ps-8")).toBe(false)

    server.clear() // member B has an empty account
    signIn("member-b")
    await flush(1500)
    expect(useLearnStore.getState().songs.map((s) => s.songId)).not.toContain("ps-6")
    expect(useLearnSyncStore.getState().byOwner["member:member-b"]).toBeDefined()
  })
})
