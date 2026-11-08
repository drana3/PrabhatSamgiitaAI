import { describe, expect, it, vi } from "vitest"

vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { webBaseUrl: "https://example.test" } } } }))

import { ARTIST_FIXTURES } from "@/lib/fixtures/artists"
import { KIRTAN_FIXTURES } from "@/lib/fixtures/kirtan"
import {
  filterByKind,
  isRecordingKind,
  isTypeOfKind,
  kindCountLabel,
  kindLabel,
  kindLabelPlural,
  kindOf,
  listKindOf,
  kindSubtitle,
  kindsCountLabel,
  kindTag,
  normalizeKind,
  typeAfterKindChange,
  typesOfKind,
  withKind,
  withKindWord,
} from "@/lib/kirtan/kind"
import { migrateKirtanState, KIRTAN_STORE_VERSION } from "@/lib/kirtan/migrate"
import { RECORDING_KINDS } from "@/lib/kirtan/types"
import { kirtanSharePayload } from "@/lib/kirtan/share"
import { queryKind, queryWords, searchArtists, searchKirtans } from "@/lib/kirtan/search"
import { addSubmission, buildSubmission, validateSubmission, type SubmissionInput } from "@/lib/kirtan/submissions"
import { bhajansForEveryHour, emptyListText, isShelfChip, kindOfTabChip, newKirtansList, parseKirtanTabChip, typeCardCount, typeCards } from "@/lib/kirtan/tab"
import { SOURCE_ALL_BHAJANS, SOURCE_ALL_KIIRTANS, SOURCE_ALL_RECORDINGS, kiirtanListSourceName } from "@/lib/kirtan/queueBuild"
import { uploadDecisionNotification } from "@/lib/notifications/serverKinds"
import { kirtanRowLabel } from "@/lib/kirtan/list"
import { kiirtanByline, kiirtanToSong, recordingKindOfNumber, recordingKindOfSong, trackLabel, trackTag } from "@/lib/kirtan/track"
import { BHAJAN_TYPES, KIRTAN_TYPES, isKirtanType, kirtanTypeLabel, type Kirtan } from "@/lib/kirtan/types"
import { BHAJAN_OTHER_TONE, kiirtanTone, kindTone } from "@/lib/kirtan/tone"

const approved = KIRTAN_FIXTURES.filter((k) => k.status === "published")
const bhajans = approved.filter((k) => k.kind === "bhajan")
const kiirtans = approved.filter((k) => k.kind === "kiirtan")
const ids = (list: readonly { id: string }[]) => list.map((x) => x.id)

describe("kind helper", () => {
  it("names the two kinds with two i's in Kiirtan", () => {
    expect(kindLabel("kiirtan")).toBe("Kiirtan")
    expect(kindLabel("bhajan")).toBe("Bhajan")
    expect(kindLabelPlural("kiirtan")).toBe("Kiirtans")
    expect(kindLabelPlural("bhajan")).toBe("Bhajans")
    expect(kindTag("bhajan")).toBe("BHAJAN")
    expect(kindTag("kiirtan")).toBe("KIIRTAN")
    expect(kindCountLabel("bhajan", 1)).toBe("1 bhajan")
    expect(kindCountLabel("bhajan", 3)).toBe("3 bhajans")
    expect(kindCountLabel("kiirtan", 0)).toBe("0 kiirtans")
  })

  it("treats anything unknown as a Kiirtan", () => {
    expect(kindLabel(undefined)).toBe("Kiirtan")
    expect(kindLabel(null)).toBe("Kiirtan")
    expect(normalizeKind("bhajan")).toBe("bhajan")
    expect(normalizeKind("zzz")).toBe("kiirtan")
    expect(normalizeKind(undefined)).toBe("kiirtan")
    expect(isRecordingKind("bhajan")).toBe(true)
    expect(isRecordingKind("song")).toBe(false)
    expect(kindOf({})).toBe("kiirtan")
    const old: { id: string; kind?: unknown } = { id: "a" }
    expect(withKind(old).kind).toBe("kiirtan")
    expect(withKind({ ...old, kind: "bhajan" }).kind).toBe("bhajan")
  })

  it("builds the player subtitle, the mini line and the spoken row label", () => {
    expect(kindSubtitle("bhajan", "Priya Devi", "Arun", ARTIST_FIXTURES)).toBe("Bhajan · Priya Devi")
    expect(kindSubtitle("kiirtan", "Priya Devi", "Arun", ARTIST_FIXTURES)).toBe("Kiirtan · Priya Devi")
    expect(kindSubtitle("bhajan", "", "Ananda Marga team", ARTIST_FIXTURES)).toBe("Bhajan · added by Ananda Marga team")
    expect(kindSubtitle("bhajan", "", "", ARTIST_FIXTURES)).toBe("Bhajan")
    expect(withKindWord("Kiirtan · 1:05 of 4:43", "bhajan")).toBe("Bhajan · 1:05 of 4:43")
    expect(withKindWord("Kiirtan · 1:05 of 4:43", "kiirtan")).toBe("Kiirtan · 1:05 of 4:43")
    expect(withKindWord("PS 12 · 1:05", "bhajan")).toBe("PS 12 · 1:05")
    expect(kirtanRowLabel(bhajans[0])).toMatch(/^Bhajan, The sweetest word\. 4:43/)
  })
})

describe("types of each kind", () => {
  it("gives Bhajans morning, evening, devotional, other and Kiirtans their four", () => {
    expect(BHAJAN_TYPES.map((t) => t.id)).toEqual(["morning", "evening", "devotional", "other"])
    expect(typesOfKind("kiirtan")).toBe(KIRTAN_TYPES)
    expect(typesOfKind("bhajan")).toBe(BHAJAN_TYPES)
    expect(isTypeOfKind("bhajan", "morning")).toBe(true)
    expect(isTypeOfKind("kiirtan", "morning")).toBe(false)
    expect(isTypeOfKind("bhajan", "bnk")).toBe(false)
    expect(isTypeOfKind("kiirtan", "other")).toBe(true)
    expect(isTypeOfKind("bhajan", "other")).toBe(true)
    expect(isKirtanType("devotional")).toBe(true)
    expect(kirtanTypeLabel("morning", "bhajan")).toBe("Morning")
    expect(kirtanTypeLabel("other", "bhajan")).toBe("Other")
  })

  it("keeps the type across a kind change only when the new kind has it", () => {
    expect(typeAfterKindChange("bhajan", "bnk")).toBeNull()
    expect(typeAfterKindChange("bhajan", "other")).toBe("other")
    expect(typeAfterKindChange("kiirtan", "morning")).toBeNull()
    expect(typeAfterKindChange("kiirtan", null)).toBeNull()
  })

  it("resolves a tone for every type of both kinds and tells the two Others apart", () => {
    for (const t of [...KIRTAN_TYPES, ...BHAJAN_TYPES]) {
      const tone = kiirtanTone(t.id, t.id === "bnk" || t.id === "lila" || t.id === "festival" ? "kiirtan" : "bhajan")
      expect(tone).toHaveLength(2)
      expect(tone[0]).toMatch(/^#[0-9A-F]{6}$/i)
    }
    expect(kiirtanTone("bnk")).toEqual(kindTone("bnk", "kiirtan"))
    expect(kiirtanTone("morning", "bhajan")).not.toEqual(kiirtanTone("other"))
    expect(kiirtanTone("other", "bhajan")).toEqual(BHAJAN_OTHER_TONE)
    expect(kiirtanTone("other", "kiirtan")).not.toEqual(BHAJAN_OTHER_TONE)
    expect(kiirtanTone(null)).toEqual(kiirtanTone("other"))
  })
})

describe("fixtures", () => {
  it("hold every old Kiirtan as a Kiirtan and the four real sample Bhajans with their lengths", () => {
    expect(KIRTAN_FIXTURES.every((k) => ["kiirtan", "bhajan", "prabhat_samgiita"].includes(k.kind))).toBe(true)
    const real = ["b-sweetest-word", "b-day-will-dawn", "b-once-there-was", "b-many-thousand-years"].map((id) => KIRTAN_FIXTURES.find((k) => k.id === id))
    expect(real.map((k) => k?.title)).toEqual(["The sweetest word", "Soon the day will dawn", "Once there was a day", "Many Thousand Years Ago"])
    expect(real.map((k) => k?.durationSec)).toEqual([282.55, 192.3, 259.72, 592.05])
    for (const k of real) {
      expect(k?.kind).toBe("bhajan")
      expect(k?.author).toBe("")
      expect(k?.addedBy).toBe("Ananda Marga team")
      expect(k?.audioUrl).toBeNull()
    }
    expect(kirtanRowLabel(real[3] as Kirtan)).toMatch(/9:52/)
    expect(new Set(KIRTAN_FIXTURES.map((k) => k.id)).size).toBe(KIRTAN_FIXTURES.length)
    for (const b of bhajans) expect(isTypeOfKind("bhajan", b.type)).toBe(true)
    for (const k of kiirtans) expect(isTypeOfKind("kiirtan", k.type)).toBe(true)
  })

  it("give the morning and devotional Bhajan types something to show", () => {
    const counts = Object.fromEntries(typeCards(approved, "bhajan").map((c) => [c.id, c.count]))
    expect(counts.morning).toBeGreaterThan(0)
    expect(counts.devotional).toBeGreaterThan(0)
  })
})

describe("filtering by kind", () => {
  it("splits the catalog and counts the pieces", () => {
    expect(filterByKind(approved, "all")).toHaveLength(approved.length)
    expect(filterByKind(approved, "bhajan").every((k) => k.kind === "bhajan")).toBe(true)
    expect(filterByKind(approved, "kiirtan").every((k) => k.kind === "kiirtan")).toBe(true)
    expect(RECORDING_KINDS.reduce((n, kind) => n + filterByKind(approved, kind).length, 0)).toBe(approved.length)
    expect(filterByKind(approved, "prabhat_samgiita").every((k) => k.kind === "prabhat_samgiita" && Number.isInteger(k.psSong))).toBe(true)
    expect(filterByKind([{ id: "old" } as Kirtan], "kiirtan")).toHaveLength(1)
    expect(filterByKind([{ id: "old" } as Kirtan], "bhajan")).toHaveLength(0)
    expect(kindsCountLabel(approved)).toBe(RECORDING_KINDS.map((kind) => [kind, filterByKind(approved, kind).length] as const).filter(([, n]) => n > 0).map(([kind, n]) => kindCountLabel(kind, n)).join(" · "))
    expect(kindsCountLabel(bhajans)).toBe(kindCountLabel("bhajan", bhajans.length))
    expect(kindsCountLabel([])).toBe("0 kiirtans")
  })

  it("maps the tab chips to a kind filter", () => {
    expect(kindOfTabChip("all")).toBe("all")
    expect(kindOfTabChip("kiirtan")).toBe("kiirtan")
    expect(kindOfTabChip("bhajan")).toBe("bhajan")
    for (const chip of ["saved", "downloaded", "mine"] as const) {
      expect(kindOfTabChip(chip)).toBe("all")
      expect(isShelfChip(chip)).toBe(false)
    }
    expect(isShelfChip("bhajan")).toBe(true)
    expect(parseKirtanTabChip("bhajan")).toBe("bhajan")
    expect(parseKirtanTabChip(["kiirtan"])).toBe("kiirtan")
  })

  it("narrows the list by kind, type and length together", () => {
    expect(newKirtansList(approved, null, null, "bhajan").every((k) => k.kind === "bhajan")).toBe(true)
    expect(newKirtansList(approved, null, null, "all")).toHaveLength(approved.length)
    expect(newKirtansList(approved, "morning", null, "bhajan").every((k) => k.type === "morning" && k.kind === "bhajan")).toBe(true)
    // "other" exists in both kinds: the kind keeps them apart
    const otherBhajans = newKirtansList(approved, "other", null, "bhajan")
    const otherKiirtans = newKirtansList(approved, "other", null, "kiirtan")
    expect(otherBhajans.length).toBeGreaterThan(0)
    expect(otherKiirtans.length).toBeGreaterThan(0)
    expect(ids(otherBhajans).some((id) => ids(otherKiirtans).includes(id))).toBe(false)
    expect(newKirtansList(approved, null, "short", "bhajan").every((k) => k.kind === "bhajan" && (k.durationSec ?? 0) < 900)).toBe(true)
    expect(newKirtansList(approved, null, "long", "bhajan")).toEqual([])
  })

  it("builds the type cards per kind, or both kinds in order", () => {
    expect(typeCards(approved, "bhajan").map((c) => c.label)).toEqual(["Morning", "Evening", "Devotional", "Other"])
    expect(typeCards(approved, "kiirtan").map((c) => c.label)).toEqual(["Baba Nam Kevalam", "Lila kiirtan", "Festival", "Other"])
    const all = typeCards(approved, "all")
    expect(all).toHaveLength(8)
    expect(all.slice(0, 4).every((c) => c.kind === "kiirtan")).toBe(true)
    expect(all.slice(4).every((c) => c.kind === "bhajan")).toBe(true)
    // only Kiirtan and Bhajan have sub-types; Prabhat Samgiita has no type cards
    expect(all.reduce((n, c) => n + c.count, 0)).toBe(filterByKind(approved, "kiirtan").length + filterByKind(approved, "bhajan").length)
    expect(typeCards(approved, "prabhat_samgiita")).toEqual([])
    expect(typeCardCount({ kind: "bhajan", count: 1 })).toBe("1 bhajan")
    expect(typeCardCount({ kind: "kiirtan", count: 5 })).toBe("5 kiirtans")
  })

  it("orders Bhajans for every hour: morning first, then evening, devotional, other", () => {
    const order = bhajansForEveryHour(approved).map((k) => k.type)
    expect(order[0]).toBe("morning")
    const rank = (t: string) => ["morning", "evening", "devotional", "other"].indexOf(t)
    expect(order.map(rank)).toEqual([...order.map(rank)].sort((a, b) => a - b))
    expect(bhajansForEveryHour(approved).every((k) => k.kind === "bhajan")).toBe(true)
    expect(bhajansForEveryHour(approved, 2)).toHaveLength(2)
  })

  it("says what is empty in the words of the kind", () => {
    expect(emptyListText(null, null, "bhajan")).toBe("No Bhajans yet.")
    expect(emptyListText("morning", null, "bhajan")).toBe("No Bhajans of this type yet.")
    expect(emptyListText(null, "long", "all")).toBe("No recordings of this length yet.")
    expect(emptyListText(null, null)).toBe("No Kiirtans yet.")
  })
})

describe("old stored data (migration v1 to v4)", () => {
  it("gives stored submissions the kind Kiirtan and keeps the rest", () => {
    expect(KIRTAN_STORE_VERSION).toBe(5)
    const old = {
      submissions: [{ id: "sub-a-1", title: "A", author: "X", durationSec: null, type: "bnk", audioUrl: null, thumbnailUrl: null, addedBy: "You", status: "pending", addedAt: 1 }],
      savedIds: ["k-bnk-morning", 7],
      reportedIds: ["k-x"],
    }
    const next = migrateKirtanState(old, 1)
    expect(next.submissions[0]).toMatchObject({ id: "sub-a-1", kind: "kiirtan", type: "bnk", status: "failed" })
    expect(next.savedIds).toEqual(["k-bnk-morning"])
    expect(next.reportedIds).toEqual(["k-x"])
  })

  it("keeps a stored Bhajan and repairs a type that does not fit its kind", () => {
    const mixed = migrateKirtanState({ submissions: [{ id: "b", kind: "bhajan", type: "morning" }, { id: "c", kind: "bhajan", type: "bnk" }, { id: "d", type: "morning" }, null] }, 1)
    expect(mixed.submissions.map((s) => [s.id, s.kind, s.type])).toEqual([
      ["b", "bhajan", "morning"],
      ["c", "bhajan", "other"],
      ["d", "kiirtan", "other"],
    ])
  })

  it("survives empty or odd stored values", () => {
    expect(migrateKirtanState(undefined, 0)).toEqual({ submissions: [], savedIds: [], reportedIds: [], blockedAuthorIds: [], blockedNames: {} })
    expect(migrateKirtanState("junk", 1)).toEqual({ submissions: [], savedIds: [], reportedIds: [], blockedAuthorIds: [], blockedNames: {} })
    expect(migrateKirtanState({ submissions: "no" }, 1).submissions).toEqual([])
  })
})

describe("submissions carry the kind", () => {
  const base: SubmissionInput = { kind: "bhajan", fileName: "dawn.mp3", fileUri: "blob:dawn", title: "Soon the day will dawn", author: "Group", byAuthor: false, addedBy: "Dada", termsAccepted: true }

  it("builds an uploading Bhajan and an uploading Kiirtan", () => {
    const b = buildSubmission(base, 5)
    expect(b).toMatchObject({ kind: "bhajan", type: "other", status: "uploading", id: "sub-soon-the-day-will-dawn-5" })
    const k = buildSubmission({ ...base, kind: "kiirtan" }, 5)
    expect(k.kind).toBe("kiirtan")
    expect(buildSubmission({ ...base, title: "!!!" }, 5).id).toBe("sub-bhajan-5")
    expect(buildSubmission({ ...base, kind: "kiirtan", title: "!!!" }, 5).id).toBe("sub-kiirtan-5")
  })

  it("needs no type: the derived type is valid for both kinds", () => {
    expect(validateSubmission(base)).toBe("language") // a Bhajan names its language
    expect(validateSubmission({ ...base, language: "bn" })).toBeNull()
    expect(validateSubmission({ ...base, kind: "kiirtan" })).toBe("style") // a Kiirtan names its style
    expect(validateSubmission({ ...base, kind: "kiirtan", style: "hindi" })).toBeNull()
    expect(buildSubmission({ ...base, kind: "kiirtan" }, 1).type).toBe("other")
  })

  it("lists a Bhajan in the kind filter once approved, and blocks a duplicate", () => {
    const first = addSubmission([], buildSubmission(base, 1))
    expect(first.added?.kind).toBe("bhajan")
    const again = addSubmission(first.list, buildSubmission(base, 2))
    expect(again.added).toBeNull()
    expect(again.duplicate?.kind).toBe("bhajan")
    expect(filterByKind(first.list, "bhajan")).toHaveLength(1)
    expect(filterByKind(first.list, "kiirtan")).toHaveLength(0)
  })
})

describe("the player track and the queue", () => {
  it("remembers the kind of a recording and tags queue rows", () => {
    const song = kiirtanToSong(bhajans[0])
    expect(recordingKindOfSong(song)).toBe("bhajan")
    expect(recordingKindOfNumber(song.number)).toBe("bhajan")
    expect(trackTag(song.number)).toBe("BHAJAN")
    expect(trackLabel(song.number)).toBe("BHAJAN")
    const k = kiirtanToSong(kiirtans[0])
    expect(recordingKindOfSong(k)).toBe("kiirtan")
    expect(trackTag(k.number)).toBe("KIIRTAN")
    expect(trackTag(12)).toBe("PS")
    expect(trackLabel(12)).toBe("PS 12")
    expect(kiirtanByline("Priya")).toBe("Kiirtan · added by Priya")
    expect(kiirtanByline("Priya", "bhajan")).toBe("Bhajan · added by Priya")
    expect(kiirtanByline("", "bhajan")).toBe("Bhajan")
  })

  it("shares with the word of its kind", () => {
    const b = kirtanSharePayload({ title: "The sweetest word", author: "", kind: "bhajan" })
    expect(b.title).toBe("Bhajan · The sweetest word")
    expect(b.message).toContain("a Bhajan on Prabhat Samgiita")
    const k = kirtanSharePayload({ title: "Morning round", author: "Priya Devi" })
    expect(k.title).toBe("Kiirtan · Morning round")
    expect(k.message).toContain("by Priya Devi, a Kiirtan on Prabhat Samgiita")
  })
})

describe("playing from", () => {
  it("names the source after the kind of the list", () => {
    expect(listKindOf(bhajans)).toBe("bhajan")
    expect(listKindOf(kiirtans)).toBe("kiirtan")
    expect(listKindOf(approved)).toBe("all")
    expect(listKindOf([])).toBe("kiirtan")
    expect(kiirtanListSourceName(null)).toBe(SOURCE_ALL_KIIRTANS)
    expect(kiirtanListSourceName("Lila")).toBe("Lila Kiirtans")
    expect(kiirtanListSourceName(null, "bhajan")).toBe(SOURCE_ALL_BHAJANS)
    expect(kiirtanListSourceName("Morning", "bhajan")).toBe("Morning Bhajans")
    expect(kiirtanListSourceName("all", "all")).toBe(SOURCE_ALL_RECORDINGS)
    expect(SOURCE_ALL_BHAJANS).toBe("All Bhajans")
  })
})

describe("notification copy", () => {
  it("says Bhajan for a Bhajan and Kiirtan otherwise, and gives the reason of a removal", () => {
    const b = uploadDecisionNotification({ uploadId: "u", kind: "bhajan", title: "", decision: "published", firedAt: 1 })
    expect(b.title).toBe("Bhajan published")
    expect(b.text).toBe("Your Bhajan is live in the library.")
    const removed = uploadDecisionNotification({ uploadId: "u", kind: "bhajan", title: "Dawn", decision: "removed", reason: "Not yours to share.", firedAt: 1 })
    expect(removed.title).toBe("Bhajan removed")
    expect(removed.text).toBe("Dawn was removed: Not yours to share.")
    expect(uploadDecisionNotification({ uploadId: "u", title: "Dawn", decision: "published", firedAt: 1 }).title).toBe("Kiirtan published")
  })
})

describe("search by kind", () => {
  it("makes bhajan a searchable word and keeps kiirtan as one", () => {
    expect(queryKind("bhajan")).toBe("bhajan")
    expect(queryKind("Bhajans")).toBe("bhajan")
    expect(queryKind("kiirtan priya")).toBe("kiirtan")
    expect(queryKind("kiirtan bhajan")).toBeNull()
    expect(queryKind("priya")).toBeNull()
    expect(queryWords("bhajan morning")).toEqual(["morning"])
  })

  it("finds only Bhajans for the word bhajan, with or without other words", () => {
    const all = searchKirtans(approved, "bhajan")
    expect(all.length).toBe(bhajans.length)
    expect(all.every((k) => k.kind === "bhajan")).toBe(true)
    expect(ids(searchKirtans(approved, "bhajan morning"))).toEqual(expect.arrayContaining(["b-day-will-dawn", "b-morning-harmonium"]))
    expect(searchKirtans(approved, "bhajan morning").every((k) => k.kind === "bhajan")).toBe(true)
    expect(ids(searchKirtans(approved, "sweetest"))).toEqual(["b-sweetest-word"])
    expect(searchKirtans(approved, "bhajan zzzz")).toEqual([])
  })

  it("matches the author of either kind", () => {
    const priya = searchKirtans(approved, "priya devi")
    expect(priya.some((k) => k.kind === "bhajan")).toBe(true)
    expect(priya.some((k) => k.kind === "kiirtan")).toBe(true)
    expect(searchKirtans(approved, "kiirtan priya").every((k) => k.kind === "kiirtan")).toBe(true)
    expect(searchKirtans(approved, "bhajan priya").map((k) => k.id)).toEqual(["b-morning-harmonium"])
    expect(searchArtists(ARTIST_FIXTURES, approved, "bhajan")).toEqual([])
    expect(searchArtists(ARTIST_FIXTURES, bhajans, "priya")[0]?.count).toBe(1)
  })
})
