import { describe, expect, it } from "vitest"

import { isRecordingKind, kindHasCredits, kindHasLanguage, kindLabel, normalizeKind } from "@/lib/kirtan/kind"
import { buildSubmission } from "@/lib/kirtan/submissions"
import { KIRTAN_TAB_CHIPS } from "@/lib/kirtan/tab"
import { LANGUAGE_KINDS, RECORDING_KINDS } from "@/lib/kirtan/types"
import { draftWithPatch, moreDetailsFor, moreDetailsHintKey } from "@/lib/kirtan/uploadForm"
import type { QueueDraft } from "@/stores/uploadQueueStore"

const EMPTY_DRAFT: QueueDraft = { kind: "kiirtan", performer: "", language: null, credits: "", year: "", notes: "", psSong: null, byAuthor: false }
const FULL: QueueDraft = { ...EMPTY_DRAFT, kind: "bhajan", language: "bengali", credits: "Words and music by A. Sen", year: "1998", notes: "n" }

describe("the types of the add form", () => {
  it("are Kiirtan, Bhajan and Prabhat Samgiita: Devotional song is gone", () => {
    expect(RECORDING_KINDS).toEqual(["kiirtan", "bhajan", "prabhat_samgiita"])
    expect(RECORDING_KINDS.map((k) => kindLabel(k))).toEqual(["Kiirtan", "Bhajan", "Prabhat Samgiita"])
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
  it("is hidden for a Kiirtan, shown for a Bhajan and for a Prabhat Samgiita recording", () => {
    expect(kindHasLanguage("kiirtan")).toBe(false)
    expect(kindHasLanguage("bhajan")).toBe(true)
    expect(kindHasLanguage("prabhat_samgiita")).toBe(true)
    expect(kindHasLanguage(undefined)).toBe(false) // an unknown kind is a Kiirtan
    expect(moreDetailsFor("kiirtan")).toEqual({ language: false, credits: false })
    expect(moreDetailsFor("bhajan")).toEqual({ language: true, credits: true })
    expect(moreDetailsFor("prabhat_samgiita")).toEqual({ language: true, credits: false })
  })

  it("is decided by ONE constant (flip it to hide the language for Prabhat Samgiita)", () => {
    expect(LANGUAGE_KINDS).toEqual(["bhajan", "prabhat_samgiita"])
  })

  it("is cleared when the type changes to one that hides it", () => {
    const toKiirtan = draftWithPatch(FULL, { kind: "kiirtan" })
    expect(toKiirtan.language).toBeNull()
    expect(toKiirtan.credits).toBe("")
    expect(toKiirtan.year).toBe("1998") // year and note are common to every type
    expect(toKiirtan.notes).toBe("n")
    // Bhajan to Prabhat Samgiita keeps the language (both ask for it) and drops the credits
    const toPs = draftWithPatch(FULL, { kind: "prabhat_samgiita" })
    expect(toPs.language).toBe("bengali")
    expect(toPs.credits).toBe("")
    // the song number belongs to Prabhat Samgiita only
    const withSong = draftWithPatch(FULL, { kind: "prabhat_samgiita", psSong: { number: 12, title: "x" } })
    expect(withSong.psSong).toEqual({ number: 12, title: "x" })
    expect(draftWithPatch(withSong, { kind: "bhajan" }).psSong).toBeNull()
  })

  it("cannot be set on a Kiirtan at all", () => {
    expect(draftWithPatch(EMPTY_DRAFT, { language: "hindi" }).language).toBeNull()
    expect(draftWithPatch({ ...EMPTY_DRAFT, kind: "bhajan" }, { language: "hindi" }).language).toBe("hindi")
  })

  it("never travels with a Kiirtan submission, and does with a Bhajan one", () => {
    const base = { fileName: "a.mp3", fileUri: "u", title: "T", author: "A", byAuthor: true, addedBy: "You", language: "bengali" as const }
    expect(buildSubmission({ ...base, kind: "kiirtan" }, 1).language).toBeUndefined()
    expect(buildSubmission({ ...base, kind: "bhajan" }, 1).language).toBe("bengali")
    expect(buildSubmission({ ...base, kind: "prabhat_samgiita", psSong: 3 }, 1).language).toBe("bengali")
  })

  it("has a one-line More details hint per type that names only the fields it has", () => {
    expect(moreDetailsHintKey("kiirtan")).toBe("rec.more.hint.kiirtan")
    expect(kindHasCredits("bhajan")).toBe(true)
    expect(kindHasCredits("prabhat_samgiita")).toBe(false)
  })
})
