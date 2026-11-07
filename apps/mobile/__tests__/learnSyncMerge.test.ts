import { describe, expect, it } from "vitest"

import { EMPTY_PATH, type LearningSong, type PathState } from "@/lib/learn/progress"
import {
  applyRemote,
  captureLocal,
  dirtyEntries,
  hasDirty,
  sameContent,
  type LearnLists,
  type MetaEntry,
  type SyncEntry,
  type SyncMeta,
} from "@/lib/learn/syncMerge"

const T = 1_700_000_000_000
const path = (over: Partial<PathState> = {}): PathState => ({ ...EMPTY_PATH, ...over })
const song = (number: number, startedAt = T): LearningSong => ({
  songId: `ps-${number}`,
  number,
  title: `Song ${number}`,
  startedAt,
})
const lists = (songs: LearningSong[] = [], paths: Record<string, PathState> = {}): LearnLists => ({ songs, paths })
const entry = (number: number, over: Partial<SyncEntry> = {}): SyncEntry => ({
  songId: `ps-${number}`,
  number,
  title: `Song ${number}`,
  startedAt: T,
  removed: false,
  path: path(),
  updatedAt: T + 1000,
  ...over,
})
const meta = (e: SyncEntry, over: Partial<MetaEntry> = {}): MetaEntry => ({ ...e, dirty: false, adopted: false, ...over })
const metaOf = (...entries: MetaEntry[]): SyncMeta => Object.fromEntries(entries.map((e) => [e.songId, e]))

describe("captureLocal", () => {
  it("first sight of a listed song: stamped with its own start time, marked adopted and dirty", () => {
    const next = captureLocal({}, lists([song(7, T - 5000)], { "ps-7": path({ listen: true }) }), T)
    expect(next["ps-7"]).toMatchObject({ updatedAt: T - 5000, dirty: true, adopted: true, removed: false })
    expect(next["ps-7"]?.path.listen).toBe(true)
  })

  it("a start time in the future is cut to now", () => {
    expect(captureLocal({}, lists([song(7, T + 99_999)]), T)["ps-7"]?.updatedAt).toBe(T)
  })

  it("returns the same object when nothing changed", () => {
    const m = metaOf(meta(entry(7, { updatedAt: T })))
    expect(captureLocal(m, lists([song(7)], { "ps-7": EMPTY_PATH }), T + 10)).toBe(m)
  })

  it("a changed path is stamped now and dirty", () => {
    const m = metaOf(meta(entry(7, { updatedAt: T })))
    const next = captureLocal(m, lists([song(7)], { "ps-7": path({ words: true }) }), T + 500)
    expect(next["ps-7"]).toMatchObject({ updatedAt: T + 500, dirty: true, adopted: false })
    expect(next["ps-7"]?.path.words).toBe(true)
  })

  it("the stamp always moves forward, even if the clock did not", () => {
    const m = metaOf(meta(entry(7, { updatedAt: T + 5000 })))
    const next = captureLocal(m, lists([song(7)], { "ps-7": path({ words: true }) }), T)
    expect(next["ps-7"]?.updatedAt).toBe(T + 5001)
  })

  it("a song that left the list becomes a removal marker that keeps its progress", () => {
    const m = metaOf(meta(entry(7, { path: path({ listen: true }) })))
    const next = captureLocal(m, lists([], { "ps-7": path({ listen: true, words: true }) }), T + 9000)
    expect(next["ps-7"]).toMatchObject({ removed: true, dirty: true, updatedAt: T + 9000 })
    expect(next["ps-7"]?.path.words).toBe(true)
    // and it is not stamped again on the next look
    expect(captureLocal(next, lists([], { "ps-7": path({ listen: true, words: true }) }), T + 20000)).toBe(next)
  })

  it("a removed song put back is a new change", () => {
    const m = metaOf(meta(entry(7, { removed: true, updatedAt: T })))
    const next = captureLocal(m, lists([song(7)], { "ps-7": EMPTY_PATH }), T + 100)
    expect(next["ps-7"]).toMatchObject({ removed: false, dirty: true, updatedAt: T + 100 })
  })

  it("ignores list entries that are not Prabhat Samgiita numbers", () => {
    expect(captureLocal({}, lists([song(99999)]), T)).toEqual({})
  })
})

describe("dirtyEntries", () => {
  it("sends only what is waiting, without the bookkeeping fields", () => {
    const m = metaOf(meta(entry(1)), meta(entry(2), { dirty: true, adopted: true }))
    expect(hasDirty(m)).toBe(true)
    const sent = dirtyEntries(m)
    expect(sent).toEqual([entry(2)])
    expect(sent[0]).not.toHaveProperty("dirty")
    expect(sent[0]).not.toHaveProperty("adopted")
  })
})

describe("applyRemote: the server never beats a newer local copy", () => {
  it("takes a song the phone has never seen", () => {
    const r = applyRemote({}, lists(), [entry(3, { path: path({ listen: true }) })], T)
    expect(r.listsChanged).toBe(true)
    expect(r.lists.songs.map((s) => s.songId)).toEqual(["ps-3"])
    expect(r.lists.paths["ps-3"]?.listen).toBe(true)
    expect(r.meta["ps-3"]).toMatchObject({ dirty: false, adopted: false })
  })

  it("keeps the start-time order when it adds a song", () => {
    const l = lists([song(1, T), song(9, T + 900)])
    const r = applyRemote(metaOf(meta(entry(1, { startedAt: T })), meta(entry(9, { startedAt: T + 900 }))), l, [entry(5, { startedAt: T + 500 })], T)
    expect(r.lists.songs.map((s) => s.songId)).toEqual(["ps-1", "ps-5", "ps-9"])
  })

  it("an older server copy leaves local data alone and the local copy is sent next", () => {
    const local = meta(entry(4, { updatedAt: T + 5000, path: path({ listen: true, words: true }) }), { dirty: true })
    const l = lists([song(4)], { "ps-4": local.path })
    const r = applyRemote(metaOf(local), l, [entry(4, { updatedAt: T + 1000, path: path({ listen: true }) })], T + 9000)
    expect(r.listsChanged).toBe(false)
    expect(r.lists).toBe(l)
    expect(r.meta["ps-4"]).toMatchObject({ dirty: true, updatedAt: T + 5000 })
    expect(r.meta["ps-4"]?.path.words).toBe(true)
  })

  it("an older server copy marks a clean local copy as waiting to be sent", () => {
    const local = meta(entry(4, { updatedAt: T + 5000, path: path({ listen: true }) }))
    const r = applyRemote(metaOf(local), lists([song(4)], { "ps-4": local.path }), [entry(4, { updatedAt: T + 1000 })], T + 9000)
    expect(r.meta["ps-4"]?.dirty).toBe(true)
  })

  it("a newer server copy replaces the local one", () => {
    const local = meta(entry(4, { updatedAt: T + 1000 }))
    const r = applyRemote(
      metaOf(local),
      lists([song(4)], { "ps-4": EMPTY_PATH }),
      [entry(4, { updatedAt: T + 7000, title: "Renamed", path: path({ chords: true }) })],
      T + 9000,
    )
    expect(r.listsChanged).toBe(true)
    expect(r.lists.songs[0]?.title).toBe("Renamed")
    expect(r.lists.paths["ps-4"]?.chords).toBe(true)
    expect(r.meta["ps-4"]).toMatchObject({ dirty: false, updatedAt: T + 7000 })
  })

  it("a newer removal takes the song off the list but keeps its progress", () => {
    const local = meta(entry(4, { updatedAt: T + 1000 }))
    const r = applyRemote(
      metaOf(local),
      lists([song(4)], { "ps-4": EMPTY_PATH }),
      [entry(4, { updatedAt: T + 7000, removed: true, path: path({ listen: true }) })],
      T + 9000,
    )
    expect(r.lists.songs).toEqual([])
    expect(r.lists.paths["ps-4"]?.listen).toBe(true)
  })

  it("an older removal does not take away a song that was put back later", () => {
    const local = meta(entry(4, { updatedAt: T + 9000 }), { dirty: true })
    const l = lists([song(4)], { "ps-4": EMPTY_PATH })
    const r = applyRemote(metaOf(local), l, [entry(4, { updatedAt: T + 2000, removed: true })], T + 10_000)
    expect(r.lists.songs).toHaveLength(1)
    expect(r.listsChanged).toBe(false)
  })

  it("the same stamp and content confirms what was sent", () => {
    const local = meta(entry(4), { dirty: true, adopted: true })
    const r = applyRemote(metaOf(local), lists([song(4)], { "ps-4": EMPTY_PATH }), [entry(4)], T + 9000)
    expect(r.meta["ps-4"]).toMatchObject({ dirty: false, adopted: false })
    expect(r.listsChanged).toBe(false)
  })

  it("the server's earlier stamp for the same content (it cut a fast clock) is adopted, not resent", () => {
    const local = meta(entry(4, { updatedAt: T + 9_000_000 }), { dirty: true })
    const r = applyRemote(metaOf(local), lists([song(4)], { "ps-4": EMPTY_PATH }), [entry(4, { updatedAt: T + 3000 })], T + 4000)
    expect(r.meta["ps-4"]).toMatchObject({ dirty: false, updatedAt: T + 3000 })
  })

  it("a tie with different content follows the server (it keeps its own on a tie)", () => {
    const local = meta(entry(4, { title: "Mine" }), { dirty: true })
    const r = applyRemote(metaOf(local), lists([{ ...song(4), title: "Mine" }], { "ps-4": EMPTY_PATH }), [entry(4, { title: "Theirs" })], T)
    expect(r.lists.songs[0]?.title).toBe("Theirs")
    expect(r.meta["ps-4"]?.dirty).toBe(false)
  })

  it("a song first seen on this phone keeps its progress when the server's newer copy has less", () => {
    const local = meta(entry(4, { updatedAt: T - 9000, path: path({ listen: true, words: true }) }), {
      dirty: true,
      adopted: true,
    })
    const r = applyRemote(
      metaOf(local),
      lists([song(4)], { "ps-4": local.path }),
      [entry(4, { updatedAt: T + 1000, path: path({ listen: true, chords: true }) })],
      T + 5000,
    )
    expect(r.meta["ps-4"]?.path).toEqual(path({ listen: true, words: true, chords: true }))
    expect(r.meta["ps-4"]).toMatchObject({ dirty: true, adopted: false })
    expect(r.meta["ps-4"]?.updatedAt).toBeGreaterThan(T + 1000)
    expect(r.lists.paths["ps-4"]).toEqual(path({ listen: true, words: true, chords: true }))
  })

  it("a song that is not adopted takes the server's newer copy as it is", () => {
    const local = meta(entry(4, { updatedAt: T, path: path({ listen: true, words: true }) }), { dirty: true })
    const r = applyRemote(
      metaOf(local),
      lists([song(4)], { "ps-4": local.path }),
      [entry(4, { updatedAt: T + 1000, path: path({ listen: true }) })],
      T + 5000,
    )
    expect(r.meta["ps-4"]?.path.words).toBe(false)
  })

  it("skips server entries that are not usable songs", () => {
    const r = applyRemote({}, lists(), [entry(99999), { ...entry(3), songId: "ps-4" }], T)
    expect(r.meta).toEqual({})
    expect(r.listsChanged).toBe(false)
  })

  it("after taking the server's copy the next capture finds nothing new to send", () => {
    const r = applyRemote({}, lists(), [entry(3, { path: path({ words: true }) }), entry(5, { removed: true })], T)
    expect(captureLocal(r.meta, r.lists, T + 100)).toBe(r.meta)
  })
})

describe("applyRemote: a server that lost its copy", () => {
  it("an empty server with songs thought to be in step sends them again", () => {
    const m = metaOf(meta(entry(1)), meta(entry(2, { removed: true })), meta(entry(3), { dirty: true }))
    const r = applyRemote(m, lists([song(1), song(3)]), [], T)
    expect(r.meta["ps-1"]?.dirty).toBe(true)
    expect(r.meta["ps-2"]?.dirty).toBe(false) // a removal marker is not resent
    expect(r.meta["ps-3"]?.dirty).toBe(true)
    expect(r.listsChanged).toBe(false)
  })

  it("an empty server and nothing local changes nothing", () => {
    const r = applyRemote({}, lists(), [], T)
    expect(r.meta).toEqual({})
  })
})

describe("sameContent", () => {
  it("ignores the time and compares what the song is", () => {
    expect(sameContent(entry(1, { updatedAt: 1 }), entry(1, { updatedAt: 2 }))).toBe(true)
    expect(sameContent(entry(1), entry(1, { path: path({ listen: true }) }))).toBe(false)
    expect(sameContent(entry(1), entry(1, { removed: true }))).toBe(false)
  })
})
