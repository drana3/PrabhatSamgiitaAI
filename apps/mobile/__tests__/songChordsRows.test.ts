import { describe, expect, it } from "vitest"

import { draftFromOther, draftFromProposal, draftProblems, fitLines, newDraft, setChord, type Draft } from "@/lib/songChords/draft"
import { putDraft, type DraftBook } from "@/lib/songChords/drafts"
import { parseEntry } from "@/lib/songChords/entry"
import { FIELD_ORDER, fieldOf, firstInvalid, problemsByField } from "@/lib/songChords/fields"
import { actionHref, buildRows, menuActions, primaryAction, type RowAction } from "@/lib/songChords/rows"
import type { ChordProposal } from "@/lib/songChords/types"

const chart = (over: Partial<ChordProposal> = {}): ChordProposal => ({
  id: "a",
  songId: 7,
  instrument: "guitar",
  baseKey: "D",
  capo: 2,
  strum: null,
  lines: [{ placements: [{ word: 0, chord: "D" }, { word: 2, chord: "Bm" }] }],
  note: "slow",
  playedIt: true,
  createdAt: "2026-11-03T00:00:00Z",
  isAnonymous: false,
  author: { name: "Me" },
  mine: true,
  status: "published",
  rejectedReason: null,
  canReview: false,
  ...over,
})

const withChord = (song: number, over: Partial<Draft> = {}): Draft => setChord(fitLines({ ...newDraft(song), ...over }, 1), 0, 0, "G")

describe("the rows of Your chord charts", () => {
  it("lists what needs the member first: not accepted, drafts, waiting, live", () => {
    const mine = [
      chart({ id: "live", status: "published", createdAt: "2026-11-05T00:00:00Z" }),
      chart({ id: "wait", status: "pending", songId: 2, createdAt: "2026-11-04T00:00:00Z" }),
      chart({ id: "no", status: "rejected", songId: 5, createdAt: "2026-11-01T00:00:00Z", rejectedReason: "Check the key." }),
    ]
    const book: DraftBook = putDraft({}, withChord(9), 5)
    expect(buildRows(mine, book).map((r) => `${r.kind}:${r.key}`)).toEqual(["rejected:no", "draft:song:9:guitar", "pending:wait", "published:live"])
  })
  it("a draft of a chart rides on that chart's row instead of being a second row", () => {
    const mine = [chart({ id: "wait", status: "pending" }), chart({ id: "live", status: "published", songId: 8 })]
    let book: DraftBook = putDraft({}, withChord(7, { editId: "wait" }), 5)
    book = putDraft(book, withChord(8, { basedOn: "live" }), 6)
    const rows = buildRows(mine, book)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.key === "wait")?.draft?.key).toBe("edit:wait")
    expect(rows.find((r) => r.key === "live")?.draft?.key).toBe("copy:live")
  })
  it("a draft whose chart is not in the list stays visible as a draft of its own", () => {
    const book = putDraft({}, withChord(7, { editId: "gone" }), 5)
    const rows = buildRows([], book)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: "draft", key: "edit:gone", songId: 7 })
  })
  it("newest first inside a group, and the same input always gives the same order", () => {
    const mine = [chart({ id: "b", createdAt: "2026-11-01T00:00:00Z" }), chart({ id: "a", createdAt: "2026-11-02T00:00:00Z" }), chart({ id: "c", createdAt: "2026-11-02T00:00:00Z" })]
    expect(buildRows(mine, {}).map((r) => r.key)).toEqual(["a", "c", "b"])
    expect(buildRows([], {})).toEqual([])
  })
})

describe("what each row can do", () => {
  const row = (kind: "draft" | "pending" | "published" | "rejected", withChanges = false) => ({
    kind,
    draft: withChanges ? ({ key: "edit:a", draft: newDraft(7), updatedAt: 1, chords: 1 } as const) : null,
  })
  it("a tap does the one thing the state is for", () => {
    expect(primaryAction({ kind: "draft" })).toBe("continue")
    expect(primaryAction({ kind: "pending" })).toBe("edit")
    expect(primaryAction({ kind: "published" })).toBe("viewSong")
    expect(primaryAction({ kind: "rejected" })).toBe("why")
  })
  it("each state has its own menu, the destructive item last, and the tap is always in the menu", () => {
    expect(menuActions(row("draft"))).toEqual(["continue", "discardDraft"])
    expect(menuActions(row("pending"))).toEqual(["edit", "viewSong", "withdraw"])
    expect(menuActions(row("published"))).toEqual(["viewSong", "newVersion", "delete"])
    expect(menuActions(row("rejected"))).toEqual(["fix", "why", "delete"])
    for (const kind of ["draft", "pending", "published", "rejected"] as const) {
      expect(menuActions(row(kind))).toContain(primaryAction({ kind }))
    }
  })
  it("a row with unsent changes can throw them away, just before the destructive item", () => {
    expect(menuActions(row("pending", true))).toEqual(["edit", "viewSong", "discardChanges", "withdraw"])
    expect(menuActions(row("published", true))).toEqual(["viewSong", "newVersion", "discardChanges", "delete"])
    expect(menuActions(row("rejected", true))).toEqual(["fix", "why", "discardChanges", "delete"])
    expect(menuActions(row("draft", true))).toEqual(["continue", "discardDraft"])
  })
  it("only the actions that go to a screen have an address", () => {
    const p = chart({ id: "x y", status: "published" })
    const r = { songId: 7, proposal: p, draft: null }
    expect(actionHref("viewSong", r)).toBe("/song-v2/ps-7")
    expect(actionHref("newVersion", r)).toBe("/upload-chords?copy=x%20y")
    expect(actionHref("edit", r)).toBe("/upload-chords?edit=x%20y")
    expect(actionHref("fix", r)).toBe("/upload-chords?edit=x%20y")
    const stay: RowAction[] = ["why", "withdraw", "delete", "discardDraft", "discardChanges"]
    for (const action of stay) expect(actionHref(action, r)).toBeNull()
    expect(actionHref("continue", { songId: 7, proposal: null, draft: { key: "song:7:guitar", draft: newDraft(7), updatedAt: 1, chords: 1 } })).toBe("/upload-chords?draft=song%3A7%3Aguitar")
    expect(actionHref("continue", { songId: 7, proposal: null, draft: null })).toBeNull()
    expect(actionHref("viewSong", { songId: null, proposal: null, draft: null })).toBeNull()
  })
})

describe("the form field Send jumps to", () => {
  it("names a field for every problem", () => {
    const all = ["noSong", "noChords", "badChord", "notPlayed", "noteTooLong", "strumShape"] as const
    for (const p of all) expect(FIELD_ORDER).toContain(fieldOf(p))
  })
  it("jumps to the first field from the top of the screen, not to the first problem the draft listed", () => {
    // the draft lists the strum before the note and the box, but the screen meets the chords first
    expect(firstInvalid(["strumShape", "noChords"])).toEqual({ field: "chords", problem: "noChords" })
    expect(firstInvalid(["notPlayed", "strumShape"])).toEqual({ field: "strum", problem: "strumShape" })
    expect(firstInvalid(["notPlayed", "noSong"])).toEqual({ field: "song", problem: "noSong" })
    expect(firstInvalid(["notPlayed"])).toEqual({ field: "played", problem: "notPlayed" })
    expect(firstInvalid([])).toBeNull()
  })
  it("groups the problems under their field", () => {
    expect(problemsByField(["noChords", "badChord", "notPlayed"])).toEqual({ chords: ["noChords", "badChord"], played: ["notPlayed"] })
  })
  it("a brand new draft has the song first, then the chords, then the box", () => {
    expect(draftProblems(newDraft(null), [])).toEqual(["noSong", "noChords", "notPlayed"])
    expect(firstInvalid(draftProblems(newDraft(7), [3]))).toEqual({ field: "chords", problem: "noChords" })
    expect(firstInvalid(draftProblems(withChord(7), [3]))).toEqual({ field: "played", problem: "notPlayed" })
  })
})

describe("starting from someone else's chart", () => {
  it("reads the door", () => {
    expect(parseEntry({ from: "abc", song: "7" })).toEqual({ kind: "from", id: "abc", song: 7 })
    expect(parseEntry({ from: "abc" })).toEqual({ kind: "from", id: "abc", song: null })
    expect(parseEntry({ from: "abc", song: "x" })).toEqual({ kind: "from", id: "abc", song: null })
    expect(parseEntry({ from: "  " })).toEqual({ kind: "new", song: null, instrument: null })
    expect(parseEntry({ from: "abc", edit: "e" })).toEqual({ kind: "edit", id: "e" })
    expect(parseEntry({ from: "abc", draft: "k" })).toEqual({ kind: "draft", key: "k" })
  })
  it("brings the chords over as the shapes, and nothing that belongs to the other author", () => {
    const other = chart({ id: "o", mine: false, isAnonymous: true, author: null, note: "Their note", playedIt: true, strum: "D U" })
    const mine = draftFromOther(other)
    const sameChart = draftFromProposal(other, "copy")
    expect(mine.lines).toEqual(sameChart.lines)
    expect(mine.key).toBe("C")
    expect(mine.capo).toBe(2)
    expect(mine.strum).toBe("D U")
    expect(mine).toMatchObject({ playedIt: false, note: "", isAnonymous: false, editId: null, basedOn: null, songId: 7, instrument: "guitar" })
    expect(draftProblems(mine, [3])).toEqual(["notPlayed"])
  })
})
