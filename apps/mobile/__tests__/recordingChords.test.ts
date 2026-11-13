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
  provesAChart,
} from "@/lib/recordingChords/rules"
import { MAX_SHIFT, chartSpelling, clampShift, lineKind, piecesOf, shiftedKey, transposeLine, transposeSheet } from "@/lib/recordingChords/transpose"
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
  it("one lonely plain letter is not a chart, but real minimal charts pass (QA-053)", () => {
    for (const raw of ["A", "A\nBaba Nam Kevalam", "Bb\nWords", "A\nA", "C#\nx"]) expect(cleanSheet(raw), raw).toEqual({ problem: "fewChords" })
    for (const raw of ["Am", "Am\nBaba", "A  G\nBaba Nam", "G7", "D/F#\nBaba", "Baba [A]Nam [G]Kevalam", "Cmaj7\nBaba"]) {
      expect("problem" in cleanSheet(raw), raw).toBe(false)
    }
    expect(provesAChart(["A"])).toBe(false)
    expect(provesAChart(["A", "A"])).toBe(false)
    expect(provesAChart(["A", "G"])).toBe(true)
    expect(provesAChart(["Am"])).toBe(true)
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
  it("the note takes no web links, like the chart (QA-052)", () => {
    expect(draftProblem(draft({ note: "chords at https://example.com/x" }))).toBe("links")
    expect(draftProblem(draft({ note: "see www.example.com" }))).toBe("links")
    expect(draftProblem(draft({ note: "example.com has it" }))).toBe("links")
    expect(draftProblem(draft({ note: "capo on 2, slow strum" }))).toBeNull()
  })
  it("a lonely letter is named for what it is", () => {
    expect(draftProblem(draft({ body: "A" }))).toBe("fewChords")
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
  it("keeps a flat chart flat and a slash bass moving with it", () => {
    expect(transposeSheet("Bb  G/B", 2)).toBe("C   A/Db")
    expect(transposeSheet("Ab Eb", 1)).toBe("A  E")
    expect(transposeLine("Bb  G/B", 2, "flat")).toBe("C   A/Db")
  })
  it("writes a moved chart in ONE spelling, never C# beside Bb (QA-012)", () => {
    const chart = "Em  C  Am  G  D  Em"
    // Em +1 lands in Fm, a flat key: every chord takes flats
    const names = (text: string) => text.split(/\s+/).filter(Boolean)
    expect(names(transposeSheet(chart, 1, "Em"))).toEqual(["Fm", "Db", "Bbm", "Ab", "Eb", "Fm"])
    expect(names(transposeSheet(chart, 1))).toEqual(["Fm", "Db", "Bbm", "Ab", "Eb", "Fm"])
    // +2 lands in F#m, not a flat key: every chord takes sharps
    expect(names(transposeSheet(chart, 2, "Em"))).toEqual(["F#m", "D", "Bm", "A", "E", "F#m"])
    for (let n = -11; n <= 11; n++) {
      const moved = names(transposeSheet(chart, n, "Em"))
      const flats = moved.some((c) => /^[A-G]b/.test(c))
      const sharps = moved.some((c) => /^[A-G]#/.test(c))
      expect(flats && sharps).toBe(false)
    }
    const slash = "G  D/F#  Em"
    for (let n = 1; n <= 11; n++) {
      const moved = transposeSheet(slash, n, "G").split(/[\s/]+/).filter(Boolean)
      expect(moved.some((c) => /^[A-G]b/.test(c)) && moved.some((c) => /^[A-G]#/.test(c))).toBe(false)
    }
    // marks inside words follow the same rule
    expect(transposeSheet("Ba[Em]ba [C]Nam", 1)).toBe("Ba[Fm]ba [Db]Nam")
  })
  it("picks flats for a flat source or a flat landing key, sharps otherwise, and leaves zero alone", () => {
    expect(chartSpelling("Em  C", null, 1)).toBe("flat")
    expect(chartSpelling("Em  C", null, 2)).toBe("sharp")
    expect(chartSpelling("C  F", null, 5)).toBe("flat") // lands in F
    expect(chartSpelling("C  G", null, 6)).toBe("flat") // lands in Gb
    expect(chartSpelling("C  G", null, 7)).toBe("sharp") // lands in G
    expect(chartSpelling("Bb  F", null, 2)).toBe("flat") // written with a flat
    expect(chartSpelling("C  G", "Eb", 2)).toBe("flat") // the key says flat
    expect(chartSpelling("not chords", null, 3)).toBe("sharp")
    expect(transposeSheet("Bb  F#  Em", 0)).toBe("Bb  F#  Em")
  })
  it("up and down by the same amount comes back", () => {
    for (const n of [1, 3, 5, 7, 11]) expect(transposeSheet(transposeSheet(CHART, n), -n)).toBe(CHART)
  })
  it("moves the key label and the steps stay within an octave", () => {
    expect(shiftedKey("Em", 2)).toBe("F#m")
    expect(shiftedKey("Em", 1, "Em  C")).toBe("Fm")
    expect(shiftedKey("Em", 0)).toBe("Em")
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
    [e(422, null, "A single plain letter is not a chord chart. Add a second chord, or write the chord in full, for example Am or G7."), "fewChords"],
    [e(422, null, "Please leave web links out of the note."), "links"],
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
