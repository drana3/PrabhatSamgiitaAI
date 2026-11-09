import { describe, expect, it } from "vitest"

import { cleanMantra, listedMantraFor, MANTRA_IDS } from "@/lib/kirtan/mantra"
import { fromRemote, buildSubmission, validateSubmission, type SubmissionInput } from "@/lib/kirtan/submissions"
import { kirtanTypeLabel, MANTRA_TYPES } from "@/lib/kirtan/types"
import { publishRecording } from "@/lib/kirtan/remote"
import type { RemoteRecording } from "@/lib/kirtan/remote"

/** Dada, 9 Nov 2026: inside Others (was "Other mantras") the person MUST choose what it is; no default; "Something else" asks for a name. */

const base: SubmissionInput = { kind: "other_mantra", fileName: "a.mp3", fileUri: "file:///a.mp3", fileSize: 1000, fileType: "audio/mpeg", title: "Evening", author: "Priya", addedBy: "You", byAuthor: false, termsAccepted: true }

describe("the visible names of Others", () => {
  it("are the six names in the app's Kiirtan / Samgiita romanisation, then Something else", () => {
    expect(MANTRA_TYPES.map((m) => m.label)).toEqual(["Guru Puja", "Pitr Yajina", "Samgacchadhvam", "Nityam Shuddham", "Ananda Sutram", "Shlokas", "Something else"])
    expect(kirtanTypeLabel("shlokas", "other_mantra")).toBe("Shlokas")
  })

  it("keep the old ids (pitriyajina) so older rows still read", () => {
    expect(MANTRA_IDS).toContain("pitriyajina")
    expect(kirtanTypeLabel("pitriyajina", "other_mantra")).toBe("Pitr Yajina")
  })
})

describe("the choice is required and has no default", () => {
  it("an upload that chose nothing is stopped with 'mantra'", () => {
    expect(validateSubmission({ ...base })).toBe("mantra")
    expect(validateSubmission({ ...base, mantraType: null })).toBe("mantra")
    expect(validateSubmission({ ...base, mantraType: "bnk" })).toBe("mantra")
  })

  it("a listed choice is enough", () => {
    for (const id of MANTRA_IDS) expect(validateSubmission({ ...base, mantraType: id })).toBeNull()
  })

  it("Something else needs a name of at least two letters", () => {
    expect(validateSubmission({ ...base, mantraType: "other" })).toBe("mantraName")
    expect(validateSubmission({ ...base, mantraType: "other", mantraOther: " a " })).toBe("mantraName")
    expect(validateSubmission({ ...base, mantraType: "other", mantraOther: "Ishvara Pranidhana" })).toBeNull()
  })

  it("no other kind asks for it", () => {
    expect(validateSubmission({ ...base, kind: "bhajan", language: "en", recordingType: "studio", styles: ["indian"] })).not.toBe("mantra")
  })
})

describe("Something else", () => {
  it("keeps the written name next to the type 'other'", () => {
    const made = buildSubmission({ ...base, mantraType: "other", mantraOther: "  Ishvara   Pranidhana " }, 1)
    expect(made.type).toBe("other")
    expect(made.typeOther).toBe("Ishvara Pranidhana")
  })

  it("a name that IS a listed choice becomes it (no second word in the team's queue)", () => {
    expect(listedMantraFor("slokas")).toBe("shlokas")
    expect(listedMantraFor(" Nityam  Shudham ")).toBe("nityam_shuddham")
    expect(listedMantraFor("Pitri Yajna")).toBe("pitriyajina")
    expect(cleanMantra("other_mantra", "other", "guru pooja")).toEqual({ type: "guru_puja", typeOther: null, missing: false, tooShort: false })
    const made = buildSubmission({ ...base, mantraType: "other", mantraOther: "Sloka" }, 1)
    expect(made.type).toBe("shlokas")
    expect(made.typeOther).toBeUndefined()
  })

  it("a listed choice carries no name", () => {
    const made = buildSubmission({ ...base, mantraType: "guru_puja", mantraOther: "leftover" }, 1)
    expect(made.type).toBe("guru_puja")
    expect(made.typeOther).toBeUndefined()
  })
})

describe("a server row of Others", () => {
  const remote = (extra: Partial<RemoteRecording>) => ({ id: "r1", kind: "other_mantra", type: "other", title: "T", author: "A", audio_url: "u", status: "published", by_author: false, added_by: "A", ...extra }) as unknown as RemoteRecording

  it("brings the name for its author, and says when the team accepted it", () => {
    expect(fromRemote(remote({ type_other: "Ishvara Pranidhana" })).typeOther).toBe("Ishvara Pranidhana")
    expect(fromRemote(remote({ type_other: "Ishvara Pranidhana" })).typeOtherChecked).toBeUndefined()
    expect(fromRemote(remote({ type_other: "Ishvara Pranidhana", type_other_checked: true })).typeOtherChecked).toBe(true)
  })

  it("an old row (type 'other' without a name) stays readable", () => {
    const old = fromRemote(remote({}))
    expect(old.type).toBe("other")
    expect(old.typeOther).toBeUndefined()
    expect(kirtanTypeLabel(old.type, "other_mantra")).toBe("Something else")
  })

  it("a name arrives only on type 'other' of the Others kind", () => {
    expect(fromRemote(remote({ kind: "kiirtan", type_other: "x" })).typeOther).toBeUndefined()
    expect(fromRemote(remote({ type: "guru_puja", type_other: "x" })).typeOther).toBeUndefined()
  })
})

describe("what is sent", () => {
  it("type_other goes with type other, and only then", async () => {
    const calls: Array<{ body: Record<string, unknown> }> = []
    const fetcher = (async (_url: string, init: { body: string }) => {
      calls.push({ body: JSON.parse(init.body) })
      return { ok: true, status: 200, json: async () => ({ id: "x" }), text: async () => "" } as unknown as Response
    }) as unknown as typeof fetch
    {
      const cfg = { baseUrl: "http://x", headers: () => ({}), fetch: fetcher }
      const common = { key: "k".repeat(12), kind: "other_mantra" as const, title: "T", author: "A", byAuthor: false, termsVersion: "1" }
      await publishRecording(cfg, { ...common, type: "other", typeOther: "Ishvara Pranidhana" } as never)
      await publishRecording(cfg, { ...common, type: "guru_puja", typeOther: "leftover" } as never)
      expect(calls[0]?.body.type_other).toBe("Ishvara Pranidhana")
      expect(calls[0]?.body.type).toBe("other")
      expect(calls[1]?.body.type_other).toBeUndefined()
      expect(calls[1]?.body.type).toBe("guru_puja")
    }
  })
})

describe("Others on the recording page and in search", () => {
  it("the page shows what it is first, or the name under Something else", async () => {
    const { pageTags } = await import("@/lib/kirtan/pageTags")
    expect(pageTags({ kind: "other_mantra", type: "guru_puja" }).map((x) => x.label)).toEqual(["Guru Puja"])
    expect(pageTags({ kind: "other_mantra", type: "other", typeOther: "Ishvara Pranidhana" }).map((x) => x.label)).toEqual(["Ishvara Pranidhana"])
    // an old row (Something else, no name) and any other kind show nothing of it
    expect(pageTags({ kind: "other_mantra", type: "other" })).toEqual([])
    expect(pageTags({ kind: "kiirtan", type: "bnk" }).some((x) => x.id.startsWith("mantra-"))).toBe(false)
  })

  it("the library counts Others per choice and offers one shelf each from the first recording", async () => {
    const { aggregateRecordings } = await import("@/lib/searchMenu/aggregate")
    const { buildMenu } = await import("@/lib/searchMenu/rules")
    const NOW = Date.UTC(2026, 10, 9)
    const rec = (type: string) => ({ kind: "other_mantra", type, author: "A", createdAt: NOW - 1000 })
    const stats = aggregateRecordings([rec("guru_puja"), rec("guru_puja"), rec("shlokas")], NOW, { psCollections: [] })
    expect(stats.mantraTypes).toEqual({ guru_puja: 2, shlokas: 1 })
    const shelves = buildMenu(stats).shelves.filter((s) => s.block === "others")
    expect(shelves.map((s) => s.id)).toEqual(["mantra:type:guru_puja", "mantra:type:shlokas"])
  })
})
