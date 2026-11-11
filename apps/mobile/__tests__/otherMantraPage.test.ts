import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { NAV_V2_TABS } from "@/lib/navV2"
import { carriesDeepTabBar, policyForPath } from "@/lib/playerPolicy"
import { typesOfKind } from "@/lib/kirtan/kind"
import { buildSubmission, type SubmissionInput } from "@/lib/kirtan/submissions"
import { addRecordingHref } from "@/lib/kirtan/hub"
import { draftWithPatch } from "@/lib/kirtan/uploadForm"
import { ugcEn } from "@/locales/ugc"
import type { QueueDraft } from "@/stores/uploadQueueStore"

/** Dada, 9 Nov 2026: Others (it was "Other mantras") carry a REQUIRED choice of what they are. 12 Nov 2026: they are a type of Add Recording, not a page. */

const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8")
const base: SubmissionInput = { kind: "other_mantra", fileName: "a.mp3", fileUri: "file:///a.mp3", fileSize: 1000, fileType: "audio/mpeg", title: "Guru Puja", author: "Priya", addedBy: "You", byAuthor: false, termsAccepted: true }
const EMPTY = { kind: "other_mantra", mantraType: null, mantraOther: "" } as unknown as QueueDraft

describe("the type of a recording of Others", () => {
  it("offers the six names and Something else, in this order", () => {
    expect(typesOfKind("other_mantra").map((t) => t.id)).toEqual(["guru_puja", "pitriyajina", "samgacchadhvam", "nityam_shuddham", "ananda_sutram", "shlokas", "other"])
  })

  it("is the one the person chose; a word that is not a mantra type is not taken", () => {
    expect(buildSubmission({ ...base, mantraType: "pitriyajina" }, 1).type).toBe("pitriyajina")
    expect(buildSubmission({ ...base, mantraType: "shlokas" }, 1).type).toBe("shlokas")
    expect(buildSubmission({ ...base, mantraType: "bnk" }, 1).type).toBe("other")
  })

  it("never changes the type of any other kind", () => {
    expect(buildSubmission({ ...base, kind: "kiirtan", mantraType: "guru_puja" }, 1).type).toBe("other")
  })

  it("goes when the kind is no longer Others, and the name goes when the choice is not Something else", () => {
    const chosen = draftWithPatch({ ...EMPTY, mantraType: "guru_puja" }, {})
    expect(chosen.mantraType).toBe("guru_puja")
    expect(draftWithPatch(chosen, { kind: "bhajan" }).mantraType).toBeNull()
    const named = draftWithPatch(EMPTY, { mantraType: "other", mantraOther: "Ishvara Pranidhana" })
    expect(named.mantraOther).toBe("Ishvara Pranidhana")
    expect(draftWithPatch(named, { mantraType: "guru_puja" }).mantraOther).toBe("")
  })
})

describe("Others inside Add Recording", () => {
  it("is one more type of the one upload form: the choice of what it is appears under the type, not a second page", () => {
    const form = read("app/add-kirtan.tsx")
    expect(form).toMatch(/export function AddRecordingForm\(\)/)
    expect(form).not.toMatch(/mantra = false|<AddRecordingForm mantra/)
    expect(form).toMatch(/kinds=\{RECORDING_KINDS\}/)
    expect(form).toMatch(/\{kind === "other_mantra" \? \(\s*<Reveal index=\{2\} style=\{styles\.field\}>\s*<View \{\.\.\.form\.field\("mantra"\)\}/)
    expect(form).toMatch(/<MantraField /)
    // the playlist of an event steps aside on Others; the playlist's own kind list still has no Others
    expect(form).toMatch(/\{kind === "other_mantra" \? null : \(\s*<Reveal index=\{1\} style=\{styles\.setStack\}>/)
    expect(read("components/kirtan/add/KindField.tsx")).toMatch(/RECORDING_KINDS\.filter\(\(k\) => k !== "other_mantra"\)/)
  })

  it("has no door of its own on the Upload hub; the old address opens the form on Others", () => {
    expect(read("app/upload.tsx")).not.toMatch(/add-mantra|upload\.mantra/)
    const old = read("app/add-mantra.tsx")
    expect(old).toContain("<Redirect")
    expect(old).toContain("/add-kirtan?kind=other_mantra")
    expect(read("app/add-kirtan.tsx")).toMatch(/if \(params\.kind\) patch\.kind = normalizeKind\(params\.kind\)/)
  })

  it("the title of the form is Add Recording, in three languages, and the kind is no longer in it", () => {
    const form = read("app/add-kirtan.tsx")
    expect(form).toContain('t("ugc.add.heading2")')
    expect(form).not.toMatch(/\{kindLabel\(kind\)\}/)
    expect(ugcEn["ugc.add.heading"] + " " + ugcEn["ugc.add.heading2"]).toBe("Add Recording")
  })

  it("is still routed like the form: player policy, Kiirtan tab, out of the author names", () => {
    expect(policyForPath("/add-mantra").id).toBe(policyForPath("/add-kirtan").id)
    expect(carriesDeepTabBar("/add-mantra")).toBe(false)
    expect(NAV_V2_TABS.find((tab) => tab.id === "kiirtan")?.owns).toContain("/add-mantra")
    expect(read("lib/authors/demo.ts")).toMatch(/"add-mantra"/)
  })

  it("the plus of the Others tab and a corrected upload of a mantra open the one form on Others", () => {
    expect(addRecordingHref("other_mantra")).toBe("/add-kirtan?kind=other_mantra")
    expect(addRecordingHref("bhajan")).toBe("/add-kirtan")
    expect(addRecordingHref("all")).toBe("/add-kirtan")
    expect(read("app/kiirtan.tsx")).toContain("addRecordingHref(kind)")
    expect(read("app/kiirtan-list.tsx")).toContain("addRecordingHref(kind)")
    expect(read("components/kirtan/MyUploads.tsx")).toContain("href(`/add-kirtan?kind=${k.kind}")
  })
})

describe("the Type row of the form", () => {
  it("is one line: the word on the left, the chosen value and a chevron on the right, the whole row one target of 56 pt", () => {
    const field = read("components/kirtan/add/ChoiceField.tsx")
    expect(field).toMatch(/line: \{ minHeight: 56, [^}]*flexDirection: "row", alignItems: "center", justifyContent: "space-between"/)
    expect(field).toMatch(/lineEnd: \{[^}]*justifyContent: "flex-end"/)
    expect(read("components/kirtan/add/KindField.tsx")).toContain("row={row}")
    expect(read("app/add-kirtan.tsx")).toMatch(/<KindField[\s\S]*?\brow\b[\s\S]*?testID="kind-field"/)
  })
})
