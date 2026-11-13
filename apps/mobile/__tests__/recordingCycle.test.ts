import { describe, expect, it } from "vitest"

import {
  CYCLE_DEFAULT_SLOTS,
  CYCLE_MAX_TUNES,
  CYCLE_MAX_SLOTS,
  CYCLE_MIN_SLOTS,
  activeTunes,
  chooseTunes,
  cycleDraftFromOther,
  cycleFromWire,
  keyLikePrevious,
  missingTunes,
  nextTune,
  openTune,
  parseTuneRange,
  previousTune,
  priorTune,
  setTuneKey,
  setTuneSkipped,
  tuneProblems,
  tuneState,
  tuneStates,
  cycleDraftFromSheet,
  cycleProblems,
  cycleToWire,
  cycleUsedChords,
  isBlankCycle,
  newCycleDraft,
  resizeTune,
  roundOrder,
  setTuneCount,
  setTuneName,
  setTuneTimes,
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

/** One tune of four chords, played by the member. */
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
    expect(d.tunes).toHaveLength(1)
    expect(d.tunes[0]?.slots).toEqual([null, null, null, null])
    expect(d.tunes[0]?.start).toBe(0)
    expect(CYCLE_DEFAULT_SLOTS).toBe(4)
  })
  it("has as many tunes as the member said are played in the recording, each its own ring", () => {
    const d = newCycleDraft(3)
    expect(d.tunes).toHaveLength(3)
    expect(new Set(d.tunes.map((f) => f.slots)).size).toBe(3)
  })
  it("keeps the number of tunes between one and thirty", () => {
    expect(newCycleDraft(0).tunes).toHaveLength(1)
    expect(newCycleDraft(99).tunes).toHaveLength(CYCLE_MAX_TUNES)
    expect(setTuneCount(newCycleDraft(2), 99).tunes).toHaveLength(CYCLE_MAX_TUNES)
    expect(setTuneCount(newCycleDraft(2), 0).tunes).toHaveLength(1)
  })
  it("changing the number of tunes keeps the chords of the ones that stay", () => {
    let d = setSlot(newCycleDraft(3), 0, 0, "Am")
    d = setTuneCount(d, 2)
    expect(d.tunes[0]?.slots[0]).toBe("Am")
    d = setTuneCount(d, 4)
    expect(d.tunes).toHaveLength(4)
    expect(d.tunes[0]?.slots[0]).toBe("Am")
  })
  it("is blank until something is typed", () => {
    expect(isBlankCycle(newCycleDraft(2))).toBe(true)
    expect(isBlankCycle(setSlot(newCycleDraft(2), 1, 0, "C"))).toBe(false)
    expect(isBlankCycle(setTuneName(newCycleDraft(), 0, "Slow"))).toBe(false)
  })
})

describe("the ring", () => {
  it("grows to eight places and shrinks to two, never more or fewer", () => {
    let d = newCycleDraft()
    d = resizeTune(d, 0, 20)
    expect(d.tunes[0]?.slots).toHaveLength(CYCLE_MAX_SLOTS)
    d = resizeTune(d, 0, 0)
    expect(d.tunes[0]?.slots).toHaveLength(CYCLE_MIN_SLOTS)
  })
  it("keeps the chords and the start inside when a ring shrinks", () => {
    let d = finished()
    d = setStart(d, 0, 3)
    d = resizeTune(d, 0, 3)
    expect(d.tunes[0]?.slots).toEqual(["Em", "C", "G"])
    expect(d.tunes[0]?.start).toBe(2)
  })
  it("a start outside the ring is ignored", () => {
    const d = setStart(finished(), 0, 9)
    expect(d.tunes[0]?.start).toBe(0)
  })
  it("the round is read from the start place and goes round", () => {
    expect(roundOrder({ chords: ["Em", "C", "G", "D"], start: 2 })).toEqual(["G", "D", "Em", "C"])
  })
  it("a chord of one tune does not leak into another", () => {
    const d = setSlot(newCycleDraft(2), 0, 0, "Em")
    expect(d.tunes[1]?.slots[0]).toBeNull()
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
  it("the key of a tune, if given, must be a note name", () => {
    expect(cycleProblems(setTuneKey(finished(), 0, "H"))).toContain("badKey")
    expect(cycleProblems(setTuneKey(finished(), 0, "F#m"))).toEqual([])
  })
  it("the number of rounds is a whole number from 1 to 99, or nothing", () => {
    expect(cycleProblems(setTuneTimes(finished(), 0, "4"))).toEqual([])
    const zero = setTuneTimes(finished(), 0, "0")
    expect(cycleProblems(zero)).toContain("badTimes")
    // letters are never kept
    expect(setTuneTimes(finished(), 0, "x4").tunes[0]?.times).toBe("4")
  })
  it("a note takes no web link, and a tune name takes none either", () => {
    expect(cycleProblems(finished({ note: "see https://example.com" }))).toContain("links")
    expect(cycleProblems(setTuneName(finished(), 0, "see https://example.com"))).toContain("links")
  })
  it("two tunes with the same chords are fine: many tunes share a few chords", () => {
    let d = setTuneCount(finished(), 2)
    for (const [i, chord] of ["Em", "C", "G", "D"].entries()) d = setSlot(d, 1, i, chord)
    expect(cycleProblems(d)).toEqual([])
  })
  it("a tune name is at most thirty characters", () => {
    expect(cycleProblems(setTuneName(finished(), 0, "x".repeat(31)))).toContain("tooLong")
  })
})

describe("what is sent", () => {
  it("is the rings with the start and rounds, a clean name and no empty places", () => {
    const d = setTuneKey(setTuneName(setTuneTimes(setStart(finished({ note: " nice " }), 0, 1), 0, "4"), 0, "  Slow   round "), 0, "Em")
    const p = toCyclePayload(d)
    expect(p.cycle).toEqual({ tuneCount: 1, tunes: [{ number: 1, name: "Slow round", key: "Em", chords: ["Em", "C", "G", "D"], start: 1, times: 4 }] })
    expect(p.key).toBe("Em")
    expect(p.note).toBe("nice")
    expect(p.replacesId).toBeNull()
  })
  it("a harmonium has no capo", () => {
    expect(toCyclePayload(finished({ instrument: "harmonium", capo: 3 })).capo).toBe(0)
    expect(toCyclePayload(finished({ instrument: "guitar", capo: 3 })).capo).toBe(3)
  })
  it("goes out in the API's own words", () => {
    const wire = cycleToWire(toCyclePayload(setTuneKey(finished({ capo: 2 }), 0, "Em")))
    expect(wire).toMatchObject({ instrument: "guitar", chart_key: "Em", capo: 2, played_it: true, is_anonymous: false })
    expect(wire.cycle).toEqual({ tune_count: 1, tunes: [{ number: 1, name: null, key: "Em", chords: ["Em", "C", "G", "D"], start: 0, times: null }] })
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
  body: "Tune 1: Em - C - G - D",
  cycle: { tune_count: 3, tunes: [{ number: 1, name: "Slow", key: "G", chords: ["Em", "C", "G", "D"], start: 2, times: 4 }] },
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
  it("keeps its tunes, start and rounds", () => {
    const sheet = sheetFromWire(WIRE)
    expect(sheet.cycle?.tunes[0]).toEqual({ number: 1, name: "Slow", key: "G", chords: ["Em", "C", "G", "D"], start: 2, times: 4 })
    expect(sheet.cycle?.tuneCount).toBe(3)
  })
  it("a sheet without a cycle has none", () => {
    expect(sheetFromWire({ ...WIRE, cycle: undefined }).cycle).toBeNull()
  })
  it("fixing a cycle gives the draft back, with the id being fixed", () => {
    const d = cycleDraftFromSheet(sheetFromWire(WIRE), "edit")
    expect(d.editId).toBe("s1")
    expect(d.replacesId).toBeNull()
    expect(d.tunes[0]).toEqual({ name: "Slow", slots: ["Em", "C", "G", "D"], start: 2, times: "4", key: "G", skipped: false })
    // the two tunes without chords stay "no chords yet"
    expect(d.tunes.map((f) => f.skipped)).toEqual([false, true, true])
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
    expect(d.tunes[0]?.slots).toEqual(["Em", "C", "G", "D"])
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
  it("shows a Kiirtan a made-up cycle of three tunes (two with chords), published", async () => {
    const list = await mock().list("r1")
    const sheet = list.find((s) => s.cycle)
    expect(sheet?.status).toBe("published")
    expect(sheet?.cycle?.tuneCount).toBe(3)
    expect(sheet?.cycle?.tunes).toHaveLength(2)
  })
  it("a cycle waits for the team, and is the member's own", async () => {
    const m = mock()
    const sheet = await m.offerCycle("r1", toCyclePayload(finished()))
    expect(sheet).toMatchObject({ status: "pending", mine: true, instrument: "guitar" })
    expect(sheet.cycle?.tunes[0]?.chords).toEqual(["Em", "C", "G", "D"])
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
    expect(fixed.cycle?.tunes[0]?.chords[1]).toBe("F")
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


describe("several tunes in one recording", () => {
  const filled = (d: CycleDraft, tune: number, chords: string[]) => chords.reduce((acc, c, i) => setSlot(acc, tune, i, c), d)

  it("asks for as many tunes as the member says, up to thirty", () => {
    expect(CYCLE_MAX_TUNES).toBe(30)
    expect(newCycleDraft(3).tunes).toHaveLength(3)
    expect(setTuneCount(newCycleDraft(), 30).tunes).toHaveLength(30)
    expect(setTuneCount(newCycleDraft(), 31).tunes).toHaveLength(30)
  })

  it("'only some' skips the tunes that were not chosen, and the walk visits only the chosen ones", () => {
    const d = chooseTunes(newCycleDraft(3), [0, 2])
    expect(d.tunes.map((f) => f.skipped)).toEqual([false, true, false])
    expect(activeTunes(d)).toEqual([0, 2])
    expect(nextTune(d, -1)).toBe(0)
    expect(nextTune(d, 0)).toBe(2)
    expect(nextTune(d, 2)).toBeNull()
    expect(priorTune(d, 2)).toBe(0)
    expect(priorTune(d, 0)).toBeNull()
  })

  it("'all of them' leaves every tune to be filled in", () => {
    expect(activeTunes(chooseTunes(newCycleDraft(3), [0, 1, 2]))).toEqual([0, 1, 2])
  })

  it("a skipped tune is not sent, but the recording still says how many tunes it has", () => {
    let d = chooseTunes(newCycleDraft(3), [0, 2])
    d = filled(d, 0, ["Em", "C", "G", "D"])
    d = filled(d, 2, ["Am", "G", "F", "E"])
    d = { ...d, playedIt: true }
    expect(cycleProblems(d)).toEqual([])
    const p = toCyclePayload(d)
    expect(p.cycle.tuneCount).toBe(3)
    expect(p.cycle.tunes.map((f) => f.number)).toEqual([1, 3])
    expect(cycleToWire(p).cycle).toMatchObject({ tune_count: 3 })
  })

  it("a cycle where every tune is skipped cannot be sent", () => {
    expect(cycleProblems({ ...chooseTunes(newCycleDraft(2), []), playedIt: true })).toContain("noTune")
  })

  it("the step of a tune can go on only with a finished ring, or by skipping", () => {
    const d = newCycleDraft(2)
    expect(tuneProblems(d.tunes[0]!)).toContain("noChords")
    expect(tuneProblems(filled(d, 0, ["Em", "C", "G", "D"]).tunes[0]!)).toEqual([])
    expect(tuneProblems(setTuneKey(filled(d, 0, ["Em", "C", "G", "D"]), 0, "H").tunes[0]!)).toContain("badKey")
  })

  it("each tune has its own key; 'Same as previous tune' copies the key of the tune before", () => {
    let d = setTuneKey(newCycleDraft(3), 0, "G")
    d = keyLikePrevious(d, 1)
    expect(d.tunes[1]?.key).toBe("G")
    d = setTuneKey(d, 1, "C")
    expect(d.tunes[0]?.key).toBe("G")
    // the first tune has nothing before it
    expect(keyLikePrevious(newCycleDraft(2), 0)).toEqual(newCycleDraft(2))
    // a skipped tune has no key to copy: the one before it is used
    const skipped = setTuneSkipped(setTuneKey(newCycleDraft(3), 0, "D"), 1, true)
    expect(previousTune(skipped, 2)).toBe(0)
    expect(keyLikePrevious(skipped, 2).tunes[2]?.key).toBe("D")
  })

  it("the key of a tune goes out with its tune, and the sheet is listed under the first one that has a key", () => {
    let d = filled(filled(setTuneCount(newCycleDraft(), 2), 0, ["Em", "C", "G", "D"]), 1, ["Am", "G", "C", "F"])
    d = setTuneKey(d, 1, "C")
    const p = toCyclePayload({ ...d, playedIt: true })
    expect(p.cycle.tunes.map((f) => f.key)).toEqual([null, "C"])
    expect(p.key).toBe("C")
  })

  it("a cycle of the first build (forms, no numbers, no keys) is read as tunes in order", () => {
    const cycle = cycleFromWire({ forms: [{ name: "Slow", chords: ["Em", "C"], start: 0, times: null }, { name: null, chords: ["Am", "G"], start: 1, times: 2 }] })
    expect(cycle.tuneCount).toBe(2)
    expect(cycle.tunes.map((f) => [f.number, f.key])).toEqual([[1, null], [2, null]])
    expect(missingTunes(cycle)).toEqual([])
  })

  it("tunes without chords are listed as missing", () => {
    const cycle = cycleFromWire({ tune_count: 4, tunes: [{ number: 1, name: null, chords: ["Em", "C"], start: 0, times: null }, { number: 3, name: null, key: "G", chords: ["Am", "G"], start: 0, times: null }] })
    expect(missingTunes(cycle)).toEqual([2, 4])
  })

  it("adding a missing tune to somebody else's cycle opens that tune, copies the others and credits the first author", () => {
    const sheet = sheetFromWire({ ...WIRE, mine: false, author: { name: "Priya" } })
    const d = cycleDraftFromOther(sheet, 2)
    expect(d.tunes.map((f) => f.skipped)).toEqual([false, false, true])
    expect(d.tunes[0]?.slots).toEqual(["Em", "C", "G", "D"])
    expect(d.tunes[1]?.slots).toEqual([null, null, null, null])
    expect(d.basedOn?.name).toBe("Priya")
    // a tune that already has chords is not opened again
    expect(cycleDraftFromOther(sheet, 1).tunes.map((f) => f.skipped)).toEqual([false, true, true])
  })

  it("the address of 'add chords for tune 2' carries the tune", () => {
    expect(cycleFormHref({ recordingId: "r1", from: "s9", tune: 2 })).toBe("/recording-cycle?recording=r1&from=s9&tune=2")
    expect(cycleFormHref({ recordingId: "r1", edit: "s9", tune: 2 })).toBe("/recording-cycle?recording=r1&edit=s9")
  })

  it("the preview's in-memory server keeps the count and the numbers of what is sent", async () => {
    let d = chooseTunes(newCycleDraft(3), [0, 2])
    d = filled(filled(d, 0, ["Em", "C", "G", "D"]), 2, ["Am", "G", "F", "E"])
    const sheet = await mock().offerCycle("r1", toCyclePayload({ ...d, playedIt: true }))
    expect(sheet.cycle?.tuneCount).toBe(3)
    expect(sheet.cycle?.tunes.map((f) => f.number)).toEqual([1, 3])
    expect(sheet.body).toContain("Tune 2: no chords yet")
  })
})


describe("thirty tunes in one recording", () => {
  const ring = (n: number) => ["Em", "C", "G", "D", "Am", "F", "Dm", "E"].slice(0, 4 + (n % 5)).map((c, i, all) => all[(i + n) % all.length] as string)
  const full = () => {
    let d = newCycleDraft(30)
    for (let t = 0; t < 30; t++) {
      d = setTuneName(d, t, `Round ${t + 1}`)
      d = setTuneKey(d, t, ["C", "D", "E", "G", "A"][t % 5] as string)
      d = resizeTune(d, t, 8)
      for (let i = 0; i < 8; i++) d = setSlot(d, t, i, ["Em", "C#m7", "Gmaj7", "Dsus4", "Am", "F#m", "Bb", "E7"][(i + t) % 8] as string)
      d = setTuneTimes(d, t, String(1 + (t % 9)))
    }
    return { ...d, playedIt: true }
  }

  it("30 rings of 8 chords can be sent, in order and numbered 1 to 30", () => {
    const d = full()
    expect(cycleProblems(d)).toEqual([])
    const p = toCyclePayload(d)
    expect(p.cycle.tuneCount).toBe(30)
    expect(p.cycle.tunes).toHaveLength(30)
    expect(p.cycle.tunes.map((t) => t.number)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1))
    expect(p.cycle.tunes.every((t) => t.chords.length === 8)).toBe(true)
    // the request stays far under the 1 MB the API accepts
    expect(JSON.stringify(p).length).toBeLessThan(40_000)
  })
  it("the preview server keeps 30 tunes and refuses 31", async () => {
    const m = mock()
    const sheet = await m.offerCycle("r1", toCyclePayload(full()))
    expect(sheet.cycle?.tuneCount).toBe(30)
    expect(sheet.cycle?.tunes).toHaveLength(30)
    const tooMany = toCyclePayload(full())
    await expect(m.offerCycle("r2", { ...tooMany, cycle: { tuneCount: 31, tunes: tooMany.cycle.tunes } })).rejects.toMatchObject({ failure: "invalid" })
  })
  it("a range such as 1-5, 8 names the tunes (counted from 1) and nothing else", () => {
    expect(parseTuneRange("1-5, 8", 30)).toEqual([0, 1, 2, 3, 4, 7])
    expect(parseTuneRange("3", 30)).toEqual([2])
    expect(parseTuneRange("10 12;14", 30)).toEqual([9, 11, 13])
    expect(parseTuneRange("5-3", 30)).toBeNull()
    expect(parseTuneRange("0-2", 30)).toBeNull()
    expect(parseTuneRange("1-31", 30)).toBeNull()
    expect(parseTuneRange("1-a", 30)).toBeNull()
    expect(parseTuneRange("  ", 30)).toEqual([])
    expect(parseTuneRange("2, 2, 1-3", 30)).toEqual([0, 1, 2])
  })
  it("choosing '1-5, 8' out of 30 skips the other 24 and the walk visits the six", () => {
    const d = chooseTunes(newCycleDraft(30), parseTuneRange("1-5, 8", 30) ?? [])
    expect(activeTunes(d)).toEqual([0, 1, 2, 3, 4, 7])
    expect(nextTune(d, 4)).toBe(7)
    expect(nextTune(d, 7)).toBeNull()
    expect(d.tunes.filter((f) => f.skipped)).toHaveLength(24)
  })
  it("every tune says where it stands: ready, left as no chords yet, partly filled or not started", () => {
    let d = chooseTunes(newCycleDraft(30), [0, 1, 2])
    for (let i = 0; i < 4; i++) d = setSlot(d, 0, i, ["Em", "C", "G", "D"][i] as string)
    d = setSlot(d, 1, 0, "Am")
    expect(tuneState(d.tunes[0]!)).toBe("done")
    expect(tuneState(d.tunes[1]!)).toBe("partial")
    expect(tuneState(d.tunes[2]!)).toBe("empty")
    expect(tuneState(d.tunes[7]!)).toBe("skipped")
    expect(tuneStates(d)).toEqual({ done: 1, partial: 1, empty: 1, skipped: 27 })
  })
  it("jumping to a tune that was left as no chords yet takes it back into the walk", () => {
    const d = chooseTunes(newCycleDraft(30), [0])
    expect(d.tunes[20]?.skipped).toBe(true)
    const jumped = openTune(d, 20)
    expect(jumped.tunes[20]?.skipped).toBe(false)
    expect(openTune(jumped, 20)).toBe(jumped)
    expect(nextTune(jumped, 0)).toBe(20)
  })
  it("'same as previous tune' and the previous tune work far into the list", () => {
    let d = chooseTunes(newCycleDraft(30), [3, 29])
    d = setTuneKey(d, 3, "G")
    expect(previousTune(d, 29)).toBe(3)
    expect(keyLikePrevious(d, 29).tunes[29]?.key).toBe("G")
    expect(missingTunes(cycleFromWire({ tune_count: 30, tunes: [{ number: 4, name: null, key: "G", chords: ["Em", "C"], start: 0, times: null }] })).length).toBe(29)
  })
  it("an address asks for tune 17 of a cycle of 30", () => {
    expect(cycleFormHref({ recordingId: "r1", title: "x", from: "s1", tune: 17 })).toContain("tune=17")
  })
})
