import { describe, expect, it } from "vitest"

import { ARTIST_FIXTURES } from "@/lib/fixtures/artists"
import { KIRTAN_FIXTURES, MIX_FIXTURES } from "@/lib/fixtures/kirtan"
import {
  artistById,
  artistCountLabel,
  artistForAuthor,
  artistInitials,
  artistSourceName,
  artistsWithKirtans,
  artistToneIndex,
  kiirtanSubtitle,
  kirtansOfArtist,
  popularOf,
} from "@/lib/kirtan/artists"
import { filterByLength, lengthBucketOf, longKirtans } from "@/lib/kirtan/length"
import {
  SOURCE_ALL_KIIRTANS,
  SOURCE_EVERYTHING,
  everythingQueue,
  kiirtanListSourceName,
  kiirtanQueue,
  mixItemNumber,
  mixQueue,
  mixSourceName,
  queueCaption,
  shuffled,
  startOf,
} from "@/lib/kirtan/queueBuild"
import { dayNumberOf, kiirtanOfTheDay, resumeEntries, resumeLabel, resumeProgress } from "@/lib/kirtan/resume"
import { KIRTAN_TAB_CHIPS, emptyListText, newKirtansList, parseKirtanTabChip, savedKirtans, typeCards } from "@/lib/kirtan/tab"
import {
  KIIRTAN_NUMBER_BASE,
  isKiirtanNumber,
  kiirtanByline,
  kiirtanNumber,
  kiirtanToSong,
  kiirtanSongForNumber,
  trackKindOfNumber,
  trackLabel,
  trackTag,
} from "@/lib/kirtan/track"
import { SEARCH_SCOPES, parseSearchScope, scopeShows, searchKirtans } from "@/lib/kirtan/search"
import { buildLibraryItems, filterLibrary } from "@/lib/libraryProposal"
import type { Kirtan } from "@/lib/kirtan/types"

/** A fixed random source so shuffles are repeatable. */
function seeded(seed = 7): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const approved = KIRTAN_FIXTURES.filter((k) => k.status === "approved")
const k = (over: Partial<Kirtan> & { id: string }): Kirtan => ({ ...KIRTAN_FIXTURES[0], ...over })

describe("one queue: track numbers", () => {
  it("gives a Kiirtan a stable number far above the catalog", () => {
    const n = kiirtanNumber("k-bnk-morning")
    expect(n).toBeGreaterThanOrEqual(KIIRTAN_NUMBER_BASE)
    expect(kiirtanNumber("k-bnk-morning")).toBe(n)
    expect(kiirtanNumber("k-lila-shiva")).not.toBe(n)
  })

  it("tells songs and Kiirtans apart", () => {
    expect(isKiirtanNumber(5018)).toBe(false)
    expect(isKiirtanNumber(kiirtanNumber("k-akhanda"))).toBe(true)
    expect(trackKindOfNumber(12)).toBe("song")
    expect(trackKindOfNumber(kiirtanNumber("k-akhanda"))).toBe("kiirtan")
  })

  it("labels queue rows PS or KIIRTAN", () => {
    expect(trackTag(12)).toBe("PS")
    expect(trackLabel(12)).toBe("PS 12")
    const n = kiirtanNumber("k-akhanda")
    expect(trackTag(n)).toBe("KIIRTAN")
    expect(trackLabel(n)).toBe("KIIRTAN")
  })

  it("turns a Kiirtan into a track with no lyrics and one audio file", () => {
    const song = kiirtanToSong(approved[0])
    expect(song.kind).toBe("kiirtan")
    expect(song.number).toBe(kiirtanNumber(approved[0].id))
    expect(song.lyrics).toBe("")
    expect(song.kiirtan).toMatchObject({ id: approved[0].id, type: approved[0].type })
    expect(kiirtanSongForNumber(song.number)).toBe(song)
    expect(kiirtanSongForNumber(12)).toBeNull()
  })

  it("words the byline", () => {
    expect(kiirtanByline("Priya")).toBe("Kiirtan · added by Priya")
    expect(kiirtanByline("  ")).toBe("Kiirtan")
  })
})

describe("one queue: building", () => {
  it("builds a mixed-kind queue for a mix, in order, PS and Kiirtan together", () => {
    const status = new Map(KIRTAN_FIXTURES.map((x) => [x.id, x]))
    const morning = MIX_FIXTURES[0]
    const queue = mixQueue(morning.items, status)
    expect(queue).toHaveLength(morning.items.length)
    expect(queue).toEqual(morning.items.map(mixItemNumber))
    expect(queue.some(isKiirtanNumber)).toBe(true)
    expect(queue.some((n) => !isKiirtanNumber(n))).toBe(true)
  })

  it("leaves out Kiirtans that are pending, rejected or unknown", () => {
    const items = [
      { kind: "ps" as const, number: 3 },
      { kind: "kirtan" as const, id: "a" },
      { kind: "kirtan" as const, id: "b" },
      { kind: "kirtan" as const, id: "ghost" },
    ]
    const status = new Map([
      ["a", { status: "approved" as const }],
      ["b", { status: "pending" as const }],
    ])
    expect(mixQueue(items, status)).toEqual([3, kiirtanNumber("a")])
  })

  it("queues a Kiirtan list in the order shown", () => {
    expect(kiirtanQueue(approved.slice(0, 3))).toEqual(approved.slice(0, 3).map((x) => kiirtanNumber(x.id)))
  })

  it("shuffles without losing or repeating anything, and does not touch the input", () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = shuffled(list, seeded())
    expect([...out].sort((a, b) => a - b)).toEqual(list)
    expect(list).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(out).not.toEqual(list)
    expect(shuffled(list, seeded())).toEqual(out)
  })

  it("shuffle everything holds every song and every approved Kiirtan once", () => {
    const songs = [10, 20, 30, 40]
    const withPending = [...approved, k({ id: "pending-x", status: "pending" })]
    const queue = everythingQueue(songs, withPending, seeded())
    expect(queue).toHaveLength(songs.length + approved.length)
    expect(new Set(queue).size).toBe(queue.length)
    expect(songs.every((n) => queue.includes(n))).toBe(true)
    expect(approved.every((x) => queue.includes(kiirtanNumber(x.id)))).toBe(true)
    expect(queue).not.toContain(kiirtanNumber("pending-x"))
  })

  it("starts at the asked number, else the first, else nowhere", () => {
    expect(startOf([5, 6, 7], 6)).toBe(6)
    expect(startOf([5, 6, 7], 99)).toBe(5)
    expect(startOf([5, 6, 7])).toBe(5)
    expect(startOf([], 6)).toBeNull()
  })

  it("captions a mixed queue", () => {
    const queue = [1, 2, kiirtanNumber("k-akhanda")]
    expect(queueCaption(queue, isKiirtanNumber)).toBe("2 songs + 1 kiirtan")
    expect(queueCaption([], isKiirtanNumber)).toBe("Empty")
  })
})

describe("one queue: source labels", () => {
  it("names the sources only Kiirtans and mixes have", () => {
    expect(SOURCE_ALL_KIIRTANS).toBe("All Kiirtans")
    expect(SOURCE_EVERYTHING).toBe("Everything")
    expect(mixSourceName("Morning")).toBe("Mix · Morning")
    expect(kiirtanListSourceName("Lila kiirtan")).toBe("Lila kiirtan Kiirtans")
    expect(kiirtanListSourceName("All")).toBe(SOURCE_ALL_KIIRTANS)
    expect(kiirtanListSourceName(null)).toBe(SOURCE_ALL_KIIRTANS)
    expect(artistSourceName("  Priya Devi ")).toBe("Priya Devi")
    expect(artistSourceName(" ")).toBe("Artist")
  })
})

describe("artists", () => {
  it("has about six artists and every fixture Kiirtan belongs to one", () => {
    expect(ARTIST_FIXTURES.length).toBeGreaterThanOrEqual(6)
    expect(new Set(ARTIST_FIXTURES.map((a) => a.id)).size).toBe(ARTIST_FIXTURES.length)
    for (const x of KIRTAN_FIXTURES) expect(artistForAuthor(ARTIST_FIXTURES, x.author)).not.toBeNull()
  })

  it("matches an author by name, ignoring case and extra spaces", () => {
    expect(artistForAuthor(ARTIST_FIXTURES, "  priya   DEVI ")?.id).toBe("priya-devi")
    expect(artistForAuthor(ARTIST_FIXTURES, "Nobody")).toBeNull()
    expect(artistForAuthor(ARTIST_FIXTURES, "")).toBeNull()
    expect(artistById(ARTIST_FIXTURES, "priya-devi")?.name).toBe("Priya Devi")
    expect(artistById(ARTIST_FIXTURES, "x")).toBeNull()
  })

  it("lists an artist's Kiirtans and the artists that have any", () => {
    const priya = artistById(ARTIST_FIXTURES, "priya-devi")!
    const own = kirtansOfArtist(priya, approved)
    expect(own.length).toBeGreaterThan(0)
    expect(own.every((x) => x.author === "Priya Devi")).toBe(true)
    const withAny = artistsWithKirtans(ARTIST_FIXTURES, approved)
    expect(withAny.every((a) => a.count > 0)).toBe(true)
    expect(withAny.map((a) => a.count)).toEqual([...withAny.map((a) => a.count)].sort((a, b) => b - a))
  })

  it("orders Popular by plays, then newest, at most five", () => {
    const list = [
      k({ id: "a", plays: 5, addedAt: 1 }),
      k({ id: "b", plays: 50, addedAt: 1 }),
      k({ id: "c", plays: 50, addedAt: 9 }),
      k({ id: "d", plays: undefined, addedAt: 3 }),
      k({ id: "e", plays: 1, addedAt: 3 }),
      k({ id: "f", plays: 2, addedAt: 3 }),
    ]
    expect(popularOf(list).map((x) => x.id)).toEqual(["c", "b", "a", "f", "e"])
    expect(popularOf(list, 2)).toHaveLength(2)
  })

  it("words counts, initials and the player subtitle", () => {
    expect(artistCountLabel(1)).toBe("1 kiirtan")
    expect(artistCountLabel(5)).toBe("5 kiirtans")
    expect(artistInitials("Priya Devi")).toBe("PD")
    expect(artistInitials("Arun")).toBe("A")
    expect(artistInitials(" ")).toBe("·")
    expect(artistToneIndex("priya-devi")).toBe(artistToneIndex("priya-devi"))
    expect(artistToneIndex("priya-devi")).toBeLessThan(4)
    expect(kiirtanSubtitle("Priya Devi", "Arun", ARTIST_FIXTURES)).toBe("Kiirtan · Priya Devi")
    expect(kiirtanSubtitle("Unknown", "Arun", ARTIST_FIXTURES)).toBe("Kiirtan · added by Arun")
    expect(kiirtanSubtitle("Unknown", "", ARTIST_FIXTURES)).toBe("Kiirtan")
  })
})

describe("by length", () => {
  it("puts the edges in the upper bucket", () => {
    expect(lengthBucketOf(14 * 60 + 59)).toBe("short")
    expect(lengthBucketOf(15 * 60)).toBe("mid")
    expect(lengthBucketOf(60 * 60 - 1)).toBe("mid")
    expect(lengthBucketOf(60 * 60)).toBe("long")
    expect(lengthBucketOf(null)).toBeNull()
    expect(lengthBucketOf(0)).toBeNull()
  })

  it("really filters the list, and an unknown length matches no bucket", () => {
    const list = [...approved, k({ id: "unknown", durationSec: null })]
    expect(filterByLength(list, null)).toHaveLength(list.length)
    for (const id of ["short", "mid", "long"] as const) {
      const part = filterByLength(list, id)
      expect(part.length).toBeGreaterThan(0)
      expect(part.every((x) => lengthBucketOf(x.durationSec) === id)).toBe(true)
    }
    expect(filterByLength(list, "short").some((x) => x.id === "unknown")).toBe(false)
  })

  it("long Kiirtans are an hour and more, longest first", () => {
    const long = longKirtans(approved)
    expect(long.length).toBeGreaterThanOrEqual(3)
    expect(long.every((x) => (x.durationSec ?? 0) >= 3600)).toBe(true)
    expect(long.map((x) => x.durationSec)).toEqual([...long.map((x) => x.durationSec)].sort((a, b) => (b ?? 0) - (a ?? 0)))
    expect(longKirtans(approved, 1)).toHaveLength(1)
  })
})

describe("jump back in and Kiirtan of the day", () => {
  it("words the resume line and the progress", () => {
    expect(resumeLabel(258, 760)).toBe("Resume 4:18 of 12:40")
    expect(resumeLabel(258, null)).toBe("Resume 4:18")
    expect(resumeProgress(380, 760)).toBe(0.5)
    expect(resumeProgress(9999, 760)).toBe(1)
    expect(resumeProgress(10, null)).toBe(0)
  })

  it("keeps only approved, started and unfinished Kiirtans", () => {
    const byId = new Map<string, Kirtan>([
      ["a", k({ id: "a", durationSec: 600 })],
      ["b", k({ id: "b", durationSec: 600, status: "pending" })],
      ["c", k({ id: "c", durationSec: 600 })],
      ["d", k({ id: "d", durationSec: 600 })],
      ["e", k({ id: "e", durationSec: 600 })],
    ])
    const out = resumeEntries(
      [
        { id: "ghost", positionSec: 30 },
        { id: "b", positionSec: 30 },
        { id: "a", positionSec: 0 },
        { id: "c", positionSec: 598 },
        { id: "d", positionSec: 100 },
        { id: "e", positionSec: 200 },
      ],
      byId,
    )
    expect(out.map((x) => x.kirtan.id)).toEqual(["d", "e"])
    expect(resumeEntries([{ id: "d", positionSec: 100 }, { id: "e", positionSec: 200 }], byId, 1)).toHaveLength(1)
  })

  it("picks the same one all day and another tomorrow", () => {
    const day = dayNumberOf(Date.UTC(2026, 10, 5, 3))
    expect(dayNumberOf(Date.UTC(2026, 10, 5, 23))).toBe(day)
    expect(kiirtanOfTheDay(approved, day)).toBe(kiirtanOfTheDay(approved, day))
    expect(kiirtanOfTheDay(approved, day + 1)).not.toBe(kiirtanOfTheDay(approved, day))
    expect(kiirtanOfTheDay([], day)).toBeNull()
    expect(kiirtanOfTheDay(approved, -1)).toBe(approved[approved.length - 1])
  })
})

describe("Kiirtan tab", () => {
  it("has the four sticky chips and falls back to All", () => {
    expect(KIRTAN_TAB_CHIPS.map((c) => c.label)).toEqual(["All", "Saved", "Downloaded", "My uploads"])
    expect(parseKirtanTabChip("mine")).toBe("mine")
    expect(parseKirtanTabChip(["saved"])).toBe("saved")
    expect(parseKirtanTabChip("zzz")).toBe("all")
    expect(parseKirtanTabChip(undefined)).toBe("all")
  })

  it("narrows New kiirtans by type and length together", () => {
    expect(newKirtansList(approved, null, null)).toHaveLength(approved.length)
    const lila = newKirtansList(approved, "lila", null)
    expect(lila.every((x) => x.type === "lila")).toBe(true)
    const both = newKirtansList(approved, "bnk", "long")
    expect(both.every((x) => x.type === "bnk" && (x.durationSec ?? 0) >= 3600)).toBe(true)
    expect(both.length).toBeGreaterThan(0)
    expect(newKirtansList(approved, "lila", "long")).toEqual([])
    expect(emptyListText("lila", "long")).toBe("No Kiirtans of this type and length yet.")
    expect(emptyListText(null, "long")).toBe("No Kiirtans of this length yet.")
    expect(emptyListText(null, null)).toBe("No Kiirtans yet.")
  })

  it("counts the type cards and lists saved ones that are approved", () => {
    const cards = typeCards(approved)
    expect(cards.map((c) => c.label)).toEqual(["Baba Nam Kevalam", "Lila kiirtan", "Festival", "Other"])
    expect(cards.reduce((n, c) => n + c.count, 0)).toBe(approved.length)
    const byId = new Map<string, Kirtan>([
      ["a", k({ id: "a" })],
      ["p", k({ id: "p", status: "pending" })],
    ])
    expect(savedKirtans(["p", "a", "gone"], byId).map((x) => x.id)).toEqual(["a"])
  })
})

describe("search and library", () => {
  it("has the four result chips and reads the scope parameter", () => {
    expect(SEARCH_SCOPES.map((c) => c.label)).toEqual(["All", "Songs", "Kiirtans", "Stories"])
    expect(parseSearchScope("kiirtan")).toBe("kiirtan")
    expect(parseSearchScope(["kiirtans"])).toBe("kiirtan")
    expect(parseSearchScope("zzz")).toBe("all")
    expect(scopeShows("all")).toEqual({ songs: true, kiirtans: true, stories: false })
    expect(scopeShows("songs")).toEqual({ songs: true, kiirtans: false, stories: false })
    expect(scopeShows("kiirtan")).toEqual({ songs: false, kiirtans: true, stories: false })
    expect(scopeShows("stories")).toEqual({ songs: false, kiirtans: false, stories: true })
  })

  it("finds Kiirtans by every word, in title, performer or type", () => {
    expect(searchKirtans(approved, "")).toEqual([])
    expect(searchKirtans(approved, "priya").every((x) => /priya/i.test(`${x.author} ${x.addedBy}`))).toBe(true)
    expect(searchKirtans(approved, "priya").length).toBeGreaterThan(0)
    expect(searchKirtans(approved, "  LILA  ").every((x) => x.type === "lila" || /lila/i.test(x.title + x.author))).toBe(true)
    expect(searchKirtans(approved, "priya morning").map((x) => x.id)).toContain("k-bnk-morning")
    expect(searchKirtans(approved, "priya dipavali")).toEqual([])
    expect(searchKirtans(approved, "kiirtan")).toHaveLength(approved.length)
    expect(searchKirtans(approved, "kiirtan", 3)).toHaveLength(3)
    expect(searchKirtans(approved, "zzzz")).toEqual([])
  })

  it("adds a Kiirtan chip to the library with saved and uploaded rows", () => {
    const items = buildLibraryItems({ playlists: [], savedCount: 0, downloadCount: 0, wordsDue: 0, savedKiirtanCount: 2, uploadCount: 1 })
    expect(filterLibrary(items, "kiirtan").map((i) => i.title)).toEqual(["Saved Kiirtans", "My uploads"])
    expect(buildLibraryItems({ playlists: [], savedCount: 0, downloadCount: 0, wordsDue: 0 })).toEqual([])
  })
})
