import { describe, expect, it } from "vitest"

import { buildSubmission, validateSubmission, type SubmissionInput } from "@/lib/kirtan/submissions"
import { newSetDraft } from "@/lib/kirtan/sets"
import { draftWithPatch } from "@/lib/kirtan/uploadForm"
import type { QueueDraft } from "@/stores/uploadQueueStore"

const EMPTY_DRAFT: QueueDraft = { kind: "kiirtan", performer: "", language: null, languageOther: "", dance: null, credits: "", place: "", discourse: "", year: "", notes: "", psSong: null, style: null, styleOther: "", practice: null, recordingType: null, tempo: null, performance: null, byAuthor: false }
const base: SubmissionInput = { kind: "kiirtan", fileName: "a.mp3", fileUri: "file:///a.mp3", fileSize: 1000, fileType: "audio/mpeg", title: "Baba Nam Kevalam", author: "Priya", addedBy: "You", byAuthor: false, termsAccepted: true }

describe("the optional Kiirtan style in the upload forms", () => {
  it("a Kiirtan keeps a listed style", () => {
    expect(buildSubmission({ ...base, style: "bengali" }, 1)).toMatchObject({ style: "bengali" })
  })

  it("'other' keeps its tidy name; 'other' without a name keeps nothing", () => {
    expect(buildSubmission({ ...base, style: "other", styleOther: "  Manipuri   style " }, 1)).toMatchObject({ style: "other", styleOther: "Manipuri style" })
    const bare = buildSubmission({ ...base, style: "other", styleOther: "  " }, 1)
    expect(bare.style).toBeUndefined()
    expect(bare.styleOther).toBeUndefined()
  })

  it("the other types never carry a style", () => {
    for (const kind of ["bhajan", "prabhat_samgiita", "spiritual_song", "dance_song", "baba_audio"] as const) {
      expect(buildSubmission({ ...base, kind, language: "en", dance: "tandava", psSong: 5, style: "bengali" }, 1).style).toBeUndefined()
    }
  })

  it("a Kiirtan without a style is refused: the field is required", () => {
    expect(validateSubmission(base)).toBe("style")
    expect(validateSubmission({ ...base, style: "other", styleOther: " " })).toBe("style")
    expect(validateSubmission({ ...base, style: "other", styleOther: "Manipuri", recordingType: "studio" })).toBeNull()
    expect(validateSubmission({ ...base, style: "folk", recordingType: "studio" })).toBeNull()
  })

  it("the other types are never asked for a style", () => {
    expect(validateSubmission({ ...base, kind: "bhajan", language: "en" })).toBeNull()
    expect(validateSubmission({ ...base, kind: "dance_song", dance: "tandava" })).toBeNull()
  })

  it("changing the type of the form drops the style", () => {
    const withStyle = { ...EMPTY_DRAFT, style: "hindi", styleOther: "" }
    expect(draftWithPatch(withStyle, { kind: "bhajan" }).style).toBeNull()
    expect(draftWithPatch(withStyle, { place: "x" }).style).toBe("hindi")
  })

  it("a new playlist has no style", () => {
    const draft = newSetDraft("s1")
    expect(draft.defaultStyle).toBeNull()
    expect(draft.defaultStyleOther).toBe("")
  })
})
