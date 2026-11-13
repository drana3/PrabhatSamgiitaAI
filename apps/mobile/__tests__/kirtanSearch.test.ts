import { describe, expect, it } from "vitest"

import { ARTIST_FIXTURES } from "@/lib/fixtures/artists"
import { KIRTAN_FIXTURES } from "@/lib/fixtures/kirtan"
import { artistForAuthor, kirtansOfArtist, splitAuthors } from "@/lib/kirtan/artists"
import { foldText, queryWords, searchArtists, searchKirtans } from "@/lib/kirtan/search"
import type { Kirtan } from "@/lib/kirtan/types"

const approved = KIRTAN_FIXTURES.filter((k) => k.status === "published")
const make = (over: Partial<Kirtan> & { id: string }): Kirtan => ({ ...KIRTAN_FIXTURES[0], addedBy: "x", ...over })
const ids = (list: readonly { id: string }[]) => list.map((x) => x.id)

describe("folding and words", () => {
  it("ignores case, accents and extra spaces", () => {
    expect(foldText("  Śiva   DHYÁNA ")).toBe("siva dhyana")
    expect(queryWords("Kiirtan  PRIYA  devi")).toEqual(["priya", "devi"])
    expect(queryWords("kiirtans")).toEqual([])
  })
})

describe("searchKirtans", () => {
  it("finds an author by a full name, a first name, a surname or a part of a word", () => {
    const priya = ids(kirtansOfArtist({ name: "Priya Devi" }, approved)).sort()
    expect(priya.length).toBeGreaterThan(1)
    for (const q of ["Priya Devi", "priya", "DEVI", "pri", "devi priya"]) {
      expect(ids(searchKirtans(approved, q).filter((k) => k.author === "Priya Devi")).sort()).toEqual(priya)
    }
  })

  it("puts author matches before title matches", () => {
    const list = [
      make({ id: "title", title: "Priya, a song for dawn", author: "Arun Deva", addedBy: "x" }),
      make({ id: "author", title: "Morning round", author: "Priya Devi", addedBy: "x" }),
    ]
    expect(ids(searchKirtans(list, "priya"))).toEqual(["author", "title"])
  })

  it("matches by title and by type name", () => {
    expect(ids(searchKirtans(approved, "dipavali"))).toEqual(["k-dipavali"])
    expect(searchKirtans(approved, "festival").every((k) => k.type === "festival" || /festival/i.test(k.title + k.author))).toBe(true)
    expect(searchKirtans(approved, "baba nam").length).toBeGreaterThan(2)
    expect(searchKirtans(approved, "lila").map((k) => k.type)).toContain("lila")
  })

  it("is case and diacritics insensitive on both sides", () => {
    const list = [make({ id: "a", title: "Śiva in the mountains", author: "Dhyána Group" })]
    expect(ids(searchKirtans(list, "SIVA"))).toEqual(["a"])
    expect(ids(searchKirtans(list, "dhyana"))).toEqual(["a"])
    expect(ids(searchKirtans(list, "Dhyána"))).toEqual(["a"])
  })

  it("needs every word, and one or two letters only at the start of a word", () => {
    expect(searchKirtans(approved, "priya dipavali")).toEqual([])
    const list = [make({ id: "a", title: "Morning round", author: "Priya Devi" })]
    expect(ids(searchKirtans(list, "p"))).toEqual(["a"])
    expect(searchKirtans(list, "y")).toEqual([])
  })

  it("finds each name of a joint author", () => {
    const list = [
      make({ id: "duo", title: "Together", author: "Priya Devi & Arun Deva" }),
      make({ id: "solo", title: "Alone", author: "Arun Deva" }),
    ]
    expect(ids(searchKirtans(list, "priya")).sort()).toEqual(["duo"])
    expect(ids(searchKirtans(list, "arun")).sort()).toEqual(["duo", "solo"])
  })

  it("counts who added it only when no Kiirtan matches otherwise", () => {
    const list = [make({ id: "by", title: "Plain", author: "Group", addedBy: "Meera" })]
    expect(ids(searchKirtans(list, "meera"))).toEqual(["by"])
    const both = [...list, make({ id: "au", title: "Other", author: "Meera Devi", addedBy: "z" })]
    expect(ids(searchKirtans(both, "meera"))).toEqual(["au"])
  })

  it("empty query matches nothing; the word kiirtan alone matches all Kiirtans, with a limit", () => {
    expect(searchKirtans(approved, "   ")).toEqual([])
    expect(searchKirtans(approved, "kiirtan")).toHaveLength(approved.filter((x) => x.kind === "kiirtan").length)
    expect(searchKirtans(approved, "Kiirtans", 3)).toHaveLength(3)
  })
})

describe("searchArtists", () => {
  it("finds the artist row for a name, with how many Kiirtans she has", () => {
    const hits = searchArtists(ARTIST_FIXTURES, approved, "Priya Devi")
    expect(hits.map((a) => a.id)).toEqual(["priya-devi"])
    expect(hits[0].count).toBe(kirtansOfArtist({ name: "Priya Devi" }, approved).length)
    expect(searchArtists(ARTIST_FIXTURES, approved, "PRIY").map((a) => a.id)).toEqual(["priya-devi"])
  })

  it("matches a part of the name, ignoring accents, and ranks the name start first", () => {
    const list = [
      make({ id: "1", author: "Arun Deva" }),
      make({ id: "2", author: "Priya Devi" }),
      make({ id: "3", author: "Priya Devi" }),
    ]
    expect(searchArtists(ARTIST_FIXTURES, list, "dev").map((a) => a.id)).toEqual(["priya-devi", "arun-deva"])
    expect(searchArtists(ARTIST_FIXTURES, list, "déva").map((a) => a.id)).toEqual(["arun-deva"])
  })

  it("lists no artist without a Kiirtan, and none for a bare 'kiirtan'", () => {
    expect(searchArtists(ARTIST_FIXTURES, [], "priya")).toEqual([])
    expect(searchArtists(ARTIST_FIXTURES, approved, "kiirtan")).toEqual([])
    expect(searchArtists(ARTIST_FIXTURES, approved, "")).toEqual([])
  })

  it("counts a joint author for each artist", () => {
    const list = [make({ id: "duo", author: "Priya Devi, Arun Deva" })]
    expect(searchArtists(ARTIST_FIXTURES, list, "arun")[0]?.count).toBe(1)
    expect(searchArtists(ARTIST_FIXTURES, list, "priya")[0]?.count).toBe(1)
  })
})

describe("joint authors", () => {
  it("splits on commas, &, and, with, feat", () => {
    expect(splitAuthors("A & B")).toEqual(["A", "B"])
    expect(splitAuthors("A, B and C")).toEqual(["A", "B", "C"])
    expect(splitAuthors("A feat. B")).toEqual(["A", "B"])
    expect(splitAuthors("Priya Devi")).toEqual(["Priya Devi"])
    expect(splitAuthors("Andrew Anders")).toEqual(["Andrew Anders"])
    expect(splitAuthors("")).toEqual([])
  })

  it("finds the artist of a joint author", () => {
    expect(artistForAuthor(ARTIST_FIXTURES, "Priya Devi & Someone")?.id).toBe("priya-devi")
    expect(artistForAuthor(ARTIST_FIXTURES, "Nobody")).toBeNull()
  })
})
