import { describe, expect, it } from "vitest"

import { BOOKLET_PIANO_SONGS, bookletPianoSheet, hasBookletPiano } from "@/lib/pianoNotes/booklet"
import { EASY_SA, MIDDLE_C, effectiveSa, isWhiteKey, keyMidi, saMidi, swaraOfMidi, swaraText, westernOfMidi, whiteOnly, windowFor } from "@/lib/pianoNotes/keys"
import { NetworkError, RemoteError } from "@/lib/kirtan/remote"
import { createPianoMock, pianoMockFailure } from "@/lib/pianoNotes/mock"
import { pianoFailureFromError, pianoRemote, sheetFromWire, type WireSheet } from "@/lib/pianoNotes/remote"
import { draftFromSheet, draftToWire, levelOf, momentsOf, sounding, validateDraft, visibleSheets } from "@/lib/pianoNotes/rules"
import { formatSargamLine, parseSargamLine, parseSwara, stepLabel } from "@/lib/pianoNotes/sargamText"
import type { PianoDraft, PianoRow } from "@/lib/pianoNotes/types"

import { CFG, fakeFetch, type Seen } from "./recordingExtrasHelpers"

const row = (notes: number[], over: Partial<PianoRow> = {}): PianoRow => ({ label: null, repeat: 1, hand: "right", steps: notes.map((k) => ({ k: [k], b: 1 })), ...over })
const draft = (over: Partial<PianoDraft> = {}): PianoDraft => ({ saKey: "C", rows: [row([0, 2, 4, 5])], linkUrl: "", note: "", isAnonymous: false, ...over })

describe("keys", () => {
  it("Sa on C is middle C and the shuddha swaras are the white keys", () => {
    expect(saMidi("C")).toBe(MIDDLE_C)
    expect(saMidi("G")).toBe(MIDDLE_C + 7)
    for (const k of [0, 2, 4, 5, 7, 9, 11]) expect(isWhiteKey(keyMidi(k, "C"))).toBe(true)
    for (const k of [1, 3, 6, 8, 10]) expect(isWhiteKey(keyMidi(k, "C"))).toBe(false)
  })

  it("easy keys fix Sa on C, whatever Sa was picked", () => {
    expect(effectiveSa({ easy: true, sa: "G" })).toBe(EASY_SA)
    expect(effectiveSa({ easy: false, sa: "G" })).toBe("G")
    expect(effectiveSa({ easy: false, sa: "H" })).toBe("C")
  })

  it("names a key by swara and by note, and writes the octave marks", () => {
    expect(swaraOfMidi(60, "C")).toBe("Sa")
    expect(swaraOfMidi(62, "D")).toBe("Sa")
    expect(swaraOfMidi(61, "C")).toBe("re")
    expect(westernOfMidi(60)).toBe("C4")
    expect(westernOfMidi(61)).toBe("C#4")
    expect(westernOfMidi(71)).toBe("B4")
    expect(swaraText(0)).toBe("Sa")
    expect(swaraText(12)).toBe("Sa'")
    expect(swaraText(24)).toBe("Sa''")
    expect(swaraText(-5)).toBe(".Pa")
    expect(swaraText(-12)).toBe(".Sa")
  })

  it("a sheet on the white keys stays on them for Sa on C only", () => {
    const steps = row([0, 2, 4, 7, 9]).steps
    expect(whiteOnly(steps, "C")).toBe(true)
    expect(whiteOnly(steps, "D")).toBe(false)
  })

  it("the keyboard covers the keys of the sheet, two octaves at least, from a C", () => {
    expect(windowFor([])).toEqual({ start: 60, end: 83 })
    expect(windowFor([62, 70])).toEqual({ start: 60, end: 83 })
    expect(windowFor([55, 62])).toEqual({ start: 48, end: 71 })
    expect(windowFor([60, 85])).toEqual({ start: 60, end: 95 })
  })
})

describe("the text line", () => {
  const keys = (text: string) => parseSargamLine(text).steps.map((s) => s.k)

  it("reads the seven swaras, komal and tivra", () => {
    expect(keys("Sa Re Ga Ma Pa Dha Ni")).toEqual([[0], [2], [4], [5], [7], [9], [11]])
    expect(keys("re ga dha ni")).toEqual([[1], [3], [8], [10]])
    expect(keys("Reb Gab Dhab Nib")).toEqual([[1], [3], [8], [10]])
    expect(keys("Ma# Ma♯ ma#")).toEqual([[6], [6], [6]])
    expect(keys("S R G M P D N")).toEqual([[0], [2], [4], [6], [7], [9], [11]])
    expect(keys("m r g d n")).toEqual([[5], [1], [3], [8], [10]])
  })

  it("reads the octave marks and the beats", () => {
    expect(keys("Sa' Re'' .Pa ..Ni _Dha")).toEqual([[12], [26], [-5], [-13], [-3]])
    expect(parseSargamLine("Sa:2 Re:0.5 Ga:1.5").steps.map((s) => s.b)).toEqual([2, 0.5, 1.5])
    expect(parseSargamLine("Sa - Re --").steps).toEqual([{ k: [0], b: 2 }, { k: [2], b: 3 }])
  })

  it("reads rests, chords and bar lines", () => {
    expect(parseSargamLine("Sa 0 0:2 | Re").steps).toEqual([{ k: [0], b: 1 }, { k: [], b: 1 }, { k: [], b: 2 }, { k: [2], b: 1 }])
    expect(parseSargamLine("(Pa Sa Ga):2 Re").steps).toEqual([{ k: [0, 4, 7], b: 2 }, { k: [2], b: 1 }])
    expect(parseSargamLine("(Sa, Ga, Pa)").steps).toEqual([{ k: [0, 4, 7], b: 1 }])
  })

  it("keeps the rest of the line when a word is not understood, and says which", () => {
    const parsed = parseSargamLine("Sa Xa Re Sa# Pa:0.3 - (Sa Zz)")
    expect(parsed.steps.map((s) => s.k)).toEqual([[0], [2]])
    expect(parsed.bad).toEqual(["Xa", "Sa#", "Pa:0.3", "(Sa Zz)"])
    expect(parseSargamLine("Sa Pa#").bad).toEqual(["Pa#"])
    expect(parseSargamLine("Sa Reb'").steps).toHaveLength(2)
    expect(parseSargamLine("rea").bad).toEqual(["rea"])
    expect(parseSargamLine("re#").bad).toEqual(["re#"])
    expect(parseSargamLine("reb").bad).toEqual(["reb"])
    expect(parseSargamLine("Mab").bad).toEqual(["Mab"])
    expect(parseSargamLine("Sa:17").bad).toEqual(["Sa:17"])
    expect(parseSargamLine("- Sa").bad).toEqual(["-"])
  })

  it("writes what it reads", () => {
    const text = "Sa Re:2 (Sa Ga Pa):0.5 0 0:2 .Pa Ma# Dha'' ni"
    const parsed = parseSargamLine(text)
    expect(parsed.bad).toEqual([])
    expect(formatSargamLine(parsed.steps)).toBe(text)
    expect(parseSargamLine(formatSargamLine(parsed.steps)).steps).toEqual(parsed.steps)
    expect(stepLabel({ k: [], b: 1 })).toBe("–")
    expect(stepLabel({ k: [0, 7], b: 1 })).toBe("Sa Pa")
    expect(parseSwara("Re").ok).toBe(true)
    expect(parseSwara("").ok).toBe(false)
  })
})

describe("rules", () => {
  it("needs two sounding notes, and the limits of the server", () => {
    expect(validateDraft(draft())).toBeNull()
    expect(validateDraft(draft({ rows: [row([0])] }))).toBe("tooFew")
    expect(validateDraft(draft({ rows: [{ ...row([0, 2]), steps: [{ k: [0], b: 1 }, { k: [], b: 1 }] }] }))).toBe("tooFew")
    expect(validateDraft(draft({ rows: [] }))).toBe("tooFew")
    expect(validateDraft(draft({ rows: [row([0, 99])] }))).toBe("invalid")
    expect(validateDraft(draft({ rows: [row(Array.from({ length: 129 }, () => 0))] }))).toBe("tooLong")
    expect(validateDraft(draft({ rows: Array.from({ length: 5 }, () => row(Array.from({ length: 125 }, (_, i) => i % 5))) }))).toBe("tooLong")
    expect(validateDraft(draft({ saKey: "H" }))).toBe("invalid")
    expect(validateDraft(draft({ note: "see https://x.org" }))).toBe("links")
    expect(validateDraft(draft({ linkUrl: "http://x.org/a" }))).toBe("badLink")
    expect(validateDraft(draft({ linkUrl: "https://x.org/a" }))).toBeNull()
  })

  it("counts sounding steps and works out the level", () => {
    expect(sounding([{ ...row([0, 2]), steps: [{ k: [0], b: 1 }, { k: [], b: 1 }] }])).toBe(1)
    expect(levelOf([row([0, 2])])).toBe("one_finger")
    expect(levelOf([row([0, 2]), row([-12], { hand: "left" })])).toBe("two_hands")
  })

  it("plays a row after a row, repeats included", () => {
    const moments = momentsOf([row([0, 2], { repeat: 2 }), row([4])], "one_finger")
    expect(moments.map((m) => [m.t, m.keys.map((k) => k.k)])).toEqual([[0, [0]], [1, [2]], [2, [0]], [3, [2]], [4, [4]]])
    expect(moments[1]!.spots).toEqual([{ row: 0, step: 1 }])
  })

  it("the left hand starts with the right hand it follows, and one finger leaves it out", () => {
    const rows = [row([0, 2, 4, 5]), row([-12, -5], { hand: "left", steps: [{ k: [-12], b: 2 }, { k: [-5], b: 2 }] }), row([7, 9])]
    const both = momentsOf(rows, "two_hands")
    expect(both.map((m) => [m.t, m.keys.map((k) => `${k.hand[0]}${k.k}`)])).toEqual([[0, ["r0", "l-12"]], [1, ["r2"]], [2, ["r4", "l-5"]], [3, ["r5"]], [4, ["r7"]], [5, ["r9"]]])
    const one = momentsOf(rows, "one_finger")
    expect(one.every((m) => m.keys.every((k) => k.hand === "right"))).toBe(true)
    expect(one).toHaveLength(6)
  })

  it("starting from a sheet copies the notes and links the credit", () => {
    const base = sheetFromWire(wire({ id: "s1", status: "published" }))
    const copy = draftFromSheet(base, "copy")
    expect(copy.basedOnId).toBe("s1")
    expect(copy.replacesId).toBeNull()
    copy.rows[0]!.steps[0]!.k.push(9)
    expect(base.rows[0]!.steps[0]!.k).toEqual([0])
    expect(draftFromSheet(base, "version").replacesId).toBe("s1")
  })

  it("shows live sheets and the member's own waiting ones, never a replaced one", () => {
    const live = sheetFromWire(wire({ id: "a", status: "published" }))
    const mine = sheetFromWire(wire({ id: "b", status: "pending", mine: true }))
    const other = sheetFromWire(wire({ id: "c", status: "pending" }))
    const old = sheetFromWire(wire({ id: "d", status: "published", mine: true, archived: true }))
    expect(visibleSheets([live, mine, other, old]).map((s) => s.id)).toEqual(["a", "b"])
  })
})

function wire(over: Partial<WireSheet> = {}): WireSheet {
  return {
    id: "s1",
    recording_id: "r1",
    sa_key: "C",
    level: "one_finger",
    rows: [{ steps: [{ k: [0], b: 1 }, { k: [2], b: 1 }] }],
    steps_count: 2,
    created_at: "2026-11-01T00:00:00Z",
    is_anonymous: false,
    author: { name: "Carya" },
    status: "published",
    ...over,
  }
}

describe("the wire", () => {
  it("an anonymous sheet keeps no author whatever the answer carries", () => {
    expect(sheetFromWire(wire({ is_anonymous: true, author: { name: "Carya" } })).author).toBeNull()
    expect(sheetFromWire(wire()).author).toEqual({ name: "Carya" })
  })

  it("a sheet of a song or of a recording", () => {
    expect(sheetFromWire(wire()).target).toEqual({ kind: "recording", id: "r1" })
    expect(sheetFromWire(wire({ recording_id: null, song_number: 27 })).target).toEqual({ kind: "song", number: 27 })
    expect(sheetFromWire(wire()).rows[0]).toMatchObject({ hand: "right", repeat: 1, label: null })
  })

  it("sends the draft in the shape of the API", () => {
    const body = draftToWire(draft({ linkUrl: " https://x.org/a ", note: " easy ", rows: [row([0, 2], { label: " A " })] }))
    expect(body).toMatchObject({ sa_key: "C", link_url: "https://x.org/a", note: "easy", is_anonymous: false, replaces_id: null, based_on_id: null })
    expect(body.rows[0]).toMatchObject({ label: "A", repeat: 1, hand: "right" })
    expect(draftToWire(draft({ linkUrl: " " })).link_url).toBeNull()
  })

  it("asks the right addresses", async () => {
    const seen: Seen[] = []
    const backend = pianoRemote(CFG(fakeFetch({ status: 200, body: { items: [wire()], recording_ids: ["r1"] } }, seen)))
    expect(await backend.list({ kind: "recording", id: "r 1" })).toHaveLength(1)
    await backend.list({ kind: "song", number: 2 })
    await backend.mine()
    expect(await backend.recordingIds()).toEqual(["r1"])
    await backend.reviewQueue("reported")
    expect(seen.map((s) => `${s.init.method} ${s.url.replace("https://api.example", "")}`)).toEqual([
      "GET /api/v1/piano-notes/recordings/r%201",
      "GET /api/v1/piano-notes/songs/2",
      "GET /api/v1/piano-notes/mine",
      "GET /api/v1/piano-notes/recordings",
      "GET /api/v1/piano-notes/review/queue?filter=reported",
    ])
  })

  it("offers, reports, reviews", async () => {
    const seen: Seen[] = []
    const backend = pianoRemote(CFG(fakeFetch({ status: 201, body: { ...wire(), author_name: "Ananda", reports_count: 2, status: "pending" } }, seen)))
    expect((await backend.offer({ kind: "song", number: 1 }, draft())).status).toBe("pending")
    await backend.report("s 1", "spam")
    const item = await backend.reject("s1", "wrong octave")
    expect(item).toMatchObject({ authorName: "Ananda", reportsCount: 2 })
    await backend.approve("s1")
    await backend.restore("s1")
    expect(seen.map((s) => `${s.init.method} ${s.url.replace("https://api.example/api/v1/piano-notes", "")}`)).toEqual([
      "POST /songs/1",
      "POST /s%201/report",
      "POST /review/s1/reject",
      "POST /review/s1/approve",
      "POST /review/s1/restore",
    ])
    expect(JSON.parse(String(seen[2]!.init.body))).toEqual({ reason: "wrong octave" })
  })

  it("turns the server's refusals into sentences", () => {
    const refuse = (status: number, message: string, code: string | null = null) => pianoFailureFromError(new RemoteError(status, message, { code }))
    expect(pianoFailureFromError(new NetworkError())).toBe("network")
    expect(refuse(429, "x", "piano_daily_limit")).toBe("dailyLimit")
    expect(refuse(409, "x", "piano_duplicate")).toBe("duplicate")
    expect(refuse(409, "x", "piano_open_limit")).toBe("tooMany")
    expect(refuse(409, "x", "piano_not_editable")).toBe("notEditable")
    expect(refuse(401, "x")).toBe("signin")
    expect(refuse(403, "x")).toBe("forbidden")
    expect(refuse(404, "x")).toBe("gone")
    expect(refuse(422, "Add at least two notes before sending.")).toBe("tooFew")
    expect(refuse(422, "Please leave web links out of the note.")).toBe("links")
    expect(refuse(422, "The link must be a web address that starts with https://.")).toBe("badLink")
    expect(refuse(422, "Too many notes for one sheet.")).toBe("tooLong")
    expect(refuse(422, "something else")).toBe("invalid")
    expect(refuse(429, "slow")).toBe("slowDown")
    expect(refuse(500, "boom")).toBe("server")
  })
})

describe("the booklet (stage 0)", () => {
  it("has notes for songs 1, 2 and 27 only", () => {
    expect(BOOKLET_PIANO_SONGS).toEqual([1, 2, 27])
    expect(hasBookletPiano(27)).toBe(true)
    expect(hasBookletPiano(3)).toBe(false)
    expect(bookletPianoSheet(3)).toBeNull()
  })

  it("reads every line as steps above Sa, in the range of the keyboard", () => {
    for (const number of BOOKLET_PIANO_SONGS) {
      const sheet = bookletPianoSheet(number)!
      expect(sheet.fromBooklet).toBe(true)
      expect(sheet.author).toBeNull()
      expect(sheet.rows.length).toBeGreaterThan(2)
      expect(validateDraft({ saKey: "C", rows: sheet.rows, linkUrl: "", note: "", isAnonymous: true })).toBeNull()
      for (const r of sheet.rows) for (const step of r.steps) expect(step.k[0]).toBeGreaterThanOrEqual(-12)
    }
  })

  it("song 2 opens with Sa Re Ga held, as the booklet writes it", () => {
    const first = bookletPianoSheet(2)!.rows[0]!.steps.slice(0, 3)
    expect(first.map((s) => s.k[0])).toEqual([0, 2, 4])
    expect(first[2]!.b).toBeGreaterThanOrEqual(2)
  })
})

describe("the preview backend", () => {
  const target = { kind: "recording", id: "r1" } as const
  const rows = (notes: number[]) => [row(notes)]

  it("shows a sample, keeps a stranger's new sheet for the team and the member's own for the member", async () => {
    const mock = createPianoMock({ me: () => "You" })
    const first = await mock.list(target)
    expect(first).toHaveLength(1)
    expect(first[0]!.author).toEqual({ name: "Carya" })
    const sent = await mock.offer(target, draft({ rows: rows([0, 4, 7]) }))
    expect(sent.status).toBe("pending")
    expect((await mock.list(target)).map((s) => s.id)).toContain(sent.id)
    expect(await mock.recordingIds()).toEqual(["r1"])
  })

  it("refuses the same notes twice, a fourth sheet and notes that are too short", async () => {
    const mock = createPianoMock({ me: () => "You" })
    await mock.offer(target, draft({ rows: rows([0, 2]) }))
    await expect(mock.offer(target, draft({ rows: rows([0, 2]) }))).rejects.toSatisfy((e) => pianoMockFailure(e) === "duplicate")
    await mock.offer(target, draft({ rows: rows([0, 3]) }))
    await mock.offer(target, draft({ rows: rows([0, 4]) }))
    await expect(mock.offer(target, draft({ rows: rows([0, 5]) }))).rejects.toSatisfy((e) => pianoMockFailure(e) === "tooMany")
    await expect(mock.offer({ kind: "song", number: 1 }, draft({ rows: rows([0]) }))).rejects.toSatisfy((e) => pianoMockFailure(e) === "tooFew")
  })

  it("an anonymous sheet carries no author, and review moves it", async () => {
    const mock = createPianoMock({ me: () => "You" })
    const sent = await mock.offer(target, draft({ isAnonymous: true, rows: rows([0, 2]) }))
    expect(sent.author).toBeNull()
    expect((await mock.reviewQueue("pending")).map((s) => s.id)).toEqual([sent.id])
    const rejected = await mock.reject(sent.id, "wrong octave")
    expect(rejected.rejectedReason).toBe("wrong octave")
    expect(await mock.reviewQueue("pending")).toEqual([])
    expect((await mock.restore(sent.id)).status).toBe("published")
    await mock.remove(sent.id)
    await expect(mock.remove(sent.id)).rejects.toBeTruthy()
  })
})
