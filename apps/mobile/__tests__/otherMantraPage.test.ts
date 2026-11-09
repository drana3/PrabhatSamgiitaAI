import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { NAV_V2_TABS } from "@/lib/navV2"
import { carriesDeepTabBar, policyForPath } from "@/lib/playerPolicy"
import { typesOfKind } from "@/lib/kirtan/kind"
import { buildSubmission, type SubmissionInput } from "@/lib/kirtan/submissions"
import { draftWithPatch } from "@/lib/kirtan/uploadForm"
import type { QueueDraft } from "@/stores/uploadQueueStore"

/** Dada, 9 Nov 2026: Others (it was "Other mantras") have their own upload page and a REQUIRED choice of what they are. */

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

describe("the page of Others", () => {
  it("is one upload form with the Others header and the required choice, not a second copy", () => {
    const page = read("app/add-mantra.tsx")
    expect(page).toMatch(/<AddRecordingForm mantra \/>/)
    expect(page).toMatch(/presentation:\s*"modal"/)
    const form = read("app/add-kirtan.tsx")
    expect(form).toMatch(/export function AddRecordingForm\(\{ mantra = false \}/)
    expect(form).toMatch(/<MantraField /)
    // no kind card of the main form is a mantra, and a mantra page has no playlist entry
    expect(form).toMatch(/RECORDING_KINDS\.filter\(\(k\) => k !== "other_mantra"\)/)
    expect(form).toMatch(/\{mantra \? null : \(\s*<Reveal index=\{1\} style=\{styles\.setStack\}>/)
  })

  it("is on the hub, in the player policy, in the Kiirtan tab and out of the author names", () => {
    expect(read("app/upload.tsx")).toMatch(/upload\.mantra\.title[\s\S]*href\("\/add-mantra"\)/)
    expect(policyForPath("/add-mantra").id).toBe(policyForPath("/add-kirtan").id)
    expect(carriesDeepTabBar("/add-mantra")).toBe(false)
    expect(NAV_V2_TABS.find((tab) => tab.id === "kiirtan")?.owns).toContain("/add-mantra")
    expect(read("lib/authors/demo.ts")).toMatch(/"add-mantra"/)
  })

  it("a removed mantra is corrected on the mantra page, the plus of the mantra tab opens it", () => {
    expect(read("components/kirtan/MyUploads.tsx")).toMatch(/other_mantra" \? "add-mantra" : "add-kirtan"/)
    expect(read("app/kiirtan.tsx")).toMatch(/kind === "other_mantra" \? "\/add-mantra" : "\/add-kirtan"/)
  })
})
