import { describe, expect, it } from "vitest"

import { chartDraftFromOther, chartDraftFromSheet, newChartDraft, pasteToLines, retext, toChartPayload, type ChartDraft } from "@/lib/recordingChords/chart"
import { kindHasCharts } from "@/lib/recordingChords/kinds"
import { createSheetsMock } from "@/lib/recordingChords/mock"
import { OPEN_PER_RECORDING_INSTRUMENT } from "@/lib/recordingChords/rules"
import { chartFormHref, sheetFormHref } from "@/lib/recordingExtras/links"
import { setChord } from "@/lib/songChords/draft"

/** A finished chart of a Bhajan: three chords over the pasted words, played by the member. */
function chart(extra: Partial<ChartDraft> = {}): ChartDraft {
  const pasted = pasteToLines("Baba Nam Kevalam\nPrema Mayi Dhyana")
  if (!("lines" in pasted)) throw new Error("paste failed")
  let d = { ...retext(newChartDraft(), pasted.lines), key: "C", playedIt: true, ...extra }
  d = setChord(d, 0, 0, "Am") as ChartDraft
  d = setChord(d, 0, 2, "F") as ChartDraft
  d = setChord(d, 1, 0, "G") as ChartDraft
  return d
}

describe("which recordings take a chart over the words", () => {
  it("a Bhajan and a Spiritual song do, a Kiirtan never does", () => {
    expect(kindHasCharts("bhajan")).toBe(true)
    expect(kindHasCharts("spiritual_song")).toBe(true)
    expect(kindHasCharts("kiirtan")).toBe(false)
  })
  it("a Prabhat Samgiita recording, a dance music, a discourse and an unknown kind do not", () => {
    for (const kind of ["prabhat_samgiita", "dance_music", "audio_discourse", "", null, undefined]) expect(kindHasCharts(kind), String(kind)).toBe(false)
  })
})

describe("where adding or changing chords goes", () => {
  it("a chart goes to its own screen, with the id of what is being fixed, copied or started from", () => {
    expect(chartFormHref({ recordingId: "r1" })).toBe("/recording-chart?recording=r1")
    expect(chartFormHref({ recordingId: "r1", title: "Baba & Nam", edit: "s9" })).toBe("/recording-chart?recording=r1&title=Baba%20%26%20Nam&edit=s9")
    expect(chartFormHref({ recordingId: "r1", copy: "s9" })).toBe("/recording-chart?recording=r1&copy=s9")
    expect(chartFormHref({ recordingId: "r1", from: "s9", instrument: "harmonium" })).toBe("/recording-chart?recording=r1&from=s9&instrument=harmonium")
  })
  it("one id at a time: fixing wins over copying, copying over starting from", () => {
    expect(chartFormHref({ recordingId: "r1", edit: "a", copy: "b", from: "c" })).toBe("/recording-chart?recording=r1&edit=a")
    expect(chartFormHref({ recordingId: "r1", copy: "b", from: "c" })).toBe("/recording-chart?recording=r1&copy=b")
  })
  it("a bare instrument only chooses the instrument of a NEW chart", () => {
    expect(chartFormHref({ recordingId: "r1", instrument: "harmonium" })).toBe("/recording-chart?recording=r1&instrument=harmonium")
    expect(chartFormHref({ recordingId: "r1", edit: "a", instrument: "harmonium" })).toBe("/recording-chart?recording=r1&edit=a")
  })
  it("a recording that is not a Bhajan or a Spiritual song keeps the plain-text sheet", () => {
    expect(sheetFormHref({ chart: false, recordingId: "r1", title: "T", edit: "s9" })).toBe("/recording-chords?recording=r1&title=T&edit=s9")
    expect(sheetFormHref({ chart: true, recordingId: "r1", title: "T" })).toBe("/recording-chart?recording=r1&title=T")
  })
})

describe("the preview backend follows the chart rules", () => {
  const make = () => createSheetsMock({ me: () => "Me", chartKind: (id) => id !== "kiirtan-1" })

  it("a new chart waits for the team, is the author's own and keeps its words", async () => {
    const api = make()
    const sheet = await api.offerChart("r1", toChartPayload(chart()))
    expect(sheet).toMatchObject({ status: "pending", mine: true, chordsCount: 3, chartKey: "C", author: { name: "Me" } })
    expect(sheet.lines?.[0]).toEqual({ text: "Baba Nam Kevalam", placements: [{ word: 0, chord: "Am" }, { word: 2, chord: "F" }] })
    expect(sheet.body).toBe("[Am]Baba Nam [F]Kevalam\n[G]Prema Mayi Dhyana")
  })

  it("refuses a Kiirtan", async () => {
    await expect(make().offerChart("kiirtan-1", toChartPayload(chart()))).rejects.toMatchObject({ failure: "invalid" })
  })

  it("refuses the same chart twice and a fourth open one, and the other instrument has its own three", async () => {
    const api = make()
    await api.offerChart("r1", toChartPayload(chart()))
    await expect(api.offerChart("r1", toChartPayload(chart()))).rejects.toMatchObject({ failure: "duplicate" })
    await api.offerChart("r1", toChartPayload(setChord(chart(), 1, 1, "Dm") as ChartDraft))
    await api.offerChart("r1", toChartPayload(setChord(chart(), 1, 2, "Em") as ChartDraft))
    expect(OPEN_PER_RECORDING_INSTRUMENT).toBe(3)
    await expect(api.offerChart("r1", toChartPayload(setChord(chart(), 1, 0, "C") as ChartDraft))).rejects.toMatchObject({ failure: "tooMany" })
    await api.offerChart("r1", toChartPayload({ ...chart(), instrument: "harmonium", capo: 0, strum: "" }))
  })

  it("refuses a chart that was not played, one with no chord, and a chord on a word that is not there", async () => {
    const api = make()
    await expect(api.offerChart("r1", toChartPayload(chart({ playedIt: false })))).rejects.toMatchObject({ failure: "invalid" })
    await expect(api.offerChart("r1", { ...toChartPayload(chart()), lines: [{ text: "Baba Nam", placements: [] }] })).rejects.toMatchObject({ failure: "noChords" })
    await expect(api.offerChart("r1", { ...toChartPayload(chart()), lines: [{ text: "Baba Nam", placements: [{ word: 5, chord: "Am" }, { word: 0, chord: "G" }, { word: 1, chord: "C" }] }] })).rejects.toMatchObject({ failure: "invalid" })
  })

  it("the author fixes a waiting chart in place; a plain-text sheet cannot be turned into a chart", async () => {
    const api = make()
    const sheet = await api.offerChart("r1", toChartPayload(chart()))
    const fixed = await api.updateChart(sheet.id, toChartPayload(setChord(chart(), 1, 1, "Dm") as ChartDraft))
    expect(fixed).toMatchObject({ id: sheet.id, status: "pending", chordsCount: 4 })
    expect((await api.mine()).filter((s) => s.id === sheet.id)).toHaveLength(1)
    const text = await api.offer("r1", { instrument: "harmonium", key: "C", body: "C  G\nOne two", playedIt: true, note: "", isAnonymous: false })
    await expect(api.updateChart(text.id, toChartPayload({ ...chart(), instrument: "harmonium", capo: 0, strum: "" }))).rejects.toMatchObject({ failure: "invalid" })
  })

  it("starting from someone else's published chart credits them; the first author's name comes from the sample", async () => {
    const api = make()
    const [published] = (await api.list("r1")).filter((s) => s.status === "published")
    expect(published?.lines?.length).toBeGreaterThan(0)
    const base = chartDraftFromOther(published!)
    const mine = await api.offerChart("r1", toChartPayload({ ...base, playedIt: true, key: "C", capo: 0 }))
    expect(mine.basedOn?.id).toBe(published!.id)
  })

  it("a chart that comes back to the editor goes out the same (nothing drifts by the capo)", async () => {
    const api = make()
    const sheet = await api.offerChart("r1", toChartPayload({ ...chart(), capo: 2, key: "A", strum: "D DU" }))
    const again = chartDraftFromSheet(sheet, "edit")
    expect(toChartPayload(again).lines).toEqual(toChartPayload({ ...chart(), capo: 2, key: "A", strum: "D DU" }).lines)
    expect(toChartPayload(again).baseKey).toBe(sheet.chartKey)
  })
})
