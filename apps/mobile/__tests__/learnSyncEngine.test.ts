import { describe, expect, it, vi } from "vitest"

import { EMPTY_PATH, type LearningSong, type PathState } from "@/lib/learn/progress"
import {
  createLearnSyncTransport,
  entriesFromBody,
  entryFromWire,
  entryToWire,
  LearnSyncError,
  type LearnSyncTransport,
} from "@/lib/learn/syncApi"
import { createLearnSyncEngine, RETRY_AFTER_MS } from "@/lib/learn/syncEngine"
import type { LearnLists, SyncEntry, SyncMeta } from "@/lib/learn/syncMerge"

const T = 1_700_000_000_000
const path = (over: Partial<PathState> = {}): PathState => ({ ...EMPTY_PATH, ...over })

/** The server's rule, written independently of the app: newest updated_at per song wins, a tie keeps the stored one. */
function fakeServer() {
  const docs = new Map<string, SyncEntry>()
  const calls: string[] = []
  const transport: LearnSyncTransport = {
    pull: async () => {
      calls.push("GET")
      return [...docs.values()]
    },
    push: async (entries) => {
      calls.push(`PUT:${entries.map((e) => e.songId).join(",")}`)
      for (const e of entries) {
        const current = docs.get(e.songId)
        if (!current || e.updatedAt > current.updatedAt) docs.set(e.songId, { ...e })
      }
      return [...docs.values()]
    },
  }
  return { docs, calls, transport }
}

/** One phone: a Learn store in memory, its sync bookkeeping, a clock it controls. */
function phone(transport: LearnSyncTransport, startAt = T) {
  const state = {
    lists: { songs: [] as LearningSong[], paths: {} as Record<string, PathState> } as LearnLists,
    meta: {} as SyncMeta,
    owner: "member:a" as string | null,
    epoch: 1,
    clock: startAt,
    transport,
  }
  const engine = createLearnSyncEngine({
    owner: () => state.owner,
    epoch: () => state.epoch,
    readLists: () => state.lists,
    writeLists: (lists) => {
      state.lists = lists
    },
    readMeta: () => state.meta,
    writeMeta: (_owner, meta) => {
      state.meta = meta
    },
    transport: {
      pull: () => state.transport.pull(),
      push: (entries) => state.transport.push(entries),
    },
    now: () => state.clock,
  })
  const add = (number: number, title = `Song ${number}`) => {
    const songId = `ps-${number}`
    state.lists = {
      songs: [...state.lists.songs, { songId, number, title, startedAt: state.clock }],
      paths: { ...state.lists.paths, [songId]: state.lists.paths[songId] ?? EMPTY_PATH },
    }
  }
  const mark = (number: number, part: keyof PathState) => {
    const songId = `ps-${number}`
    state.lists = { ...state.lists, paths: { ...state.lists.paths, [songId]: { ...(state.lists.paths[songId] ?? EMPTY_PATH), [part]: true } } }
  }
  const remove = (number: number) => {
    state.lists = { ...state.lists, songs: state.lists.songs.filter((s) => s.number !== number) }
  }
  return { state, engine, add, mark, remove, tick: (ms: number) => (state.clock += ms) }
}

describe("two phones of one member", () => {
  it("a song added on one phone appears on the other with its progress", async () => {
    const server = fakeServer()
    const a = phone(server.transport)
    const b = phone(server.transport, T + 1)
    a.add(7)
    a.tick(1000)
    a.mark(7, "listen")
    expect(await a.engine.syncNow()).toEqual({ status: "ok", pending: false })

    expect(await b.engine.syncNow()).toEqual({ status: "ok", pending: false })
    expect(b.state.lists.songs.map((s) => s.songId)).toEqual(["ps-7"])
    expect(b.state.lists.paths["ps-7"]?.listen).toBe(true)
    // nothing left to send from the phone that only read
    expect(Object.values(b.state.meta).some((m) => m.dirty)).toBe(false)
  })

  it("the newest change per song wins, in both directions", async () => {
    const server = fakeServer()
    const a = phone(server.transport)
    const b = phone(server.transport)
    a.add(1)
    a.add(2)
    await a.engine.syncNow()
    await b.engine.syncNow()

    a.tick(10_000)
    a.mark(1, "words") // a changes song 1
    b.tick(20_000)
    b.mark(2, "chords") // b changes song 2, later
    await a.engine.syncNow()
    await b.engine.syncNow()
    await a.engine.syncNow()

    for (const p of [a, b]) {
      expect(p.state.lists.paths["ps-1"]?.words).toBe(true)
      expect(p.state.lists.paths["ps-2"]?.chords).toBe(true)
    }
  })

  it("taking a song off on one phone takes it off on the other, progress kept", async () => {
    const server = fakeServer()
    const a = phone(server.transport)
    const b = phone(server.transport)
    a.add(5)
    a.mark(5, "listen")
    await a.engine.syncNow()
    await b.engine.syncNow()
    expect(b.state.lists.songs).toHaveLength(1)

    a.tick(5000)
    a.remove(5)
    await a.engine.syncNow()
    b.tick(6000)
    await b.engine.syncNow()
    expect(b.state.lists.songs).toEqual([])
    expect(b.state.lists.paths["ps-5"]?.listen).toBe(true)
  })

  it("an older server copy never overwrites newer local progress (and the local copy reaches the server)", async () => {
    const server = fakeServer()
    const a = phone(server.transport)
    a.add(3)
    await a.engine.syncNow()
    // the server holds an older picture than what the phone did offline
    a.tick(60_000)
    a.mark(3, "listen")
    a.mark(3, "words")
    a.state.transport = {
      pull: async () => {
        throw new LearnSyncError(0)
      },
      push: async () => {
        throw new LearnSyncError(0)
      },
    }
    expect((await a.engine.syncNow({ force: true })).status).toBe("failed")
    expect(a.state.lists.paths["ps-3"]).toMatchObject({ listen: true, words: true })

    a.state.transport = server.transport
    expect(await a.engine.syncNow({ force: true })).toEqual({ status: "ok", pending: false })
    expect(a.state.lists.paths["ps-3"]).toMatchObject({ listen: true, words: true })
    expect(server.docs.get("ps-3")?.path).toMatchObject({ listen: true, words: true })
  })

  it("a new phone does not lose its own progress when the account already has a newer, smaller copy", async () => {
    const server = fakeServer()
    const a = phone(server.transport, T + 100_000)
    a.add(8)
    a.mark(8, "chords")
    await a.engine.syncNow()

    // b had been learning song 8 as a guest, with other steps done, before it signed in
    const b = phone(server.transport, T + 200_000)
    b.state.lists = {
      songs: [{ songId: "ps-8", number: 8, title: "Song 8", startedAt: T }],
      paths: { "ps-8": path({ listen: true, words: true }) },
    }
    await b.engine.syncNow()
    expect(b.state.lists.paths["ps-8"]).toMatchObject({ listen: true, words: true, chords: true })
    await a.engine.syncNow()
    expect(a.state.lists.paths["ps-8"]).toMatchObject({ listen: true, words: true, chords: true })
  })

  it("a phone with the clock set far ahead settles instead of resending forever", async () => {
    const server = fakeServer()
    const cut = { ...server.transport }
    cut.push = async (entries) => {
      // the real server cuts a stamp from the future back to its own clock
      return server.transport.push(entries.map((e) => ({ ...e, updatedAt: Math.min(e.updatedAt, T + 1000) })))
    }
    const a = phone(cut, T + 99_000_000)
    a.add(2)
    const first = await a.engine.syncNow()
    expect(first).toEqual({ status: "ok", pending: false })
    server.calls.length = 0
    await a.engine.syncNow()
    expect(server.calls).toEqual(["GET"])
  })
})

describe("when it should not run", () => {
  it("does nothing without an account to sync (a guest)", async () => {
    const server = fakeServer()
    const a = phone(server.transport)
    a.state.owner = null
    a.add(1)
    expect(await a.engine.syncNow()).toEqual({ status: "skipped", reason: "not-ready" })
    expect(server.calls).toEqual([])
    expect(a.state.meta).toEqual({})
  })

  it("an answer that arrives after the account changed is dropped", async () => {
    const server = fakeServer()
    server.docs.set("ps-4", {
      songId: "ps-4",
      number: 4,
      title: "Song 4",
      startedAt: T,
      removed: false,
      path: path(),
      updatedAt: T + 1,
    })
    const a = phone(server.transport)
    a.state.transport = {
      pull: async () => {
        a.state.epoch += 1 // signed out and in while the request was out
        return [...server.docs.values()]
      },
      push: server.transport.push,
    }
    expect(await a.engine.syncNow()).toEqual({ status: "skipped", reason: "changed-account" })
    expect(a.state.lists.songs).toEqual([])
  })

  it("a failed round changes nothing, keeps what was waiting, and automatic rounds pause", async () => {
    const server = fakeServer()
    const a = phone(server.transport)
    a.add(1)
    let down = true
    a.state.transport = {
      pull: async () => server.transport.pull(),
      push: async (entries) => {
        if (down) throw new LearnSyncError(0)
        return server.transport.push(entries)
      },
    }
    expect(await a.engine.syncNow()).toEqual({ status: "failed", reason: "offline" })
    expect(Object.values(a.state.meta)[0]?.dirty).toBe(true)
    expect(server.docs.size).toBe(0)

    down = false
    a.tick(RETRY_AFTER_MS - 1)
    expect(await a.engine.syncNow()).toEqual({ status: "skipped", reason: "backoff" })
    expect(await a.engine.syncNow({ force: true })).toEqual({ status: "ok", pending: false })
    expect(server.docs.size).toBe(1)
  })

  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [413, "too-large"],
    [500, "server"],
  ] as const)("status %i is reported as %s", async (status, reason) => {
    const a = phone({
      pull: async () => {
        throw new LearnSyncError(status)
      },
      push: async () => {
        throw new LearnSyncError(status)
      },
    })
    expect(await a.engine.syncNow()).toEqual({ status: "failed", reason })
  })

  it("a call during a round makes it run once more instead of overlapping", async () => {
    const server = fakeServer()
    const a = phone(server.transport)
    a.add(1)
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const slow: LearnSyncTransport = {
      pull: server.transport.pull,
      push: async (entries) => {
        await gate
        return server.transport.push(entries)
      },
    }
    a.state.transport = slow
    const first = a.engine.syncNow()
    a.add(2) // a change while the first request is out
    const second = a.engine.syncNow()
    release()
    await first
    await second
    expect([...server.docs.keys()].sort()).toEqual(["ps-1", "ps-2"])
    expect(server.calls.filter((c) => c.startsWith("PUT")).length).toBe(2)
  })
})

describe("the wire format", () => {
  const entry: SyncEntry = {
    songId: "ps-7",
    number: 7,
    title: "Niiravatá",
    startedAt: T,
    removed: false,
    path: path({ listen: true }),
    updatedAt: T + 5,
  }

  it("round-trips an entry", () => {
    const wire = entryToWire(entry)
    expect(wire).toEqual({
      song_id: "ps-7",
      number: 7,
      title: "Niiravatá",
      started_at: T,
      removed: false,
      path: { listen: true, words: false, meaning: false, chords: false },
      updated_at: T + 5,
    })
    expect(entryFromWire(wire)).toEqual(entry)
  })

  it("skips replies that are not usable songs instead of trusting them", () => {
    expect(entryFromWire(null)).toBeNull()
    expect(entryFromWire({ ...entryToWire(entry), title: "  " })).toBeNull()
    expect(entryFromWire({ ...entryToWire(entry), updated_at: 0 })).toBeNull()
    expect(entryFromWire({ ...entryToWire(entry), number: "7" })).toBeNull()
    expect(entriesFromBody({ songs: [entryToWire(entry), { nonsense: true }] })).toEqual([entry])
    expect(() => entriesFromBody({})).toThrow(LearnSyncError)
  })

  it("reads missing path flags as not done", () => {
    const wire = { ...entryToWire(entry), path: undefined }
    expect(entryFromWire(wire)?.path).toEqual(EMPTY_PATH)
  })
})

describe("the transport", () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

  it("GETs and PUTs the member endpoint with the member headers", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => ok({ songs: [] }))
    const transport = createLearnSyncTransport({
      baseUrl: "https://api.example.test/",
      headers: () => ({ "X-Member-Proxy-Key": "k", "X-MS-CLIENT-PRINCIPAL": "p" }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await transport.pull()
    await transport.push([
      { songId: "ps-1", number: 1, title: "A", startedAt: 1, removed: false, path: EMPTY_PATH, updatedAt: 2 },
    ])
    const [getUrl, getInit] = fetchImpl.mock.calls[0]!
    expect(getUrl).toBe("https://api.example.test/api/v1/members/me/learn-progress")
    expect(getInit.method).toBe("GET")
    expect(getInit.headers["X-Member-Proxy-Key"]).toBe("k")
    const [, putInit] = fetchImpl.mock.calls[1]!
    expect(putInit.method).toBe("PUT")
    expect(putInit.headers["Content-Type"]).toBe("application/json")
    expect(JSON.parse(putInit.body).songs[0]).toMatchObject({ song_id: "ps-1", updated_at: 2 })
  })

  it("turns every failure into a LearnSyncError with a status", async () => {
    const make = (impl: () => Promise<Response>) =>
      createLearnSyncTransport({ baseUrl: "https://x.test", headers: () => ({}), fetchImpl: impl as unknown as typeof fetch })
    await expect(make(async () => new Response("no", { status: 401 })).pull()).rejects.toMatchObject({ status: 401 })
    await expect(
      make(async () => new Response("big", { status: 413, headers: { "X-Error-Code": "learn_progress_too_large" } })).push([]),
    ).rejects.toMatchObject({ status: 413, code: "learn_progress_too_large" })
    await expect(
      make(async () => {
        throw new TypeError("Network request failed")
      }).pull(),
    ).rejects.toMatchObject({ status: 0 })
    await expect(make(async () => new Response("not json", { status: 200 })).pull()).rejects.toMatchObject({ status: 0 })
  })
})
