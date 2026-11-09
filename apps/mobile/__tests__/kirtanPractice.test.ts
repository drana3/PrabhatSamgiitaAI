import { describe, expect, it } from "vitest"

import { avartaCount, avartaOnly, AVARTA, canEditPractice, cleanPractice, isAvarta, isPractice, nextPractice } from "@/lib/kirtan/practice"
import { addFiles, effectivePractice, practiceCounts, setRowFields, type PickedFile } from "@/lib/kirtan/queue"
import { buildSubmission, fromRemote, withPractice, type SubmissionInput } from "@/lib/kirtan/submissions"
import { draftWithPatch } from "@/lib/kirtan/uploadForm"
import { addTracks, newSetDraft, setTrackFields, trackFields, type SetDraft } from "@/lib/kirtan/sets"
import type { RemoteRecording } from "@/lib/kirtan/remote"
import type { Kirtan, RecordingKind } from "@/lib/kirtan/types"

const base: SubmissionInput = { kind: "kiirtan", fileName: "a.mp3", fileUri: "file:///a.mp3", fileSize: 1000, fileType: "audio/mpeg", title: "Avarta round", author: "Priya", addedBy: "You", style: "bengali", byAuthor: false, termsAccepted: true }
const file = (name: string): PickedFile => ({ name, uri: `file:///${name}`, size: 1000, type: "audio/mpeg" })
let n = 0
const newId = () => `r${(n += 1)}`

describe("the Avarta Kiirtan flag", () => {
  it("is one known id, and only a Kiirtan keeps it", () => {
    expect(isPractice("avarta")).toBe(true)
    expect(isPractice("other")).toBe(false)
    expect(cleanPractice("kiirtan", "avarta")).toBe(AVARTA)
    expect(cleanPractice("kiirtan", "kiirtan")).toBeNull()
    expect(cleanPractice("kiirtan", null)).toBeNull()
    for (const kind of ["bhajan", "prabhat_samgiita", "spiritual_song", "dance_song", "baba_audio"]) expect(cleanPractice(kind, "avarta")).toBeNull()
  })

  it("a submission carries it for a Kiirtan and drops it for any other kind", () => {
    expect(buildSubmission({ ...base, practice: "avarta" }, 1)).toMatchObject({ practice: "avarta" })
    expect(buildSubmission(base, 1).practice).toBeUndefined()
    expect(buildSubmission({ ...base, kind: "bhajan", language: "en", practice: "avarta" }, 1).practice).toBeUndefined()
  })

  it("a server row says it, and the server is the truth when it says nothing new", () => {
    const remote = { id: "7", kind: "kiirtan", type: "other", title: "T", author: "A", added_by: "A", author_id: null, by_author: false, status: "published", practice: "avarta", created_at: "2026-11-01T00:00:00Z" } as unknown as RemoteRecording
    expect(fromRemote(remote)).toMatchObject({ practice: "avarta" })
    expect(fromRemote({ ...remote, practice: null }, { ...fromRemote(remote) }).practice).toBeUndefined()
    expect(fromRemote({ ...remote, kind: "bhajan" }).practice).toBeUndefined()
  })

  it("counts and filters the Avarta Kiirtan of a list", () => {
    const list = [{ kind: "kiirtan", practice: "avarta" }, { kind: "kiirtan" }, { kind: "bhajan", practice: "avarta" }, { practice: "avarta" }]
    expect(avartaCount(list)).toBe(2) // a missing kind reads as a Kiirtan; a Bhajan is never Avarta Kiirtan
    expect(avartaOnly(list)).toHaveLength(2)
    expect(avartaCount([])).toBe(0)
    expect(isAvarta(null)).toBe(false)
  })

  it("changing the type of the form drops the mark", () => {
    const form = { kind: "kiirtan" as RecordingKind, language: null, languageOther: "", dance: null, credits: "", place: "", discourse: "", psSong: null, style: "hindi", styleOther: "", practice: "avarta" }
    expect(draftWithPatch(form, { place: "x" }).practice).toBe("avarta")
    expect(draftWithPatch(form, { kind: "bhajan" }).practice).toBeNull()
  })

  it("withPractice marks and unmarks a recording by its own or its server id", () => {
    const list = [{ id: "a", serverId: "7", kind: "kiirtan" }, { id: "b", kind: "kiirtan", practice: "avarta" }] as unknown as Kirtan[]
    expect(withPractice(list, "7", "avarta")[0]!.practice).toBe("avarta")
    expect(withPractice(list, "b", null)[1]!.practice).toBeUndefined()
    expect(withPractice(list, "7", "junk")[0]!.practice).toBeUndefined()
  })

  it("only the owner or the team may change a published Kiirtan", () => {
    const k = { kind: "kiirtan", status: "published" } as const
    expect(canEditPractice(k, { mine: true, team: false })).toBe(true)
    expect(canEditPractice(k, { mine: false, team: true })).toBe(true)
    expect(canEditPractice(k, { mine: false, team: false })).toBe(false)
    expect(canEditPractice({ kind: "bhajan", status: "published" }, { mine: true, team: true })).toBe(false)
    expect(canEditPractice({ kind: "kiirtan", status: "uploading" }, { mine: true, team: true })).toBe(false)
    expect(nextPractice(true)).toBe("avarta")
    expect(nextPractice(false)).toBeNull()
  })
})

describe("the Avarta flag in a bulk queue", () => {
  const rows = () => addFiles([], [file("a.mp3"), file("b.mp3"), file("c.mp3")], newId).items

  it("a row follows the tick of the whole queue until it says otherwise", () => {
    const items = rows()
    expect(items.map((i) => effectivePractice(i, "kiirtan", "avarta"))).toEqual(["avarta", "avarta", "avarta"])
    const one = setRowFields(items, items[1]!.id, { practice: null })
    expect(one.map((i) => effectivePractice(i, "kiirtan", "avarta"))).toEqual(["avarta", null, "avarta"])
    const other = setRowFields(items, items[0]!.id, { practice: "avarta" })
    expect(other.map((i) => effectivePractice(i, "kiirtan", null))).toEqual(["avarta", null, null])
  })

  it("only a Kiirtan queue has it", () => {
    const items = rows()
    expect(effectivePractice(items[0]!, "bhajan", "avarta")).toBeNull()
  })

  it("counts the rows still to send that are Avarta", () => {
    const items = rows()
    expect(practiceCounts(items, "kiirtan", "avarta")).toEqual({ avarta: 3, total: 3 })
    const mixed = setRowFields(items, items[2]!.id, { practice: null })
    expect(practiceCounts(mixed, "kiirtan", "avarta")).toEqual({ avarta: 2, total: 3 })
    expect(practiceCounts(mixed, "kiirtan", null)).toEqual({ avarta: 0, total: 3 })
    const sent = mixed.map((i, index) => (index === 0 ? { ...i, status: "done" as const } : i))
    expect(practiceCounts(sent, "kiirtan", "avarta")).toEqual({ avarta: 1, total: 2 })
  })
})

describe("the Avarta flag in an event playlist", () => {
  const draft = (patch: Partial<SetDraft> = {}) => addTracks({ ...newSetDraft("s"), title: "Retreat", defaultStyles: ["indian"], ...patch }, [file("a.mp3"), file("b.mp3")], newId, false).draft

  it("tracks follow the playlist's tick; one track may say otherwise", () => {
    let d = draft({ defaultPractice: "avarta" })
    expect(d.tracks.map((t) => trackFields(t, d).practice)).toEqual(["avarta", "avarta"])
    d = setTrackFields(d, d.tracks[1]!.id, { practice: null })
    expect(d.tracks.map((t) => trackFields(t, d).practice)).toEqual(["avarta", null])
  })

  it("a track of another type has none", () => {
    const d = draft({ defaultKind: "bhajan", defaultLanguage: "bn", defaultPractice: "avarta" })
    expect(trackFields(d.tracks[0]!, d).practice).toBeNull()
  })
})
