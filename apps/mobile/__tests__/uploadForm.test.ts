import { describe, expect, it } from "vitest"

import { isRecordingKind, kindHasCredits, kindHasLanguage, kindLabel, normalizeKind } from "@/lib/kirtan/kind"
import { buildSubmission } from "@/lib/kirtan/submissions"
import { KIRTAN_TAB_CHIPS } from "@/lib/kirtan/tab"
import { LANGUAGE_KINDS, RECORDING_KINDS } from "@/lib/kirtan/types"
import { draftWithPatch, moreDetailsFor, moreDetailsHintKey } from "@/lib/kirtan/uploadForm"
import type { QueueDraft } from "@/stores/uploadQueueStore"

const EMPTY_DRAFT: QueueDraft = { kind: "kiirtan", performer: "", language: null, languageOther: "", dance: null, credits: "", place: "", discourse: "", year: "", notes: "", psSong: null, styles: [], stylesOther: [], moods: [], moodsOther: [], practice: null, recordingType: null, tempo: null, performance: null, leadInstrument: null, leadInstrumentOther: "", byAuthor: false, mantraType: null, mantraOther: "" }
const FULL: QueueDraft = { ...EMPTY_DRAFT, kind: "bhajan", language: "bn", credits: "Words and music by A. Sen", year: "1998", notes: "n" }

describe("the types of the add form", () => {
  it("are Kiirtan, Bhajan, Prabhat Samgiita, Spiritual song, Dance music, Baba's Audio and Others: Devotional song is gone", () => {
    expect(RECORDING_KINDS).toEqual(["kiirtan", "bhajan", "prabhat_samgiita", "spiritual_song", "dance_song", "baba_audio", "other_mantra"])
    expect(RECORDING_KINDS.map((k) => kindLabel(k))).toEqual(["Kiirtan", "Bhajan", "Prabhat Samgiita", "Spiritual song", "Dance music", "Baba's Discourses", "Others"])
    expect(isRecordingKind("devotional_song")).toBe(false)
    expect(KIRTAN_TAB_CHIPS.some((c) => c.id === ("devotional_song" as string))).toBe(false)
  })

  it("keep old data working: a stored devotional_song reads as a Bhajan", () => {
    expect(normalizeKind("devotional_song")).toBe("bhajan")
    expect(normalizeKind("kiirtan")).toBe("kiirtan")
    expect(normalizeKind("mantra")).toBe("kiirtan")
    expect(kindLabel("devotional_song" as never)).toBe("Bhajan")
  })
})

describe("the language field", () => {
  it("is hidden for a Kiirtan, shown for every other type", () => {
    expect(kindHasLanguage("kiirtan")).toBe(false)
    expect(kindHasLanguage("bhajan")).toBe(true)
    expect(kindHasLanguage("prabhat_samgiita")).toBe(true)
    expect(kindHasLanguage("spiritual_song")).toBe(true)
    expect(kindHasLanguage("dance_song")).toBe(true)
    expect(kindHasLanguage("baba_audio")).toBe(true)
    expect(kindHasLanguage(undefined)).toBe(false) // an unknown kind is a Kiirtan
    expect(moreDetailsFor("kiirtan")).toEqual({ language: false, credits: false, discourse: false, place: true })
    expect(moreDetailsFor("bhajan")).toEqual({ language: false, credits: true, discourse: false, place: true }) // its language is REQUIRED: asked above "More details"
    expect(moreDetailsFor("prabhat_samgiita")).toEqual({ language: true, credits: false, discourse: false, place: true })
    expect(moreDetailsFor("dance_song")).toEqual({ language: true, credits: false, discourse: false, place: true })
    expect(moreDetailsFor("spiritual_song")).toEqual({ language: false, credits: false, discourse: false, place: true })
    expect(moreDetailsFor("baba_audio")).toEqual({ language: false, credits: false, discourse: true, place: true }) // its language is REQUIRED, asked above
  })

  it("is decided by ONE constant (flip it to hide the language for Prabhat Samgiita)", () => {
    expect(LANGUAGE_KINDS).toEqual(["bhajan", "prabhat_samgiita", "spiritual_song", "dance_song", "baba_audio", "other_mantra"])
  })

  it("is cleared when the type changes to one that hides it", () => {
    const toKiirtan = draftWithPatch(FULL, { kind: "kiirtan" })
    expect(toKiirtan.language).toBeNull()
    expect(toKiirtan.credits).toBe("")
    expect(toKiirtan.year).toBe("1998") // year and note are common to every type
    expect(toKiirtan.notes).toBe("n")
    // Bhajan to Prabhat Samgiita keeps the language (both ask for it) and drops the credits
    const toPs = draftWithPatch(FULL, { kind: "prabhat_samgiita" })
    expect(toPs.language).toBe("bn")
    expect(toPs.credits).toBe("")
    // the song number belongs to Prabhat Samgiita only
    const withSong = draftWithPatch(FULL, { kind: "prabhat_samgiita", psSong: { number: 12, title: "x" } })
    expect(withSong.psSong).toEqual({ number: 12, title: "x" })
    expect(draftWithPatch(withSong, { kind: "bhajan" }).psSong).toBeNull()
  })

  it("cannot be set on a Kiirtan at all", () => {
    expect(draftWithPatch(EMPTY_DRAFT, { language: "hi" }).language).toBeNull()
    expect(draftWithPatch({ ...EMPTY_DRAFT, kind: "bhajan" }, { language: "hi" }).language).toBe("hi")
  })

  it("never travels with a Kiirtan submission, and does with a Bhajan one", () => {
    const base = { fileName: "a.mp3", fileUri: "u", title: "T", author: "A", byAuthor: true, addedBy: "You", language: "bn" as const }
    expect(buildSubmission({ ...base, kind: "kiirtan" }, 1).language).toBeUndefined()
    expect(buildSubmission({ ...base, kind: "bhajan" }, 1).language).toBe("bn")
    expect(buildSubmission({ ...base, kind: "prabhat_samgiita", psSong: 3 }, 1).language).toBe("bn")
  })

  it("has a one-line More details hint per type that names only the fields it has", () => {
    expect(moreDetailsHintKey("kiirtan")).toBe("rec.more.hint.kiirtan")
    expect(kindHasCredits("bhajan")).toBe(true)
    expect(kindHasCredits("prabhat_samgiita")).toBe(false)
  })
})
