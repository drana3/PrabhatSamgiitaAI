import { describe, expect, it } from "vitest"

import { chartDraftFromOther, chartDraftFromSheet, chartProblems, chartWordCounts, chordsLostBy, isChart, newChartDraft, pasteToLines, retext, toChartPayload, type ChartDraft } from "@/lib/recordingChords/chart"
import { chartToWire } from "@/lib/recordingChords/rules"
import type { RecordingSheet } from "@/lib/recordingChords/types"
import { setCapo, setChord } from "@/lib/songChords/draft"

const TEXT = "  Baba   Nam Kevalam \n\nPrema\tSindhu\n\n\n\nAnanda Murti  \n\n"

function ready(): ChartDraft {
  const pasted = pasteToLines(TEXT)
  if (!("lines" in pasted)) throw new Error("paste failed")
  let d = retext(newChartDraft(), pasted.lines)
  d = { ...d, key: "C", playedIt: true }
  d = setChord(d, 0, 0, "Am") as ChartDraft
  return d
}

describe("pasteToLines", () => {
  it("collapses spaces, keeps one blank line between verses and drops blank lines at the ends", () => {
    expect(pasteToLines(TEXT)).toEqual({ lines: ["Baba Nam Kevalam", "", "Prema Sindhu", "", "Ananda Murti"] })
  })
  it("removes invisible and control characters", () => {
    expect(pasteToLines("Baba​ Nam\u0007 Kevalam")).toEqual({ lines: ["Baba Nam Kevalam"] })
  })
  it("refuses empty text, a long line and web links", () => {
    expect(pasteToLines("  \n \n")).toEqual({ problem: "empty" })
    expect(pasteToLines("x".repeat(121))).toEqual({ problem: "lineTooLong" })
    expect(pasteToLines("see https://example.org now")).toEqual({ problem: "links" })
  })
  it("counts words the way the chord slots do", () => {
    expect(chartWordCounts(["Baba Nam Kevalam", "", "Prema"])).toEqual([3, 0, 1])
  })
})

describe("retext", () => {
  it("keeps the chords of lines that did not change and clears the rest", () => {
    let d = retext(newChartDraft(), ["Baba Nam", "Prema Sindhu"])
    d = setChord(d, 0, 0, "Am") as ChartDraft
    d = setChord(d, 1, 1, "G") as ChartDraft
    const next = retext(d, ["Baba Nam", "Prema Sindu", "New line"])
    expect(next.lines).toEqual([[{ word: 0, chord: "Am" }], [], []])
    expect(chordsLostBy(d, ["Baba Nam", "Prema Sindu", "New line"])).toBe(1)
  })
})

describe("chartProblems", () => {
  it("asks for text first, then chords, then the confirmation, and never for a song", () => {
    expect(chartProblems(newChartDraft())).toEqual(["noText", "noChords", "notPlayed"])
    const d = retext(newChartDraft(), ["Baba Nam"])
    expect(chartProblems(d)).toEqual(["noChords", "notPlayed"])
    expect(chartProblems(ready())).toEqual([])
  })
  it("refuses a chord that is not a chord name", () => {
    const d = setChord(ready(), 0, 1, "Hello") as ChartDraft
    expect(chartProblems(d)).toContain("badChord")
  })
})

describe("toChartPayload", () => {
  it("sends the text of every line beside its sounding chords, the capo as a hint", () => {
    let d = ready()
    d = setCapo(d, 2) as ChartDraft
    const payload = toChartPayload(d)
    expect(payload.baseKey).toBe("D")
    expect(payload.capo).toBe(2)
    expect(payload.lines.map((l) => l.text)).toEqual(["Baba Nam Kevalam", "", "Prema Sindhu", "", "Ananda Murti"])
    expect(payload.lines[0].placements).toEqual([{ word: 0, chord: "Bm" }])
    expect(payload.lines[4].placements).toEqual([])
  })
  it("drops chords on words that are not there and carries the version and the credit", () => {
    let d = ready()
    d = { ...d, lines: [[{ word: 0, chord: "Am" }, { word: 9, chord: "G" }], ...d.lines.slice(1)] }
    expect(toChartPayload(d).lines[0].placements).toEqual([{ word: 0, chord: "Am" }])
    expect(toChartPayload({ ...d, basedOn: "old-1" }).replacesId).toBe("old-1")
    expect(toChartPayload({ ...d, startedFrom: "theirs-1" }).basedOnId).toBe("theirs-1")
    expect(toChartPayload({ ...d, startedFrom: "theirs-1", basedOn: "old-1" }).basedOnId).toBeUndefined()
  })
  it("has no capo and no strum for a harmonium", () => {
    const d = { ...ready(), instrument: "harmonium" as const, key: "E", capo: 0, strum: "" }
    const payload = toChartPayload(d)
    expect(payload).toMatchObject({ instrument: "harmonium", baseKey: "E", capo: 0, strum: null })
    expect(chartToWire(payload)).toMatchObject({ instrument: "harmonium", chart_key: "E", capo: 0, strum: null })
  })
})

const sheet = (extra: Partial<RecordingSheet> = {}): RecordingSheet => ({
  id: "s1",
  recordingId: "r1",
  instrument: "guitar",
  chartKey: "D",
  body: "",
  lines: [
    { text: "Baba Nam Kevalam", placements: [{ word: 0, chord: "Bm" }] },
    { text: "Prema Sindhu", placements: [] },
  ],
  capo: 2,
  strum: "D DU",
  chordsCount: 1,
  note: "hi",
  playedIt: true,
  createdAt: "2026-01-01T00:00:00Z",
  isAnonymous: false,
  author: { name: "Ananda" },
  mine: true,
  status: "pending",
  rejectedReason: null,
  canReview: false,
  recordingTitle: null,
  ...extra,
})

describe("a chart that exists becomes a draft again", () => {
  it("edit: the shapes come back down by the capo and the chart is updated in place", () => {
    const d = chartDraftFromSheet(sheet(), "edit")
    expect(d).toMatchObject({ key: "C", capo: 2, strum: "D DU", editId: "s1", basedOn: null, note: "hi" })
    expect(d.lines[0]).toEqual([{ word: 0, chord: "Am" }])
    expect(d.text).toEqual(["Baba Nam Kevalam", "Prema Sindhu"])
    expect(toChartPayload(d).lines[0].placements).toEqual([{ word: 0, chord: "Bm" }])
  })
  it("copy: a changed copy of a live chart replaces it", () => {
    const d = chartDraftFromSheet(sheet({ status: "published" }), "copy")
    expect(d).toMatchObject({ editId: null, basedOn: "s1" })
    expect(toChartPayload(d).replacesId).toBe("s1")
  })
  it("start from this chart: text and chords come over, capo, strum, note and the checkbox do not", () => {
    const d = chartDraftFromOther(sheet({ mine: false, status: "published" }))
    expect(d).toMatchObject({ capo: 0, strum: "", note: "", playedIt: false, editId: null, basedOn: null, startedFrom: "s1", key: "D" })
    expect(d.text).toHaveLength(2)
    expect(toChartPayload({ ...d, playedIt: true }).basedOnId).toBe("s1")
  })
})

describe("isChart", () => {
  it("is true only for a sheet with lines", () => {
    expect(isChart(sheet())).toBe(true)
    expect(isChart(sheet({ lines: null }))).toBe(false)
    expect(isChart({})).toBe(false)
  })
})
