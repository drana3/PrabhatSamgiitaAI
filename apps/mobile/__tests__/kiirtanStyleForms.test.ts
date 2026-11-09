import { describe, expect, it } from "vitest"

import { buildSubmission, validateSubmission, type SubmissionInput } from "@/lib/kirtan/submissions"
import { newSetDraft } from "@/lib/kirtan/sets"
import { draftWithPatch } from "@/lib/kirtan/uploadForm"
import type { QueueDraft } from "@/stores/uploadQueueStore"

const EMPTY_DRAFT: QueueDraft = { kind: "kiirtan", performer: "", language: null, languageOther: "", dance: null, credits: "", place: "", discourse: "", year: "", notes: "", psSong: null, styles: [], stylesOther: [], moods: [], moodsOther: [], practice: null, recordingType: null, tempo: null, performance: null, leadInstrument: null, leadInstrumentOther: "", byAuthor: false, mantraType: null }
const base: SubmissionInput = { kind: "kiirtan", fileName: "a.mp3", fileUri: "file:///a.mp3", fileSize: 1000, fileType: "audio/mpeg", title: "Baba Nam Kevalam", author: "Priya", addedBy: "You", byAuthor: false, termsAccepted: true }
const sound = { recordingType: "studio", performance: "solo" } as const

describe("the styles and moods in the upload forms", () => {
  it("a Kiirtan keeps its listed styles in the order chosen, once each", () => {
    expect(buildSubmission({ ...base, styles: ["electronic", "indian", "electronic"] }, 1)).toMatchObject({ styles: ["electronic", "indian"], style: "electronic" })
  })

  it("own words keep their tidy form; the first one is also written the old way", () => {
    expect(buildSubmission({ ...base, stylesOther: ["  Manipuri   style ", "x"] }, 1)).toMatchObject({ stylesOther: ["Manipuri style"], style: "other", styleOther: "Manipuri style" })
    const bare = buildSubmission({ ...base, stylesOther: ["  "] }, 1)
    expect(bare.styles).toBeUndefined()
    expect(bare.stylesOther).toBeUndefined()
    expect(bare.style).toBeUndefined()
  })

  it("the single style of the first form still reads as a list of one", () => {
    expect(buildSubmission({ ...base, style: "indian" }, 1)).toMatchObject({ styles: ["indian"], style: "indian" })
    // an old id is read, never sent again
    expect(buildSubmission({ ...base, style: "folk" }, 1).styles).toBeUndefined()
    expect(validateSubmission({ ...base, style: "other", styleOther: "Baul", ...sound })).toBeNull()
  })

  it("Baba's Audio carries no style and no mood; the other kinds keep both", () => {
    expect(buildSubmission({ ...base, kind: "baba_audio", language: "en", styles: ["indian"], moods: ["joyful"] }, 1).styles).toBeUndefined()
    expect(buildSubmission({ ...base, kind: "baba_audio", language: "en", styles: ["indian"], moods: ["joyful"] }, 1).moods).toBeUndefined()
    for (const kind of ["bhajan", "prabhat_samgiita", "spiritual_song", "dance_song"] as const) {
      expect(buildSubmission({ ...base, kind, language: "en", dance: "tandava", psSong: 5, styles: ["indian"], moods: ["mix"] }, 1)).toMatchObject({ styles: ["indian"], moods: ["mix"] })
    }
  })

  it("moods are optional, several, and the five only (an old word is not sent again)", () => {
    expect(buildSubmission({ ...base, moods: ["mix", "calm", "joyful"], moodsOther: ["Deep peace"] }, 1)).toMatchObject({ moods: ["mix", "joyful"], moodsOther: ["Deep peace"] })
    expect(validateSubmission({ ...base, styles: ["indian"], ...sound })).toBeNull()
  })

  it("a Kiirtan without a style is refused: the field is required", () => {
    expect(validateSubmission(base)).toBe("style")
    expect(validateSubmission({ ...base, stylesOther: [" "] })).toBe("style")
    expect(validateSubmission({ ...base, stylesOther: ["Manipuri"], ...sound })).toBeNull()
    expect(validateSubmission({ ...base, styles: ["western"], ...sound })).toBeNull()
  })

  it("the other types are never required to have a style", () => {
    expect(validateSubmission({ ...base, kind: "bhajan", language: "en" })).toBeNull()
    expect(validateSubmission({ ...base, kind: "dance_song", dance: "tandava" })).toBeNull()
  })

  it("changing the type of the form to one without styles drops them; the others keep what was chosen", () => {
    const chosen = { ...EMPTY_DRAFT, styles: ["indian"], stylesOther: ["Baul"], moods: ["mix"], moodsOther: ["Deep peace"] }
    expect(draftWithPatch(chosen, { kind: "bhajan" })).toMatchObject({ styles: ["indian"], stylesOther: ["Baul"], moods: ["mix"] })
    expect(draftWithPatch(chosen, { kind: "baba_audio" })).toMatchObject({ styles: [], stylesOther: [], moods: [], moodsOther: [] })
    expect(draftWithPatch(chosen, { place: "x" }).styles).toEqual(["indian"])
  })

  it("a new playlist has no style and no mood", () => {
    const draft = newSetDraft("s1")
    expect(draft.defaultStyles).toEqual([])
    expect(draft.defaultStylesOther).toEqual([])
    expect(draft.defaultMoods).toEqual([])
    expect(draft.defaultMoodsOther).toEqual([])
  })
})
