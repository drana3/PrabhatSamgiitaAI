import { describe, expect, it } from "vitest"

import { NetworkError, RemoteError } from "@/lib/kirtan/remote"
import { countByStatus, editHref, editMode, filterCharts, offerAnotherHref, shortDate, showFilters, sortForMember } from "@/lib/songChords/charts"
import { QUALITIES, QUALITY_KIND, buildChord } from "@/lib/songChords/chordName"
import { fitLines, newDraft, setChord, type Draft } from "@/lib/songChords/draft"
import {
  MAX_DRAFTS,
  ageOf,
  draftKey,
  entryChoices,
  listDrafts,
  migrateDrafts,
  putDraft,
  removeDraft,
  worthKeeping,
  type DraftBook,
} from "@/lib/songChords/drafts"
import { draftSignature, parseEntry } from "@/lib/songChords/entry"
import { createMockBackend, MockFailure } from "@/lib/songChords/mock"
import { chordNotices, EMPTY_SEEN, type ChordNoticeKey } from "@/lib/songChords/notices"
import { failureFromError, remoteBackend } from "@/lib/songChords/remote"
import { revealOffset } from "@/lib/songChords/reveal"
import type { ChordProposal, ProposalPayload } from "@/lib/songChords/types"

const withChord = (song: number, over: Partial<Draft> = {}): Draft => setChord(fitLines({ ...newDraft(song), ...over }, 1), 0, 0, "G")

describe("the draft book", () => {
  it("keeps one draft per song and instrument, a fix and a copy on their own", () => {
    expect(draftKey(newDraft(7))).toBe("song:7:guitar")
    expect(draftKey({ ...newDraft(7), instrument: "harmonium" })).toBe("song:7:harmonium")
    expect(draftKey({ ...newDraft(7), editId: "x" })).toBe("edit:x")
    expect(draftKey({ ...newDraft(7), basedOn: "y" })).toBe("copy:y")
  })
  it("a draft without a chord or a note is not kept, and clears an older one under its key", () => {
    expect(worthKeeping(newDraft(7))).toBe(false)
    expect(worthKeeping({ ...newDraft(7), note: "  " })).toBe(false)
    expect(worthKeeping({ ...newDraft(7), note: "slow" })).toBe(true)
    let book: DraftBook = putDraft({}, withChord(7), 1)
    expect(Object.keys(book)).toEqual(["song:7:guitar"])
    book = putDraft(book, fitLines(newDraft(7), 1), 2)
    expect(book).toEqual({})
  })
  it("never holds more than MAX_DRAFTS: the least recently touched one makes room", () => {
    let book: DraftBook = {}
    for (let song = 1; song <= MAX_DRAFTS + 2; song += 1) book = putDraft(book, withChord(song), song)
    expect(Object.keys(book)).toHaveLength(MAX_DRAFTS)
    expect(book["song:1:guitar"]).toBeUndefined()
    expect(book["song:2:guitar"]).toBeUndefined()
    expect(book[`song:${MAX_DRAFTS + 2}:guitar`]).toBeDefined()
  })
  it("touching an old draft keeps it and drops another", () => {
    let book: DraftBook = {}
    for (let song = 1; song <= MAX_DRAFTS; song += 1) book = putDraft(book, withChord(song), song)
    book = putDraft(book, withChord(1, { note: "again" }), 100)
    book = putDraft(book, withChord(99), 101)
    expect(book["song:1:guitar"]).toBeDefined()
    expect(book["song:2:guitar"]).toBeUndefined()
  })
  it("removes by key and lists the most recent first", () => {
    let book = putDraft(putDraft({}, withChord(1), 10), withChord(2), 20)
    expect(listDrafts(book).map((e) => e.key)).toEqual(["song:2:guitar", "song:1:guitar"])
    expect(listDrafts(book)[0].chords).toBe(1)
    book = removeDraft(book, "song:2:guitar")
    expect(Object.keys(book)).toEqual(["song:1:guitar"])
    expect(removeDraft(book, "nope")).toBe(book)
  })
  it("offers the right drafts when the screen opens", () => {
    let book: DraftBook = {}
    book = putDraft(book, withChord(7), 1)
    book = putDraft(book, withChord(7, { instrument: "harmonium" }), 2)
    book = putDraft(book, withChord(8), 3)
    book = putDraft(book, withChord(9, { editId: "r1" }), 4)
    book = putDraft(book, withChord(9, { basedOn: "p1" }), 5)
    expect(entryChoices(book, { song: 7 }).map((e) => e.key)).toEqual(["song:7:harmonium", "song:7:guitar"])
    expect(entryChoices(book, { edit: "r1" }).map((e) => e.key)).toEqual(["edit:r1"])
    expect(entryChoices(book, { copy: "p1" }).map((e) => e.key)).toEqual(["copy:p1"])
    expect(entryChoices(book, { edit: "other" })).toEqual([])
    expect(entryChoices(book, { song: 123 })).toEqual([])
    expect(entryChoices(book, {})).toHaveLength(5)
  })
  it("moves the single draft of version 1 into the book, and keeps a book as it is", () => {
    const old = withChord(7)
    expect(migrateDrafts({ draft: old }, 50)).toEqual({ "song:7:guitar": { draft: old, updatedAt: 50 } })
    expect(migrateDrafts({ draft: fitLines(newDraft(7), 1) }, 50)).toEqual({})
    expect(migrateDrafts(null, 1)).toEqual({})
    expect(migrateDrafts("junk", 1)).toEqual({})
    const book = { "song:7:guitar": { draft: old, updatedAt: 5 }, broken: { draft: null, updatedAt: "x" } }
    expect(migrateDrafts({ drafts: book }, 99)).toEqual({ "song:7:guitar": { draft: old, updatedAt: 5 } })
  })
  it("tells how old a draft is without words", () => {
    const now = 10 * 24 * 3_600_000
    expect(ageOf(now - 20_000, now)).toBe("now")
    expect(ageOf(now - 5 * 60_000, now)).toEqual({ unit: "minutes", count: 5 })
    expect(ageOf(now - 3 * 3_600_000, now)).toEqual({ unit: "hours", count: 3 })
    expect(ageOf(now - 3 * 24 * 3_600_000, now)).toEqual({ unit: "days", count: 3 })
    expect(ageOf(now + 5000, now)).toBe("now")
  })
})

describe("how the offer screen is opened", () => {
  it("reads each door", () => {
    expect(parseEntry({})).toEqual({ kind: "new", song: null, instrument: null })
    expect(parseEntry({ song: "7" })).toEqual({ kind: "new", song: 7, instrument: null })
    expect(parseEntry({ song: "7", instrument: "harmonium" })).toEqual({ kind: "new", song: 7, instrument: "harmonium" })
    expect(parseEntry({ edit: "abc" })).toEqual({ kind: "edit", id: "abc" })
    expect(parseEntry({ copy: "abc" })).toEqual({ kind: "copy", id: "abc" })
    expect(parseEntry({ draft: "song:7:guitar" })).toEqual({ kind: "draft", key: "song:7:guitar" })
  })
  it("an address with junk in it falls back to a new chart", () => {
    expect(parseEntry({ song: "abc", instrument: "piano" })).toEqual({ kind: "new", song: null, instrument: null })
    expect(parseEntry({ song: "-3" })).toEqual({ kind: "new", song: null, instrument: null })
    expect(parseEntry({ song: "2.5" })).toEqual({ kind: "new", song: null, instrument: null })
    expect(parseEntry({ edit: "  ", song: "4" })).toEqual({ kind: "new", song: 4, instrument: null })
    expect(parseEntry({ song: ["5", "6"] })).toEqual({ kind: "new", song: 5, instrument: null })
  })
  it("edit wins over copy, copy over draft, draft over a song", () => {
    expect(parseEntry({ edit: "a", copy: "b", draft: "c", song: "1" }).kind).toBe("edit")
    expect(parseEntry({ copy: "b", draft: "c", song: "1" }).kind).toBe("copy")
    expect(parseEntry({ draft: "c", song: "1" }).kind).toBe("draft")
  })
  it("two drafts are the same work only when everything the member made is the same", () => {
    const a = withChord(7)
    expect(draftSignature(a)).toBe(draftSignature({ ...a }))
    expect(draftSignature(a)).not.toBe(draftSignature(setChord(a, 0, 1, "C")))
    expect(draftSignature(a)).not.toBe(draftSignature({ ...a, note: "hello" }))
    expect(draftSignature({ ...a, note: " " })).toBe(draftSignature(a))
    expect(draftSignature({ ...a, note: " x " })).toBe(draftSignature({ ...a, note: "x" }))
    expect(draftSignature(a)).not.toBe(draftSignature({ ...a, editId: "z" }))
  })
})

describe("keeping the word in sight above the sheet", () => {
  const base = { viewTop: 100, viewBottom: 800, covered: 300, offset: 0 }
  it("does nothing when the word is already comfortably above the sheet", () => {
    expect(revealOffset({ ...base, itemTop: 300, itemBottom: 340 })).toBeNull()
  })
  it("scrolls a word hidden by the sheet into the middle of the free part", () => {
    const next = revealOffset({ ...base, itemTop: 600, itemBottom: 640 })
    expect(next).toBe(620 - 300)
  })
  it("scrolls a word that is above the top edge down to the middle", () => {
    expect(revealOffset({ ...base, offset: 500, itemTop: 90, itemBottom: 130 })).toBe(500 + (110 - 300))
  })
  it("never goes below zero or past the end", () => {
    expect(revealOffset({ ...base, offset: 10, itemTop: 90, itemBottom: 130 })).toBe(0)
    expect(revealOffset({ ...base, itemTop: 600, itemBottom: 640, maxOffset: 100 })).toBe(100)
  })
  it("gives up when the sheet leaves no room", () => {
    expect(revealOffset({ ...base, covered: 900, itemTop: 600, itemBottom: 640 })).toBeNull()
  })
  it("a covered sheet of nothing is a plain visibility check", () => {
    expect(revealOffset({ ...base, covered: 0, itemTop: 600, itemBottom: 640 })).toBeNull()
    expect(revealOffset({ ...base, covered: -20, itemTop: 600, itemBottom: 640 })).toBeNull()
  })
})

const chart = (over: Partial<ChordProposal> = {}): ChordProposal => ({
  id: "p1",
  songId: 19,
  instrument: "guitar",
  baseKey: "D",
  capo: 2,
  strum: null,
  lines: [{ placements: [{ word: 0, chord: "D" }] }],
  note: null,
  playedIt: true,
  createdAt: "2026-11-01T10:00:00Z",
  isAnonymous: false,
  author: { name: "Me" },
  mine: true,
  status: "pending",
  rejectedReason: null,
  canReview: false,
  ...over,
})

describe("your chord charts", () => {
  const items = [
    chart({ id: "a", status: "published", createdAt: "2026-11-05T00:00:00Z" }),
    chart({ id: "b", status: "pending", createdAt: "2026-11-02T00:00:00Z" }),
    chart({ id: "c", status: "rejected", createdAt: "2026-11-01T00:00:00Z", rejectedReason: "Check the key." }),
    chart({ id: "d", status: "pending", createdAt: "2026-11-04T00:00:00Z" }),
  ]
  it("puts what needs the member first: rejected, waiting (newest first), then live", () => {
    expect(sortForMember(items).map((p) => p.id)).toEqual(["c", "d", "b", "a"])
    expect(items.map((p) => p.id)).toEqual(["a", "b", "c", "d"])
  })
  it("filters and counts", () => {
    expect(filterCharts(items, "all")).toHaveLength(4)
    expect(filterCharts(items, "pending").map((p) => p.id)).toEqual(["b", "d"])
    expect(countByStatus(items)).toEqual({ all: 4, pending: 2, published: 1, rejected: 1 })
    expect(countByStatus([])).toEqual({ all: 0, pending: 0, published: 0, rejected: 0 })
  })
  it("shows the filter chips from four charts on", () => {
    expect(showFilters(items.slice(0, 3))).toBe(false)
    expect(showFilters(items)).toBe(true)
  })
  it("a waiting or rejected chart is fixed in place, a live one is copied", () => {
    expect(editMode({ status: "pending" })).toBe("edit")
    expect(editMode({ status: "rejected" })).toBe("edit")
    expect(editMode({ status: "published" })).toBe("copy")
    expect(editHref({ id: "x y", status: "rejected" })).toBe("/upload-chords?edit=x%20y")
    expect(editHref({ id: "z", status: "published" })).toBe("/upload-chords?copy=z")
    expect(offerAnotherHref({ songId: 5, instrument: "harmonium" })).toBe("/upload-chords?song=5&instrument=harmonium")
  })
  it("a date that cannot be read gives an empty text", () => {
    expect(shortDate("nonsense", "en")).toBe("")
    expect(shortDate("2026-11-03T12:00:00Z", "en")).toMatch(/3/)
    expect(shortDate("2026-11-03T12:00:00Z", "not a language!!")).toBe("")
  })
})

describe("notices for the author of a chart", () => {
  const say = (key: ChordNoticeKey, params: Record<string, string | number>) => `${key}|${Object.values(params).join(",")}`
  const names = { guitar: "Guitar", harmonium: "Harmonium" }
  const seenOf = (status: ChordProposal["status"], n = 0) => ({ statuses: { p1: { status, n } } })
  it("the first look only records: a new install does not announce old decisions", () => {
    const out = chordNotices(EMPTY_SEEN, [chart({ status: "published" }), chart({ id: "p2", status: "rejected" })], 1, say, names)
    expect(out.notices).toEqual([])
    expect(out.seen.statuses).toEqual({ p1: { status: "published", n: 0 }, p2: { status: "rejected", n: 0 } })
  })
  it("a new chart seen later is recorded without a notice", () => {
    const out = chordNotices(seenOf("pending"), [chart(), chart({ id: "p2", status: "published" })], 1, say, names)
    expect(out.notices).toEqual([])
  })
  it("pending to published says it is live and opens the song", () => {
    const out = chordNotices(seenOf("pending"), [chart({ status: "published" })], 5, say, names)
    expect(out.notices).toHaveLength(1)
    expect(out.notices[0]).toMatchObject({ id: "chords:p1:published:1", kind: "upload", target: "/song-v2/ps-19", firedAt: 5 })
    expect(out.notices[0].text).toContain("notif.chords.published.text")
    expect(out.seen.statuses?.p1).toEqual({ status: "published", n: 1 })
  })
  it("rejected to published says the team looked again", () => {
    const out = chordNotices(seenOf("rejected", 1), [chart({ status: "published" })], 5, say, names)
    expect(out.notices[0].text).toContain("notif.chords.restored.text")
    expect(out.notices[0].id).toBe("chords:p1:published:2")
  })
  it("rejected carries the reason and opens the fix screen; with no reason it says so", () => {
    const withReason = chordNotices(seenOf("pending"), [chart({ status: "rejected", rejectedReason: "  Check the key.  " })], 5, say, names)
    expect(withReason.notices[0]).toMatchObject({ id: "chords:p1:rejected:1", target: "/upload-chords?edit=p1" })
    expect(withReason.notices[0].text).toContain("Check the key.")
    expect(withReason.notices[0].text).toContain("notif.chords.rejected.text")
    const without = chordNotices(seenOf("published"), [chart({ status: "rejected", rejectedReason: null })], 5, say, names)
    expect(without.notices[0].text).toContain("notif.chords.rejected.noReason")
  })
  it("nothing changed, nothing to say; the same decision twice is not announced twice", () => {
    const first = chordNotices(seenOf("pending"), [chart({ status: "published" })], 5, say, names)
    const again = chordNotices(first.seen, [chart({ status: "published" })], 6, say, names)
    expect(again.notices).toEqual([])
    expect(again.seen).toEqual(first.seen)
  })
  it("a chart that is gone leaves the record", () => {
    expect(chordNotices(seenOf("pending"), [], 1, say, names).seen.statuses).toEqual({})
  })
})

describe("the picker's kinds", () => {
  it("every kind has a plain-English name key and builds a chord", () => {
    for (const quality of QUALITIES) expect(QUALITY_KIND[quality]).toBeTruthy()
    expect(new Set(QUALITIES.map((q) => QUALITY_KIND[q])).size).toBe(QUALITIES.length)
    expect(buildChord("Eb", "m7")).toBe("Ebm7")
    expect(buildChord("G", "")).toBe("G")
  })
})

const PAYLOAD: ProposalPayload = {
  songId: 19,
  instrument: "guitar",
  baseKey: "A",
  capo: 2,
  strum: "D U",
  lines: [{ placements: [{ word: 0, chord: "A" }] }],
  playedIt: true,
  note: null,
  isAnonymous: false,
}

describe("fixing a chart in the preview backend", () => {
  const make = (team = false) => createMockBackend({ me: () => "Me", team: () => team, seedMine: true })
  const code = async (run: Promise<unknown>) => {
    try {
      await run
    } catch (e) {
      if (e instanceof MockFailure) return e.failure
      throw e
    }
    return null
  }
  it("a rejected chart is fixed in place, goes back to waiting and loses its reason", async () => {
    const api = make()
    const fixed = await api.update("preview-mine-rejected", { ...PAYLOAD, songId: 5, baseKey: "G", capo: 0, lines: [{ placements: [{ word: 0, chord: "C" }] }] })
    expect(fixed).toMatchObject({ id: "preview-mine-rejected", status: "pending", rejectedReason: null })
    expect((await api.mine()).filter((p) => p.id === "preview-mine-rejected")).toHaveLength(1)
  })
  it("a live chart cannot be changed in place, a stranger's chart is not the member's", async () => {
    const api = make()
    expect(await code(api.update("preview-mine-live", { ...PAYLOAD, songId: 3, instrument: "harmonium", capo: 0, strum: null }))).toBe("notEditable")
    expect(await code(api.update("preview-sample-1", { ...PAYLOAD, songId: 1 }))).toBe("forbidden")
    expect(await code(api.update("nope", PAYLOAD))).toBe("gone")
  })
  it("the song and the instrument stay", async () => {
    const api = make()
    expect(await code(api.update("preview-mine-rejected", { ...PAYLOAD, songId: 6 }))).toBe("invalid")
    expect(await code(api.update("preview-mine-rejected", { ...PAYLOAD, songId: 5, instrument: "harmonium" }))).toBe("invalid")
  })
  it("the team's fix is live at once", async () => {
    const api = make(true)
    expect((await api.update("preview-mine-pending", { ...PAYLOAD, songId: 2, baseKey: "E" })).status).toBe("published")
  })
  it("deleting removes the chart from the list of the member's charts", async () => {
    const api = make()
    await api.remove("preview-mine-pending")
    expect((await api.mine()).map((p) => p.id)).not.toContain("preview-mine-pending")
  })
  it("starts empty without seeded charts", async () => {
    expect(await createMockBackend({ me: () => "Me", seedMine: false }).mine()).toEqual([])
  })
})

describe("fixing a chart through the real API", () => {
  const fakeFetch = (status: number, body: unknown, headers: Record<string, string> = {}, seen: Array<{ url: string; init: RequestInit }> = []) =>
    (async (url: string, init: RequestInit) => {
      seen.push({ url, init })
      return { ok: status < 400, status, headers: { get: (k: string) => headers[k] ?? null }, json: async () => body } as unknown as Response
    }) as unknown as typeof fetch
  it("sends a PUT to the chart's address with the whole chart", async () => {
    const seen: Array<{ url: string; init: RequestInit }> = []
    const api = remoteBackend({
      baseUrl: "https://api.test",
      headers: () => ({}),
      fetch: fakeFetch(200, { id: "c 1", song_id: 19, instrument: "guitar", base_key: "A", capo: 2, strum: "D U", lines: [], note: null, played_it: true, created_at: "2026-11-01T00:00:00Z", is_anonymous: false, author: { name: "Me" }, mine: true, status: "pending", rejected_reason: null, can_review: false }, {}, seen),
    })
    const out = await api.update("c 1", PAYLOAD)
    expect(out).toMatchObject({ id: "c 1", status: "pending" })
    expect(seen[0].url).toBe("https://api.test/api/v1/song-chords/c%201")
    expect(seen[0].init.method).toBe("PUT")
    expect(JSON.parse(String(seen[0].init.body))).toMatchObject({ song_id: 19, base_key: "A" })
  })
  it("turns the new answers into sentences the screens have", () => {
    expect(failureFromError(new RemoteError(409, "x", { code: "chords_not_editable" }))).toBe("notEditable")
    expect(failureFromError(new RemoteError(404, "Chart not found"))).toBe("gone")
    expect(failureFromError(new NetworkError())).toBe("network")
  })
})
