import { describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}))
vi.mock("@/lib/client", () => ({ api: { fetchSongs: vi.fn() } }))

import { chordsFirst, rankForQuery, wantsChords, withoutChordWords } from "@/lib/songsV2/chordsFirst"
import { songSetFromWire, fetchSongsWithChords } from "@/lib/songChords/withChords"
import { rankSearchByChords, searchLocal } from "@/lib/unifiedSearch"

/** Dada, 10 Nov 2026: "With chords first" on the Songs list, and Search ranks songs with chords first for a guitar-ish query. */

describe("which words ask for chords", () => {
  it.each(["guitar", "Guitar songs", "chords for 1", "capo 2", "ukulele", "гитара", "песни для гитары", "аккорды", "Аккорды к песне", "acordes de guitarra"])(
    "%s asks for chords",
    (query) => expect(wantsChords(query)).toBe(true),
  )
  it.each(["", "bandhu he niye calo", "friend", "дружба", "discord"])("%s does not (the stem must start a word)", (query) =>
    expect(wantsChords(query)).toBe(false),
  )
  it("takes the guitar-ish words out of the query so the song's own words still match", () => {
    expect(withoutChordWords("bandhu guitar")).toBe("bandhu")
    expect(withoutChordWords("аккорды  дружба")).toBe("дружба")
    expect(withoutChordWords("bandhu he niye calo")).toBe("bandhu he niye calo")
    expect(withoutChordWords("guitar chords")).toBe("guitar chords") // nothing else typed: left as it was
  })
})

describe("chords first", () => {
  const has = (n: number) => [3, 7, 9].includes(n)
  it("puts the songs with chords before the rest and keeps the order inside each half", () => {
    expect(chordsFirst([1, 2, 3, 4, 7, 8, 9], has)).toEqual([3, 7, 9, 1, 2, 4, 8])
  })
  it("is stable and does not touch the input", () => {
    const input = [9, 2, 7, 1, 3]
    expect(chordsFirst(input, has)).toEqual([9, 7, 3, 2, 1])
    expect(input).toEqual([9, 2, 7, 1, 3])
  })
  it("leaves a list as it is when nothing, or everything, has chords", () => {
    expect(chordsFirst([5, 4, 6], () => false)).toEqual([5, 4, 6])
    expect(chordsFirst([5, 4, 6], () => true)).toEqual([5, 4, 6])
    expect(chordsFirst([], has)).toEqual([])
  })
  it("treats unknown (null, undefined) as without chords", () => {
    expect(chordsFirst([1, 2, 3], (n) => (n === 3 ? true : n === 2 ? null : undefined))).toEqual([3, 1, 2])
  })
  it("ranks for a query only when the query asks for chords", () => {
    expect(rankForQuery([1, 3, 2, 7], "guitar", has)).toEqual([3, 7, 1, 2])
    expect(rankForQuery([1, 3, 2, 7], "bandhu", has)).toEqual([1, 3, 2, 7])
  })
})

describe("the list of songs with chords from the API", () => {
  it("keeps whole positive song numbers only", () => {
    expect([...songSetFromWire({ songs: [3, 19, 0, -2, 1.5, NaN] })]).toEqual([3, 19])
    expect(songSetFromWire(null).size).toBe(0)
    expect(songSetFromWire({}).size).toBe(0)
  })
  it("reads it from the public route", async () => {
    const calls: string[] = []
    const fake = (async (url: string) => {
      calls.push(url)
      return { ok: true, status: 200, json: async () => ({ songs: [3, 19] }) }
    }) as unknown as typeof fetch
    const set = await fetchSongsWithChords({ baseUrl: "https://api.example/", headers: () => ({}), fetch: fake })
    expect([...set]).toEqual([3, 19])
    expect(calls).toEqual(["https://api.example/api/v1/song-chords/with-chords"])
  })
  it("fails with an error the list can swallow (offline, server down)", async () => {
    const down = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch
    await expect(fetchSongsWithChords({ baseUrl: "https://api.example", headers: () => ({}), fetch: down })).rejects.toThrow()
    const offline = (async () => { throw new Error("offline") }) as unknown as typeof fetch
    await expect(fetchSongsWithChords({ baseUrl: "https://api.example", headers: () => ({}), fetch: offline })).rejects.toThrow()
  })
})

describe("Search ranks songs with chords first for a guitar-ish query", () => {
  const numbers = (query: string, chords: Set<number> | null) =>
    rankSearchByChords(searchLocal(query), chords).groups.flatMap((g) => g.items.map((i) => i.song.number))

  it("keeps the song's own words working with the guitar word beside them", () => {
    expect(searchLocal("bandhu he niye calo guitar").groups[0].items[0].song.number).toBe(searchLocal("bandhu he niye calo").groups[0].items[0].song.number)
    expect(searchLocal("bandhu he niye calo guitar").query).toBe("bandhu he niye calo guitar")
  })
  it("moves the songs with chords up inside the group", () => {
    const plain = numbers("friend", null)
    expect(plain.length).toBeGreaterThan(2)
    const last = plain[plain.length - 1]
    const ranked = numbers("friend guitar", new Set([last]))
    expect(ranked[0]).toBe(last)
    expect(ranked.slice(1)).toEqual(plain.filter((n) => n !== last)) // the rest in the order they had
  })
  it("changes nothing for an ordinary query, or while it is not known which songs have chords", () => {
    const plain = numbers("friend", null)
    expect(numbers("friend", new Set([plain[plain.length - 1]]))).toEqual(plain)
    expect(numbers("friend guitar", null)).toEqual(numbers("friend guitar", new Set()))
  })
})
