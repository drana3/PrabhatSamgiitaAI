import { describe, expect, it } from "vitest"

import {
  CYCLE_DEFAULT_SLOTS,
  CYCLE_MAX_FORMS,
  CYCLE_MAX_SLOTS,
  CYCLE_MIN_SLOTS,
  cycleDraftFromOther,
  cycleDraftFromSheet,
  cycleProblems,
  cycleToWire,
  cycleUsedChords,
  isBlankCycle,
  newCycleDraft,
  resizeForm,
  roundOrder,
  setFormCount,
  setFormName,
  setFormTimes,
  setSlot,
  setStart,
  toCyclePayload,
  type CycleDraft,
} from "@/lib/recordingChords/cycle"
import { kindHasCharts, kindHasCycle } from "@/lib/recordingChords/kinds"
import { createSheetsMock } from "@/lib/recordingChords/mock"
import { sheetFromWire, type WireSheet } from "@/lib/recordingChords/remote"
import { OPEN_PER_RECORDING_INSTRUMENT } from "@/lib/recordingChords/rules"
import { cycleFormHref, sheetFormHref } from "@/lib/recordingExtras/links"

/** One form of four chords, played by the member. */
function finished(extra: Partial<CycleDraft> = {}): CycleDraft {
  let d = newCycleDraft(1)
  for (const [i, chord] of ["Em", "C", "G", "D"].entries()) d = setSlot(d, 0, i, chord)
  return { ...d, playedIt: true, ...extra }
}

const mock = (opts: { cycle?: boolean } = {}) => createSheetsMock({ me: () => "Me", chartKind: () => false, cycleKind: () => opts.cycle ?? true })

describe("which recordings take a chord cycle", () => {
  it("only a Kiirtan does, and a Kiirtan never takes a chart over words", () => {
    expect(kindHasCycle("kiirtan")).toBe(true)
    expect(kindHasCharts("kiirtan")).toBe(false)
  })
  it("a Bhajan, a Spiritual song, a Prabhat Samgiita recording, a dance music and a discourse do not", () => {
    for (const kind of ["bhajan", "spiritual_song", "prabhat_samgiita", "dance_song", "baba_audio"]) expect(kindHasCycle(kind), kind).toBe(false)
  })
  it("an old or missing kind is a Kiirtan, as everywhere else", () => {
    expect(kindHasCycle(null)).toBe(true)
    expect(kindHasCycle("")).toBe(true)
  })
})

describe("a new cycle", () => {
  it("starts with one ring of four empty places and the first one as the start", () => {
    const d = newCycleDraft()
    expect(d.forms).toHaveLength(1)
    expect(d.forms[0]?.slots).toEqual([null, null, null, null])
    expect(d.forms[0]?.start).toBe(0)
    expect(CYCLE_DEFAULT_SLOTS).toBe(4)
  })
  it("has as many forms as the member said are played in the recording, each its own ring", () => {
    const d = newCycleDraft(3)
    expect(d.forms).toHaveLength(3)
    expect(new Set(d.forms.map((f) => f.slots)).size).toBe(3)
  })
  it("keeps the number of forms between one and eight", () => {
    expect(newCycleDraft(0).forms).toHaveLength(1)
    expect(newCycleDraft(40).forms).toHaveLength(CYCLE_MAX_FORMS)
    expect(setFormCount(newCycleDraft(2), 99).forms).toHaveLength(CYCLE_MAX_FORMS)
    expect(setFormCount(newCycleDraft(2), 0).forms).toHaveLength(1)
  })
  it("changing the number of forms keeps the chords of the ones that stay", () => {
    let d = setSlot(newCycleDraft(3), 0, 0, "Am")
    d = setFormCount(d, 2)
    expect(d.forms[0]?.slots[0]).toBe("Am")
    d = setFormCount(d, 4)
    expect(d.forms).toHaveLength(4)
    expect(d.forms[0]?.slots[0]).toBe("Am")
  })
  it("is blank until something is typed", () => {
    expect(isBlankCycle(newCycleDraft(2))).toBe(true)
    expect(isBlankCycle(setSlot(newCycleDraft(2), 1, 0, "C"))).toBe(false)
    expect(isBlankCycle(setFormName(newCycleDraft(), 0, "Slow"))).toBe(false)
  })
})

describe("the ring", () => {
  it("grows to eight places and shrinks to two, never more or fewer", () => {
    let d = newCycleDraft()
    d = resizeForm(d, 0, 20)
    expect(d.forms[0]?.slots).toHaveLength(CYCLE_MAX_SLOTS)
    d = resizeForm(d, 0, 0)
    expect(d.forms[0]?.slots).toHaveLength(CYCLE_MIN_SLOTS)
  })
  it("keeps the chords and the start inside when a ring shrinks", () => {
    let d = finished()
    d = setStart(d, 0, 3)
    d = resizeForm(d, 0, 3)
    expect(d.forms[0]?.slots).toEqual(["Em", "C", "G"])
    expect(d.forms[0]?.start).toBe(2)
  })
  it("a start outside the ring is ignored", () => {
    const d = setStart(finished(), 0, 9)
    expect(d.forms[0]?.start).toBe(0)
  })
  it("the round is read from the start place and goes round", () => {
    expect(roundOrder({ name: null, chords: ["Em", "C", "G", "D"], start: 2, times: null })).toEqual(["G", "D", "Em", "C"])
  })
  it("a chord of one form does not leak into another", () => {
    const d = setSlot(newCycleDraft(2), 0, 0, "Em")
    expect(d.forms[1]?.slots[0]).toBeNull()
  })
  it("lists the chords used so far once each, in order", () => {
    expect(cycleUsedChords(setSlot(setSlot(finished(), 0, 3, "Em"), 0, 2, "C"))).toEqual(["Em", "C"])
  })
})

describe("what stops a cycle from being sent", () => {
  it("a finished ring passes", () => {
    expect(cycleProblems(finished())).toEqual([])
  })
  it("a ring with a hole in it has no round to play", () => {
    expect(cycleProblems(setSlot(finished(), 0, 2, null))).toContain("noChords")
    expect(cycleProblems(newCycleDraft())).toContain("noChords")
  })
  it("a word that is not a chord is refused", () => {
    expect(cycleProblems(setSlot(finished(), 0, 0, "hello"))).toContain("noChords")
  })
  it("one lonely plain letter is not a cycle", () => {
    let d = newCycleDraft()
    for (let i = 0; i < 4; i++) d = setSlot(d, 0, i, "A")
    expect(cycleProblems({ ...d, playedIt: true })).toContain("fewChords")
  })
  it("the member must say they know the Kiirtan", () => {
    expect(cycleProblems(finished({ playedIt: false }))).toEqual(["notPlayed"])
  })
  it("the key, if given, must be a note name", () => {
    expect(cycleProblems(finished({ key: "H" }))).toContain("badKey")
    expect(cycleProblems(finished({ key: "F#m" }))).toEqual([])
  })
  it("the number of rounds is a whole number from 1 to 99, or nothing", () => {
    expect(cycleProblems({ ...finished(), forms: [setFormTimes(finished(), 0, "4").forms[0]!] })).toEqual([])
    const zero = setFormTimes(finished(), 0, "0")
    expect(cycleProblems(zero)).toContain("badTimes")
    // letters are never kept
    expect(setFormTimes(finished(), 0, "x4").forms[0]?.times).toBe("4")
  })
  it("a note takes no web link, and a form name takes none either", () => {
    expect(cycleProblems(finished({ note: "see https://example.com" }))).toContain("links")
    expect(cycleProblems(setFormName(finished(), 0, "see https://example.com"))).toContain("links")
  })
  it("two forms exactly the same are one form too many", () => {
    let d = setFormCount(finished(), 2)
    for (const [i, chord] of ["Em", "C", "G", "D"].entries()) d = setSlot(d, 1, i, chord)
    expect(cycleProblems(d)).toContain("sameForm")
    // a different start makes it another form
    expect(cycleProblems(setStart(d, 1, 2))).toEqual([])
  })
  it("a form name is at most thirty characters", () => {
    expect(cycleProblems(setFormName(finished(), 0, "x".repeat(31)))).toContain("tooLong")
  })
})

describe("what is sent", () => {
  it("is the rings with the start and rounds, a clean name and no empty places", () => {
    const d = setFormName(setFormTimes(setStart(finished({ key: " Em ", note: " nice " }), 0, 1), 0, "4"), 0, "  Slow   round ")
    const p = toCyclePayload(d)
    expect(p.cycle.forms).toEqual([{ name: "Slow round", chords: ["Em", "C", "G", "D"], start: 1, times: 4 }])
    expect(p.key).toBe("Em")
    expect(p.note).toBe("nice")
    expect(p.replacesId).toBeNull()
  })
  it("a harmonium has no capo", () => {
    expect(toCyclePayload(finished({ instrument: "harmonium", capo: 3 })).capo).toBe(0)
    expect(toCyclePayload(finished({ instrument: "guitar", capo: 3 })).capo).toBe(3)
  })
  it("goes out in the API's own words", () => {
    const wire = cycleToWire(toCyclePayload(finished({ key: "Em", capo: 2 })))
    expect(wire).toMatchObject({ instrument: "guitar", chart_key: "Em", capo: 2, played_it: true, is_anonymous: false })
    expect(wire.cycle).toEqual({ forms: [{ name: null, chords: ["Em", "C", "G", "D"], start: 0, times: null }] })
    expect(wire).not.toHaveProperty("lines")
    expect(wire).not.toHaveProperty("body")
    expect(wire).not.toHaveProperty("replaces_id")
  })
  it("names the sheet a new version replaces, and the one it was started from", () => {
    const wire = cycleToWire(toCyclePayload({ ...finished(), replacesId: "old", basedOn: { id: "orig", name: "A" } }))
    expect(wire.replaces_id).toBe("old")
    expect(wire.based_on_id).toBe("orig")
  })
})

const WIRE: WireSheet = {
  id: "s1",
  recording_id: "r1",
  instrument: "guitar",
  chart_key: "Em",
  body: "Form 1: Em - C - G - D",
  cycle: { forms: [{ name: "Slow", chords: ["Em", "C", "G", "D"], start: 2, times: 4 }] },
  chords_count: 4,
  note: null,
  played_it: true,
  created_at: "2026-01-01T00:00:00Z",
  is_anonymous: false,
  author: { name: "A" },
  mine: true,
  status: "published",
  rejected_reason: null,
  can_review: false,
}

describe("a cycle that comes from the server", () => {
  it("keeps its forms, start and rounds", () => {
    const sheet = sheetFromWire(WIRE)
    expect(sheet.cycle?.forms[0]).toEqual({ name: "Slow", chords: ["Em", "C", "G", "D"], start: 2, times: 4 })
  })
  it("a sheet without a cycle has none", () => {
    expect(sheetFromWire({ ...WIRE, cycle: undefined }).cycle).toBeNull()
  })
  it("fixing a cycle gives the draft back, with the id being fixed", () => {
    const d = cycleDraftFromSheet(sheetFromWire(WIRE), "edit")
    expect(d.editId).toBe("s1")
    expect(d.replacesId).toBeNull()
    expect(d.forms[0]).toEqual({ name: "Slow", slots: ["Em", "C", "G", "D"], start: 2, times: "4" })
  })
  it("changing a live one makes a replacement", () => {
    const d = cycleDraftFromSheet(sheetFromWire(WIRE), "copy")
    expect(d.editId).toBeNull()
    expect(d.replacesId).toBe("s1")
  })
  it("starting from somebody else's cycle copies the chords, credits them and asks for a new yes", () => {
    const d = cycleDraftFromOther(sheetFromWire({ ...WIRE, mine: false, author: { name: "Priya" } }))
    expect(d.basedOn).toEqual({ id: "s1", name: "Priya" })
    expect(d.playedIt).toBe(false)
    expect(d.editId).toBeNull()
    expect(d.replacesId).toBeNull()
    expect(d.forms[0]?.slots).toEqual(["Em", "C", "G", "D"])
  })
})

describe("where adding a cycle goes", () => {
  it("a Kiirtan goes to the cycle screen, with the ids of what is fixed, copied or started from", () => {
    expect(cycleFormHref({ recordingId: "r1" })).toBe("/recording-cycle?recording=r1")
    expect(cycleFormHref({ recordingId: "r1", title: "A & B", edit: "s9" })).toBe("/recording-cycle?recording=r1&title=A%20%26%20B&edit=s9")
    expect(cycleFormHref({ recordingId: "r1", copy: "s9", edit: "" })).toBe("/recording-cycle?recording=r1&copy=s9")
    expect(cycleFormHref({ recordingId: "r1", from: "s9", instrument: "harmonium" })).toBe("/recording-cycle?recording=r1&from=s9&instrument=harmonium")
  })
  it("a chart still wins over a cycle and a plain recording keeps the text sheet", () => {
    expect(sheetFormHref({ chart: true, cycle: true, recordingId: "r1" })).toBe("/recording-chart?recording=r1")
    expect(sheetFormHref({ chart: false, cycle: true, recordingId: "r1" })).toBe("/recording-cycle?recording=r1")
    expect(sheetFormHref({ chart: false, recordingId: "r1" })).toBe("/recording-chords?recording=r1")
  })
})

describe("the preview's in-memory server", () => {
  it("shows a Kiirtan a made-up cycle of two forms, published", async () => {
    const list = await mock().list("r1")
    const sheet = list.find((s) => s.cycle)
    expect(sheet?.status).toBe("published")
    expect(sheet?.cycle?.forms).toHaveLength(2)
  })
  it("a cycle waits for the team, and is the member's own", async () => {
    const m = mock()
    const sheet = await m.offerCycle("r1", toCyclePayload(finished()))
    expect(sheet).toMatchObject({ status: "pending", mine: true, instrument: "guitar" })
    expect(sheet.cycle?.forms[0]?.chords).toEqual(["Em", "C", "G", "D"])
    expect((await m.list("r1")).some((s) => s.id === sheet.id)).toBe(true)
  })
  it("the same cycle twice is refused", async () => {
    const m = mock()
    await m.offerCycle("r1", toCyclePayload(finished()))
    await expect(m.offerCycle("r1", toCyclePayload(finished()))).rejects.toMatchObject({ failure: "duplicate" })
  })
  it("a Bhajan (or any recording that is not a Kiirtan) refuses a cycle", async () => {
    await expect(mock({ cycle: false }).offerCycle("r1", toCyclePayload(finished()))).rejects.toMatchObject({ failure: "invalid" })
  })
  it("three open cycles per instrument, like the other sheets", async () => {
    const m = mock()
    for (let i = 0; i < OPEN_PER_RECORDING_INSTRUMENT; i++) {
      await m.offerCycle("r1", toCyclePayload(setSlot(finished(), 0, 0, ["Am", "Dm", "E"][i] as string)))
    }
    await expect(m.offerCycle("r1", toCyclePayload(setSlot(finished(), 0, 0, "F")))).rejects.toMatchObject({ failure: "tooMany" })
  })
  it("a waiting cycle can be fixed and sent again, a live one cannot be changed in place", async () => {
    const m = mock()
    const sheet = await m.offerCycle("r1", toCyclePayload(finished()))
    const fixed = await m.updateCycle(sheet.id, toCyclePayload(setSlot(finished(), 0, 1, "F")))
    expect(fixed.id).toBe(sheet.id)
    expect(fixed.cycle?.forms[0]?.chords[1]).toBe("F")
    const seeded = (await m.list("r2")).find((s) => s.cycle)
    await expect(m.updateCycle(seeded?.id ?? "x", toCyclePayload(finished()))).rejects.toMatchObject({ failure: "forbidden" })
  })
  it("a new version of the member's own live cycle names the one it replaces only when it is live and theirs", async () => {
    const m = mock()
    const sheet = await m.offerCycle("r1", toCyclePayload({ ...finished(), replacesId: "no-such-sheet" }))
    expect(sheet.replaces).toBeNull()
  })
  it("the cycle goes without anything about words or timing", async () => {
    const sheet = await mock().offerCycle("r1", toCyclePayload(finished()))
    expect(sheet.lines).toBeNull()
    expect(sheet.strum).toBeNull()
  })
})
