import { describe, expect, it } from "vitest"

import { NetworkError, RemoteError } from "@/lib/kirtan/remote"
import { createSheetsMock } from "@/lib/recordingChords/mock"
import { sheetFailureFromError, sheetFromWire, sheetsRemote, type WireSheet } from "@/lib/recordingChords/remote"
import {
  OPEN_PER_RECORDING_INSTRUMENT,
  SHEET_MAX_LINES,
  SHEET_MAX_LINE_LENGTH,
  chordLineCount,
  cleanSheet,
  draftProblem,
  draftToWire,
  isBlankDraft,
  lineChords,
  newSheetDraft,
} from "@/lib/recordingChords/rules"
import { MAX_SHIFT, clampShift, lineKind, piecesOf, shiftedKey, transposeLine, transposeSheet } from "@/lib/recordingChords/transpose"
import type { SheetDraft } from "@/lib/recordingChords/types"

import { CFG, fakeFetch, type Seen } from "./recordingExtrasHelpers"

const CHART = ["    Em        C", "Baba Nam Kevalam", "    Am        D7", "Prema Mayi Dhyana"].join("\n")
const draft = (over: Partial<SheetDraft> = {}): SheetDraft => ({ ...newSheetDraft(), body: CHART, key: "Em", playedIt: true, ...over })

describe("which lines are chord lines", () => {
  it("a line of only chords and the usual marks", () => {
    expect(chordLineCount("Em  C  | Am  D7")).toBe(4)
    expect(chordLineCount("G/B  Cmaj7  F#m7b5")).toBe(3)
    expect(chordLineCount("Em - C - G x2")).toBe(3)
    expect(chordLineCount("N.C.  Em")).toBe(1)
  })
  it("a line of words is not one, even when one word looks like a chord", () => {
    expect(chordLineCount("Baba Nam Kevalam")).toBe(0)
    expect(chordLineCount("A new day")).toBe(0)
    expect(chordLineCount("")).toBe(0)
    expect(chordLineCount("Cfoo")).toBe(0)
  })
  it("counts [Am] marks inside words", () => {
    expect(lineChords("Ba[Em]ba Nam [C]Kevalam [xyz]")).toBe(2)
    expect(lineChords("Em C")).toBe(2)
  })
})

describe("cleanSheet", () => {
  it("keeps the columns, trims line ends and the common left margin", () => {
    const out = cleanSheet("\n\n      Em    C   \n      Words here  \n\n\n\n      Am\n")
    expect(out).toEqual({ body: "Em    C\nWords here\n\nAm", chords: 3 })
  })
  it("turns tabs and odd spaces into plain spaces and drops invisible characters", () => {
    const out = cleanSheet("Em  C\t‮Am​")
    expect(out).toEqual({ body: "Em  C    Am", chords: 3 })
  })
  it("refuses a text with no chord and an empty one", () => {
    expect(cleanSheet("just words")).toEqual({ problem: "noChords" })
    expect(cleanSheet("   \n  ")).toEqual({ problem: "noChords" })
  })
  it("refuses a link", () => {
    expect(cleanSheet("Em C\nsee https://evil.example")).toEqual({ problem: "links" })
    expect(cleanSheet("Em C\nsee evil.com")).toEqual({ problem: "links" })
  })
  it("refuses too many lines, a line that is too long, too long a text", () => {
    expect(cleanSheet(Array.from({ length: SHEET_MAX_LINES + 1 }, () => "Em").join("\n"))).toEqual({ problem: "tooLong" })
    expect(cleanSheet(`Em\n${"a".repeat(SHEET_MAX_LINE_LENGTH + 1)}`)).toEqual({ problem: "tooLong" })
    expect(cleanSheet(Array.from({ length: 100 }, () => `Em ${"w".repeat(100)}`).join("\n"))).toEqual({ problem: "tooLong" })
  })
  it("accepts exactly the line limits", () => {
    expect("problem" in cleanSheet(Array.from({ length: SHEET_MAX_LINES }, () => "Em").join("\n"))).toBe(false)
    expect("problem" in cleanSheet(`Em\n${"a".repeat(SHEET_MAX_LINE_LENGTH)}`)).toBe(false)
  })
})

describe("draftProblem", () => {
  it("lets a complete draft go", () => {
    expect(draftProblem(draft())).toBeNull()
    expect(draftProblem(draft({ key: "" }))).toBeNull()
  })
  it("wants the chords, then the confirmation", () => {
    expect(draftProblem(draft({ body: "words only" }))).toBe("noChords")
    expect(draftProblem(draft({ playedIt: false }))).toBe("notPlayed")
  })
  it("checks the key and the note", () => {
    expect(draftProblem(draft({ key: "H" }))).toBe("badKey")
    expect(draftProblem(draft({ key: "F#m" }))).toBeNull()
    expect(draftProblem(draft({ note: "x".repeat(301) }))).toBe("noteTooLong")
  })
  it("a blank draft is blank, and the prompt sends nothing for it", () => {
    expect(isBlankDraft(newSheetDraft())).toBe(true)
    expect(isBlankDraft(draft())).toBe(false)
  })
  it("the request is snake_case with a null for what was left empty", () => {
    expect(draftToWire(draft({ key: " ", note: "", isAnonymous: true, instrument: "harmonium" }))).toEqual({
      instrument: "harmonium",
      chart_key: null,
      body: CHART,
      played_it: true,
      note: null,
      is_anonymous: true,
    })
  })
})

describe("transposing", () => {
  it("tells chord lines from words", () => {
    expect(lineKind("  Em  C")).toBe("chords")
    expect(lineKind("Baba Nam")).toBe("words")
    expect(lineKind("  ")).toBe("blank")
  })
  it("moves a chord line and keeps its columns", () => {
    expect(transposeLine("Em        C", 2)).toBe("F#m       D")
    expect(transposeLine("Em  C", 2)).toBe("F#m D")
  })
  it("leaves words alone, moves [Am] marks, and zero changes nothing", () => {
    expect(transposeLine("Baba Nam Kevalam", 5)).toBe("Baba Nam Kevalam")
    expect(transposeLine("Ba[Em]ba [C]Nam", 2)).toBe("Ba[F#m]ba [D]Nam")
    expect(transposeSheet(CHART, 0)).toBe(CHART)
  })
  it("keeps a flat chord flat and a slash bass moving with it", () => {
    expect(transposeLine("Bb  G/B", 2)).toBe("C   A/C#")
    expect(transposeLine("Ab Eb", 1)).toBe("A  E")
  })
  it("up and down by the same amount comes back", () => {
    for (const n of [1, 3, 5, 7, 11]) expect(transposeSheet(transposeSheet(CHART, n), -n)).toBe(CHART)
  })
  it("moves the key label and the steps stay within an octave", () => {
    expect(shiftedKey("Em", 2)).toBe("F#m")
    expect(shiftedKey(null, 2)).toBeNull()
    expect(clampShift(40)).toBe(MAX_SHIFT)
    expect(clampShift(-40)).toBe(-MAX_SHIFT)
    expect(clampShift(2.9)).toBe(2)
  })
  it("flags the chords for drawing", () => {
    expect(piecesOf("Em  C")).toEqual([
      { text: "Em", chord: true },
      { text: "  ", chord: false },
      { text: "C", chord: true },
    ])
    expect(piecesOf("Ba[Em]ba").map((p) => p.chord)).toEqual([false, true, false])
  })
})

const WIRE: WireSheet = {
  id: "s1",
  recording_id: "r1",
  instrument: "guitar",
  chart_key: "Em",
  body: CHART,
  chords_count: 4,
  note: null,
  played_it: true,
  created_at: "2026-11-01T10:00:00Z",
  is_anonymous: false,
  author: { name: "Ananda" },
  mine: false,
  status: "published",
  rejected_reason: null,
  can_review: false,
}

describe("the wire", () => {
  it("never shows an author for an anonymous sheet, whatever the answer carries", () => {
    expect(sheetFromWire({ ...WIRE, is_anonymous: true, author: { name: "Leak" } }).author).toBeNull()
    expect(sheetFromWire(WIRE).author).toEqual({ name: "Ananda" })
  })
  it("asks for a recording's sheets, optionally of one instrument, and offers to the same address", async () => {
    const seen: Seen[] = []
    const api = sheetsRemote(CFG(fakeFetch({ status: 200, body: { items: [WIRE], total: 1 } }, seen)))
    expect((await api.list("r1"))[0]?.chartKey).toBe("Em")
    await api.list("r1", "harmonium")
    await api.offer("r1", draft())
    await api.update("s1", draft())
    await api.remove("s1")
    await api.report("s1", "wrong_chords")
    await api.mine()
    expect(seen.map((s) => `${s.init.method} ${s.url.replace("https://api.example/api/v1/recording-chords", "")}`)).toEqual([
      "GET /recordings/r1",
      "GET /recordings/r1?instrument=harmonium",
      "POST /recordings/r1",
      "PUT /s1",
      "DELETE /s1",
      "POST /s1/report",
      "GET /mine",
    ])
  })
})

describe("failureFromError", () => {
  const e = (status: number, code: string | null, message = "x") => new RemoteError(status, message, { code })
  it.each([
    [new NetworkError(), "network"],
    [e(429, "chords_daily_limit"), "dailyLimit"],
    [e(429, null), "slowDown"],
    [e(409, "chords_duplicate"), "duplicate"],
    [e(409, "chords_open_limit"), "tooMany"],
    [e(409, "chords_not_editable"), "notEditable"],
    [e(401, null), "signin"],
    [e(403, null), "forbidden"],
    [e(404, null), "gone"],
    [e(422, null, "Add at least one chord, for example Am or G7, over the words."), "noChords"],
    [e(422, null, "Please leave web links out of a chord chart."), "links"],
    [e(422, null, "A chord chart can have 250 lines at most."), "tooLong"],
    [e(422, null, "A line is longer than 120 characters. Please split it."), "tooLong"],
    [e(422, null, "something else"), "invalid"],
    [e(500, null), "server"],
  ])("%#", (error, failure) => {
    expect(sheetFailureFromError(error)).toBe(failure)
  })
})

describe("the preview backend follows the same rules", () => {
  const make = () => createSheetsMock({ me: () => "Me" })
  it("a new sheet waits for the team and is the author's own", async () => {
    const api = make()
    const sheet = await api.offer("r1", draft())
    expect(sheet).toMatchObject({ status: "pending", mine: true, chordsCount: 4, author: { name: "Me" } })
    expect((await api.list("r1")).some((s) => s.id === sheet.id)).toBe(true)
  })
  it("an anonymous sheet has no author", async () => {
    expect((await make().offer("r1", draft({ isAnonymous: true }))).author).toBeNull()
  })
  it("refuses the same chart again, however the spaces fall, and a fourth live one", async () => {
    const api = make()
    await api.offer("r1", draft())
    await expect(api.offer("r1", draft({ body: CHART.replace(/ {2,}/g, "   ") }))).rejects.toMatchObject({ failure: "duplicate" })
    await api.offer("r1", draft({ body: "G  D\nOne" }))
    await api.offer("r1", draft({ body: "A  E\nTwo" }))
    expect(OPEN_PER_RECORDING_INSTRUMENT).toBe(3)
    await expect(api.offer("r1", draft({ body: "C  F\nThree" }))).rejects.toMatchObject({ failure: "tooMany" })
    // the other instrument has its own three
    await api.offer("r1", draft({ body: "C  F\nThree", instrument: "harmonium" }))
  })
  it("refuses a draft with no chord", async () => {
    await expect(make().offer("r1", draft({ body: "words only" }))).rejects.toMatchObject({ failure: "noChords" })
  })
  it("the author fixes a waiting sheet, not a live one, and deletes their own", async () => {
    const api = make()
    const sheet = await api.offer("r1", draft())
    const fixed = await api.update(sheet.id, draft({ body: "G  D\nFixed" }))
    expect(fixed.body).toBe("G  D\nFixed")
    const [live] = (await api.list("r1")).filter((s) => s.status === "published")
    await expect(api.update(live?.id as string, draft())).rejects.toMatchObject({ failure: "forbidden" })
    await api.remove(sheet.id)
    expect((await api.mine()).length).toBe(0)
    await expect(api.remove("nope")).rejects.toMatchObject({ failure: "gone" })
  })
})
