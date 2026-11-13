import { describe, expect, it } from "vitest"

import { dictionaries } from "@/locales"
import { uploadRoleEn, uploadRoleEs, uploadRoleRu } from "@/locales/uploadRole"
import { effectiveRole, roleAfterKind, roleAuto, roleChoices, rolePatch, roleMissing, ROLE_COMMENT_MAX } from "@/lib/kirtan/uploadRole"
import { validateSubmission, buildSubmission, type SubmissionInput } from "@/lib/kirtan/submissions"
import { draftWithPatch, moreDetailsFor } from "@/lib/kirtan/uploadForm"
import { RECORDING_KINDS } from "@/lib/kirtan/types"
import type { QueueDraft } from "@/stores/uploadQueueStore"

const EMPTY_DRAFT: QueueDraft = { kind: "kiirtan", performer: "", language: null, languageOther: "", dance: null, credits: "", place: "", discourse: "", year: "", notes: "", psSong: null, styles: [], stylesOther: [], moods: [], moodsOther: [], practice: null, recordingType: null, tempo: null, performance: null, leadInstrument: null, leadInstrumentOther: "", byAuthor: false, performs: false, role: null, mantraType: null, mantraOther: "" }

describe("who are you for this recording: the four answers", () => {
  it("a Kiirtan, Bhajan, Spiritual song and Dance music offer all four, in this order", () => {
    for (const kind of ["kiirtan", "bhajan", "spiritual_song", "dance_song"]) expect(roleChoices(kind)).toEqual(["wrote", "performs", "both", "sharing"])
  })

  it("Prabhat Samgiita and Others cannot carry 'I wrote it' (no author tick), so they offer performing or sharing", () => {
    expect(roleChoices("prabhat_samgiita")).toEqual(["performs", "sharing"])
    expect(roleChoices("other_mantra")).toEqual(["performs", "sharing"])
  })

  it("Baba's Audio has one honest answer, sharing, decided for the person", () => {
    expect(roleChoices("baba_audio")).toEqual(["sharing"])
    expect(roleAuto("baba_audio")).toBe("sharing")
    expect(effectiveRole("baba_audio", null)).toBe("sharing")
  })

  it("every kind has at least one answer and is required (nothing answered means missing, unless the kind decides)", () => {
    for (const kind of RECORDING_KINDS) {
      expect(roleChoices(kind).length).toBeGreaterThan(0)
      expect(roleMissing(kind, null)).toBe(kind === "baba_audio" ? false : true)
      expect(roleMissing(kind, "sharing")).toBe(false)
    }
  })

  it("an answer the kind does not offer is dropped", () => {
    expect(effectiveRole("prabhat_samgiita", "wrote")).toBeNull()
    expect(effectiveRole("bhajan", "both")).toBe("both")
  })
})

describe("the answer sets by_author and the performer line", () => {
  it("wrote and both are by_author; performs and sharing are not", () => {
    expect(rolePatch({ performer: "X" }, "wrote", "Priya")).toEqual({ role: "wrote", byAuthor: true, performs: false })
    expect(rolePatch({ performer: "X" }, "both", "Priya")).toEqual({ role: "both", byAuthor: true, performs: true })
    expect(rolePatch({ performer: "X" }, "performs", "Priya")).toEqual({ role: "performs", byAuthor: false, performs: true })
    expect(rolePatch({ performer: "X" }, "sharing", "Priya")).toEqual({ role: "sharing", byAuthor: false, performs: false })
  })

  it("performing puts your name in an empty performer line, never over a typed one, never a guest", () => {
    expect(rolePatch({ performer: "" }, "performs", "Priya Devi")).toMatchObject({ performer: "Priya Devi" })
    expect(rolePatch({ performer: "" }, "both", "Priya Devi")).toMatchObject({ performer: "Priya Devi" })
    expect(rolePatch({ performer: "A Group" }, "performs", "Priya Devi")).not.toHaveProperty("performer")
    expect(rolePatch({ performer: "" }, "performs", "Guest")).not.toHaveProperty("performer")
    expect(rolePatch({ performer: "" }, "wrote", "Priya Devi")).not.toHaveProperty("performer")
    expect(rolePatch({ performer: "" }, "sharing", "Priya Devi")).not.toHaveProperty("performer")
  })

  it("changing the kind keeps an answer the new kind offers and drops the rest, with its flags", () => {
    const both: QueueDraft = { ...EMPTY_DRAFT, kind: "bhajan", role: "both", byAuthor: true, performs: true }
    expect(draftWithPatch(both, { kind: "kiirtan" })).toMatchObject({ role: "both", byAuthor: true, performs: true })
    expect(draftWithPatch(both, { kind: "prabhat_samgiita" })).toMatchObject({ role: null, byAuthor: false, performs: false })
    expect(draftWithPatch(both, { kind: "baba_audio" })).toMatchObject({ role: "sharing", byAuthor: false, performs: false })
    expect(roleAfterKind("bhajan", "wrote")).toEqual({ role: "wrote", byAuthor: true, performs: false })
  })
})

describe("the form cannot be sent without an answer", () => {
  const base: SubmissionInput = { kind: "bhajan", title: "T", author: "A", addedBy: "You", termsAccepted: true, fileName: "a.mp3", fileUri: "file:///a.mp3", fileSize: 1000, fileType: "audio/mpeg", language: "en", askRole: true, recordingType: "studio", performance: "solo" } as SubmissionInput

  it("asks for the answer on every kind that has none decided, and passes once it is given", () => {
    expect(validateSubmission({ ...base, role: null })).toBe("role")
    expect(validateSubmission({ ...base, role: "sharing" })).not.toBe("role")
    expect(validateSubmission({ ...base, kind: "kiirtan", role: undefined })).toBe("role")
  })

  it("Baba's Audio never asks (the kind decides)", () => {
    expect(validateSubmission({ ...base, kind: "baba_audio", role: null })).not.toBe("role")
  })

  it("callers that do not ask (sets, the queue store) are not blocked", () => {
    expect(validateSubmission({ ...base, askRole: undefined, role: null })).not.toBe("role")
  })

  it("the comment travels in credits for every kind, trimmed, and is never cleared with the kind", () => {
    for (const kind of ["kiirtan", "prabhat_samgiita", "baba_audio", "other_mantra"] as const) {
      expect(buildSubmission({ ...base, kind, credits: "  with Anna on flute " }, 1)).toMatchObject({ credits: "with Anna on flute" })
      expect(draftWithPatch({ ...EMPTY_DRAFT, credits: "note" }, { kind })).toMatchObject({ credits: "note" })
    }
    expect(ROLE_COMMENT_MAX).toBe(300)
    expect(moreDetailsFor("bhajan").credits).toBe(false)
  })
})

describe("the words", () => {
  it("ru and es have every key of en, none empty", () => {
    expect(Object.keys(uploadRoleRu).sort()).toEqual(Object.keys(uploadRoleEn).sort())
    expect(Object.keys(uploadRoleEs).sort()).toEqual(Object.keys(uploadRoleEn).sort())
    for (const dict of [uploadRoleEn, uploadRoleRu, uploadRoleEs]) for (const value of Object.values(dict)) expect(value.trim().length).toBeGreaterThan(0)
  })

  it("keep the same {placeholders}", () => {
    const names = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join()
    for (const key of Object.keys(uploadRoleEn) as Array<keyof typeof uploadRoleEn>) {
      expect(names(uploadRoleRu[key])).toBe(names(uploadRoleEn[key]))
      expect(names(uploadRoleEs[key])).toBe(names(uploadRoleEn[key]))
    }
  })

  it("reach the app in every language", () => {
    for (const key of Object.keys(uploadRoleEn)) {
      expect((dictionaries.en as Record<string, string>)[key]).toBe((uploadRoleEn as Record<string, string>)[key])
      expect((dictionaries.ru as Record<string, string>)[key]).toBe((uploadRoleRu as Record<string, string>)[key])
      expect((dictionaries.es as Record<string, string>)[key]).toBe((uploadRoleEs as Record<string, string>)[key])
    }
  })

  it("the four answers carry the words Dada asked for, and the page line tells what the server keeps", () => {
    expect(uploadRoleEn["ux.who.wrote"]).toBe("I wrote it")
    expect(uploadRoleEn["ux.who.performs"]).toBe("I perform / play on it")
    expect(uploadRoleEn["ux.who.both"]).toBe("Both")
    expect(uploadRoleEn["ux.who.sharing"]).toMatch(/only sharing \(someone else’s recording\)/)
    expect(uploadRoleEn["ux.who.sharingHint"]).toMatch(/who did/)
    expect(uploadRoleEn["ux.who.page"]).toMatch(/server keeps only that and your comment/)
  })
})
