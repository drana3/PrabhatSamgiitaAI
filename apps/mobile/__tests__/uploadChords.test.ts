import { describe, expect, it } from "vitest"

import { dictionaries } from "@/locales"
import { uploadExtrasEn, uploadExtrasEs, uploadExtrasRu } from "@/locales/uploadExtras"
import { chordsFormMode, filledList, FORM_INSTRUMENTS, FORM_KEY, FORM_NOTES_KEY, formChordKey, formOffersChords, performsPatch, showsWroteTick } from "@/lib/kirtan/uploadChords"
import { draftWithPatch } from "@/lib/kirtan/uploadForm"
import { RECORDING_KINDS } from "@/lib/kirtan/types"
import type { QueueDraft } from "@/stores/uploadQueueStore"

// the draft is written out here: importing the store would load the native layers this test does not need
const EMPTY_DRAFT: QueueDraft = { kind: "kiirtan", performer: "", language: null, languageOther: "", dance: null, credits: "", place: "", discourse: "", year: "", notes: "", psSong: null, styles: [], stylesOther: [], moods: [], moodsOther: [], practice: null, recordingType: null, tempo: null, performance: null, leadInstrument: null, leadInstrumentOther: "", byAuthor: false, performs: false, mantraType: null, mantraOther: "" }

describe("which kinds show the chords section", () => {
  it("every kind but Dance music and Baba's Audio, always there and never required", () => {
    expect(RECORDING_KINDS.filter((k) => formOffersChords(k))).toEqual(["kiirtan", "bhajan", "prabhat_samgiita", "spiritual_song", "other_mantra"])
    expect(formOffersChords("dance_song")).toBe(false)
    expect(formOffersChords("baba_audio")).toBe(false)
  })

  it("a Kiirtan and a Prabhat Samgiita write the chords as text, a Bhajan and a Spiritual song as words with chords", () => {
    expect(chordsFormMode("kiirtan")).toBe("text")
    expect(chordsFormMode("prabhat_samgiita")).toBe("text")
    expect(chordsFormMode("bhajan")).toBe("chart")
    expect(chordsFormMode("spiritual_song")).toBe("chart")
    expect(chordsFormMode("baba_audio")).toBeNull()
  })

  it("offers Guitar, Harmonium and Piano, each under its own key, and the notes under one more", () => {
    expect(FORM_INSTRUMENTS).toEqual(["guitar", "harmonium", "piano"])
    expect(FORM_INSTRUMENTS.map(formChordKey)).toEqual([`${FORM_KEY}:guitar`, `${FORM_KEY}:harmonium`, `${FORM_KEY}:piano`])
    expect(FORM_NOTES_KEY).toBe(`${FORM_KEY}:notes`)
  })

  it("names what was filled in, in the form's order, notes last", () => {
    const label = (i: string) => i.toUpperCase()
    expect(filledList({ guitar: true, harmonium: false, piano: true }, label, false, "NOTES")).toBe("GUITAR, PIANO")
    expect(filledList({ guitar: false, harmonium: false, piano: false }, label, true, "NOTES")).toBe("NOTES")
    expect(filledList({ guitar: false, harmonium: false, piano: false }, label, false, "NOTES")).toBe("")
  })
})

describe("the two roles", () => {
  it("'I wrote this' is the API's by_author: not for Prabhat Samgiita, Baba's Audio or Others", () => {
    expect(RECORDING_KINDS.filter((k) => showsWroteTick(k))).toEqual(["kiirtan", "bhajan", "spiritual_song", "dance_song"])
  })

  it("the two are independent: switching one never touches the other", () => {
    const both: QueueDraft = { ...EMPTY_DRAFT, kind: "bhajan", byAuthor: true, performs: true }
    expect(draftWithPatch(both, { byAuthor: false })).toMatchObject({ byAuthor: false, performs: true })
    expect(draftWithPatch(both, { performs: false })).toMatchObject({ byAuthor: true, performs: false })
  })

  it("Baba's Audio has no performer, so nobody performs on it; Prabhat Samgiita keeps 'I perform' but never 'I wrote'", () => {
    const both: QueueDraft = { ...EMPTY_DRAFT, kind: "bhajan", byAuthor: true, performs: true }
    expect(draftWithPatch(both, { kind: "baba_audio" })).toMatchObject({ byAuthor: false, performs: false })
    expect(draftWithPatch(both, { kind: "prabhat_samgiita" })).toMatchObject({ byAuthor: false, performs: true })
  })

  it("'I perform' puts the person's own name in an empty performer line, and nothing else", () => {
    expect(performsPatch({ performer: "" }, true, "Priya Devi")).toEqual({ performs: true, performer: "Priya Devi" })
    expect(performsPatch({ performer: "   " }, true, "Priya Devi")).toEqual({ performs: true, performer: "Priya Devi" })
    // a name already typed stays; switching off never clears it; a guest has no name to put in
    expect(performsPatch({ performer: "Some Group" }, true, "Priya Devi")).toEqual({ performs: true })
    expect(performsPatch({ performer: "" }, false, "Priya Devi")).toEqual({ performs: false })
    expect(performsPatch({ performer: "" }, true, "Guest")).toEqual({ performs: true })
    expect(performsPatch({ performer: "" }, true, null)).toEqual({ performs: true })
  })
})

describe("the words of the section", () => {
  it("ru and es have every key of en, no more and no less", () => {
    expect(Object.keys(uploadExtrasRu).sort()).toEqual(Object.keys(uploadExtrasEn).sort())
    expect(Object.keys(uploadExtrasEs).sort()).toEqual(Object.keys(uploadExtrasEn).sort())
    for (const dict of [uploadExtrasEn, uploadExtrasRu, uploadExtrasEs]) for (const value of Object.values(dict)) expect(value.trim().length).toBeGreaterThan(0)
  })

  it("reach the app: every language reads them", () => {
    for (const key of Object.keys(uploadExtrasEn)) {
      expect((dictionaries.en as Record<string, string>)[key]).toBe((uploadExtrasEn as Record<string, string>)[key])
      expect((dictionaries.ru as Record<string, string>)[key]).toBe((uploadExtrasRu as Record<string, string>)[key])
      expect((dictionaries.es as Record<string, string>)[key]).toBe((uploadExtrasEs as Record<string, string>)[key])
    }
  })

  it("keep the same {placeholders} in every language", () => {
    const names = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join()
    for (const key of Object.keys(uploadExtrasEn) as Array<keyof typeof uploadExtrasEn>) {
      expect(names(uploadExtrasRu[key])).toBe(names(uploadExtrasEn[key]))
      expect(names(uploadExtrasEs[key])).toBe(names(uploadExtrasEn[key]))
    }
  })
})
