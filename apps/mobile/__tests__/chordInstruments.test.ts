import { beforeEach, describe, expect, it, vi } from "vitest"

const offer = vi.fn()
const offerChart = vi.fn()
vi.mock("@/lib/recordingChords/backend", () => ({
  sheetsBackend: () => ({ offer, offerChart }),
  sheetFailure: () => "server",
}))

import { newChartDraft, retext, toChartPayload, type ChartDraft } from "@/lib/recordingChords/chart"
import { CHORD_INSTRUMENT_CHOICES, cardChords, chartChords, instrumentHasCapo, isSheetInstrument, sheetInstrumentOf } from "@/lib/recordingChords/instruments"
import { kindHasCharts } from "@/lib/recordingChords/kinds"
import { recordingExtraRows } from "@/lib/recordingExtras/playerRows"
import { chartDraftHref } from "@/lib/recordingExtras/links"
import { kindHasChords } from "@/lib/kirtan/kind"
import { setInstrument } from "@/lib/songChords/draft"
import { isBlankChart, useRecordingChordsPendingStore } from "@/stores/recordingChordsPendingStore"

const store = () => useRecordingChordsPendingStore.getState()

function chartWith(instrument: "harmonium" | "piano" | "guitar"): ChartDraft {
  const base = { ...newChartDraft(), ...setInstrument(newChartDraft(), instrument) }
  const withText = retext(base, ["Baba Nam Kevalam", "Prema Mayi"])
  return { ...withText, key: instrument === "guitar" ? "C" : "Sa", playedIt: true, lines: [[{ word: 0, chord: "Am" }, { word: 2, chord: "G" }], [{ word: 0, chord: "Am" }]] }
}

beforeEach(() => {
  offer.mockReset()
  offerChart.mockReset()
  useRecordingChordsPendingStore.setState({ drafts: {}, chartDrafts: {}, results: {} })
})

describe("the three instruments", () => {
  it("are Harmonium, Piano, Guitar in that order, for every kind that has chords", () => {
    expect([...CHORD_INSTRUMENT_CHOICES]).toEqual(["harmonium", "piano", "guitar"])
  })

  it("accept piano as a stored instrument, and fall back to guitar for anything else", () => {
    expect(isSheetInstrument("piano")).toBe(true)
    expect(isSheetInstrument("sitar")).toBe(false)
    expect(sheetInstrumentOf("piano")).toBe("piano")
    expect(sheetInstrumentOf("sitar")).toBe("guitar")
    expect(sheetInstrumentOf(undefined, "harmonium")).toBe("harmonium")
  })

  it("only a guitar has a capo", () => {
    expect(instrumentHasCapo("guitar")).toBe(true)
    expect(instrumentHasCapo("piano")).toBe(false)
    expect(instrumentHasCapo("harmonium")).toBe(false)
  })

  it("switching a draft to piano clears capo and strum, as for a harmonium", () => {
    const guitar = { ...newChartDraft(), capo: 3, strum: "D DU" }
    const piano = setInstrument(guitar, "piano")
    expect(piano.instrument).toBe("piano")
    expect(piano.capo).toBe(0)
    expect(piano.strum).toBe("")
  })
})

describe("chords handed to the chord card", () => {
  const lines = [{ placements: [{ chord: "Am" }, { chord: "G" }] }, { placements: [{ chord: "Am" }, { chord: "C" }] }]
  it("lists every different chord once, in order", () => {
    expect(chartChords(lines)).toEqual(["Am", "G", "C"])
  })
  it("a piano or harmonium chart shows the chords as they sound", () => {
    expect(cardChords({ instrument: "piano", capo: 0, lines })).toEqual(["Am", "G", "C"])
    expect(cardChords({ instrument: "harmonium", lines })).toEqual(["Am", "G", "C"])
  })
  it("a guitar chart shows the shapes of its capo", () => {
    const shapes = cardChords({ instrument: "guitar", capo: 2, lines })
    expect(shapes).toHaveLength(3)
    expect(shapes).not.toEqual(["Am", "G", "C"])
  })
  it("an empty chart has no chords", () => {
    expect(cardChords({ instrument: "piano", lines: null })).toEqual([])
  })
})

describe("which kinds take chords", () => {
  it("Bhajan and Spiritual song take a chart, Kiirtan does not", () => {
    expect(kindHasCharts("bhajan")).toBe(true)
    expect(kindHasCharts("spiritual_song")).toBe(true)
    expect(kindHasCharts("kiirtan")).toBe(false)
  })
  it("Dance music and the audio discourses take no chords and get no Chords row in the player", () => {
    expect(kindHasChords("dance_song")).toBe(false)
    expect(kindHasChords("baba_audio")).toBe(false)
    expect(kindHasChords("bhajan")).toBe(true)
    expect(recordingExtraRows(false).map((r) => r.id)).toEqual(["recordingPage"])
    expect(recordingExtraRows().map((r) => r.id)).toEqual(["recordingChords", "recordingPage"])
  })
})

describe("a bhajan written at upload time: words first, then a chord over each word", () => {
  it("keeps a chart per row; nothing typed removes it", () => {
    store().setChartDraft("a", chartWith("piano"))
    expect(Object.keys(store().chartDrafts)).toEqual(["a"])
    store().setChartDraft("a", newChartDraft())
    expect(store().chartDrafts).toEqual({})
    expect(isBlankChart(newChartDraft())).toBe(true)
  })

  it("sends the chart with its instrument once the row is published", async () => {
    offerChart.mockResolvedValue({ id: "s1" })
    const chart = chartWith("piano")
    store().setChartDraft("a", chart)
    await store().flush("a", "rec-1", "Bhajan")
    expect(offerChart).toHaveBeenCalledTimes(1)
    const [id, payload] = offerChart.mock.calls[0]
    expect(id).toBe("rec-1")
    expect(payload).toEqual(toChartPayload(chart))
    expect(payload.instrument).toBe("piano")
    expect(payload.capo).toBe(0)
    expect(store().chartDrafts).toEqual({})
    expect(store().results.a?.status).toBe("sent")
    expect(offer).not.toHaveBeenCalled()
  })

  it("an unfinished chart (no chords) is not sent and the row says so", async () => {
    store().setChartDraft("a", { ...chartWith("guitar"), lines: [[], []] })
    await store().flush("a", "rec-1", "Bhajan")
    expect(offerChart).not.toHaveBeenCalled()
    expect(store().results.a?.status).toBe("failed")
    expect(store().chartDrafts.a).toBeDefined()
  })

  it("a failed send keeps the chart and a retry sends it again", async () => {
    offerChart.mockRejectedValueOnce(new Error("net")).mockResolvedValueOnce({ id: "s1" })
    store().setChartDraft("a", chartWith("harmonium"))
    await store().flush("a", "rec-1", "Bhajan")
    expect(store().results.a?.status).toBe("failed")
    expect(store().chartDrafts.a).toBeDefined()
    await store().retry("a")
    expect(store().results.a?.status).toBe("sent")
    expect(offerChart).toHaveBeenCalledTimes(2)
  })

  it("forgetting a row drops its chart", () => {
    store().setChartDraft("a", chartWith("guitar"))
    store().forget("a")
    expect(store().chartDrafts).toEqual({})
  })

  it("the upload row opens the editor with its row, kind and title", () => {
    expect(chartDraftHref({ row: "q 1", kind: "bhajan", title: "Hey Prabhu" })).toBe("/recording-chart?row=q%201&kind=bhajan&title=Hey%20Prabhu")
  })
})
