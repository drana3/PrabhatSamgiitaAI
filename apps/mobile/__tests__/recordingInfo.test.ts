import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>()
  return {
    default: {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: async (key: string) => {
        memory.delete(key)
      },
    },
  }
})
vi.mock("@/lib/kirtan/uploadRunner", () => ({ runUpload: vi.fn(), cancelSimilar: vi.fn(async () => undefined) }))
vi.mock("@/stores/recordingChordsPendingStore", () => ({ useRecordingChordsPendingStore: { getState: () => ({ flush: vi.fn(async () => undefined), forget: vi.fn() }) } }))

import { hasNonLatinLetters, cleanRecordingInfo, infoTags, isAiRecording, kindAllowsAi, kindHasPerformance, kindHasTempo, kindRequiresRecordingType, PERFORMANCES, RECORDING_TYPES, normalizeRecordingType, recordingTypeMissing, recordingTypesFor, TEMPO_IDS, titleNeedsEnglish } from "@/lib/kirtan/recordingInfo"
import { menuTags, shelfTitle } from "@/lib/searchMenu/live"
import { fromRemote } from "@/lib/kirtan/submissions"
import type { RemoteRecording } from "@/lib/kirtan/remote"
import { buildSubmission, validateSubmission, type SubmissionInput } from "@/lib/kirtan/submissions"
import { draftWithPatch } from "@/lib/kirtan/uploadForm"
import { EMPTY_DRAFT, useUploadQueueStore } from "@/stores/uploadQueueStore"

const base: SubmissionInput = { kind: "kiirtan", fileName: "a.mp3", fileUri: "file:///a.mp3", fileSize: 1000, fileType: "audio/mpeg", title: "Baba Nam Kevalam", author: "Priya", addedBy: "You", byAuthor: false, termsAccepted: true, styles: ["indian"] }
const queue = () => useUploadQueueStore.getState()
const pick = (...names: string[]) => queue().addFiles(names.map((name) => ({ name, uri: `blob:${name}`, size: 1000, type: "audio/mpeg" })))

describe("the lists (the same ids as the API and as anandamarga.org/music)", () => {
  it("has exactly three types of recording, four tempos (Dance music only) and solo or group", () => {
    expect([...RECORDING_TYPES]).toEqual(["studio", "live", "ai"])
    expect([...TEMPO_IDS]).toEqual(["slow", "medium", "fast", "mix"])
    expect([...PERFORMANCES]).toEqual(["solo", "group"])
  })

  it("asks for the type of recording on a Kiirtan only; AI is offered for every kind that carries the type, a Bhajan too", () => {
    expect(kindRequiresRecordingType("kiirtan")).toBe(true)
    expect(kindRequiresRecordingType("bhajan")).toBe(false)
    expect(kindAllowsAi("bhajan")).toBe(true)
    expect(kindAllowsAi("baba_audio")).toBe(false)
    expect(recordingTypesFor("kiirtan")).toEqual(["studio", "live", "ai"])
    expect(recordingTypesFor("bhajan")).toEqual(["studio", "live", "ai"])
    expect(recordingTypesFor("baba_audio")).toEqual(["studio", "live"])
    expect(kindHasTempo("bhajan")).toBe(false)
    expect(kindHasTempo("kiirtan")).toBe(false)
    expect(kindHasTempo("dance_song")).toBe(true)
    expect(kindHasPerformance("dance_song")).toBe(false)
  })
})

describe("cleaning", () => {
  it("keeps what the kind carries and drops the rest", () => {
    // the tempo is for Dance music only: a Kiirtan that still carries one drops it
    expect(cleanRecordingInfo("kiirtan", { recordingType: "live", tempo: "fast", performance: "group" })).toEqual({ recordingType: "live", tempo: null, performance: "group" })
    expect(cleanRecordingInfo("dance_song", { recordingType: "studio", tempo: "mix", performance: "solo" })).toEqual({ recordingType: "studio", tempo: "mix", performance: null })
    expect(cleanRecordingInfo("bhajan", { recordingType: "studio", tempo: "fast", performance: "solo" })).toEqual({ recordingType: "studio", tempo: null, performance: "solo" })
    expect(cleanRecordingInfo("baba_audio", { recordingType: "studio", tempo: "slow", performance: "solo" })).toEqual({ recordingType: null, tempo: null, performance: null })
  })

  it("keeps AI on a Bhajan, drops it where the kind has no type, and drops any word that is not in the list", () => {
    expect(cleanRecordingInfo("bhajan", { recordingType: "ai" }).recordingType).toBe("ai")
    expect(cleanRecordingInfo("baba_audio", { recordingType: "ai" }).recordingType).toBeNull()
    expect(cleanRecordingInfo("kiirtan", { recordingType: "robot", tempo: "turbo" })).toEqual({ recordingType: null, tempo: null, performance: null })
  })

  it("says what is missing: the type of a Kiirtan", () => {
    expect(recordingTypeMissing("kiirtan", null)).toBe(true)
    expect(recordingTypeMissing("kiirtan", "home")).toBe(false) // the removed "home" reads as studio
    expect(normalizeRecordingType("home")).toBe("studio")
    expect(normalizeRecordingType("robot")).toBeNull()
    expect(recordingTypeMissing("bhajan", null)).toBe(false)
  })
})

describe("the title of a Kiirtan is in English", () => {
  it("lets Latin letters, accents, digits and punctuation pass", () => {
    expect(hasNonLatinLetters("Baba Nam Kevalam")).toBe(false)
    expect(hasNonLatinLetters("Bábá’s Śiva-Sańkiirtan 2")).toBe(false)
  })

  it("marks Cyrillic, Devanagari, Bengali and Arabic letters", () => {
    expect(hasNonLatinLetters("Баба Нам Кевалам")).toBe(true)
    expect(hasNonLatinLetters("बाबा नाम केवलम्")).toBe(true)
    expect(hasNonLatinLetters("বাবা নাম")).toBe(true)
    expect(hasNonLatinLetters("بابا")).toBe(true)
    expect(hasNonLatinLetters("Baba Нам")).toBe(true)
  })

  it("applies to a Kiirtan only", () => {
    expect(titleNeedsEnglish("kiirtan", "Баба Нам")).toBe(true)
    expect(titleNeedsEnglish("bhajan", "Баба Нам")).toBe(false)
    expect(titleNeedsEnglish("baba_audio", "बाबा")).toBe(false)
  })
})

describe("the submission", () => {
  it("refuses a Kiirtan without a type of recording, after the style", () => {
    expect(validateSubmission({ ...base, styles: undefined })).toBe("style")
    expect(validateSubmission(base)).toBe("recordingType")
    expect(validateSubmission({ ...base, recordingType: "studio" })).toBe("performance") // solo or group is required too
    expect(validateSubmission({ ...base, recordingType: "studio", performance: "solo" })).toBeNull()
    expect(validateSubmission({ ...base, kind: "bhajan", language: "en", recordingType: "ai" })).toBeNull() // an AI Bhajan is allowed
  })

  it("refuses a Kiirtan title that is not in English, and not a Bhajan's", () => {
    expect(validateSubmission({ ...base, recordingType: "studio", performance: "solo", title: "Баба Нам" })).toBe("titleEnglish")
    expect(validateSubmission({ ...base, kind: "bhajan", language: "ru", title: "Баба Нам" })).toBeNull()
  })

  it("keeps the three values on the upload, the Kiirtan's only", () => {
    const kiirtan = buildSubmission({ ...base, recordingType: "ai", tempo: "slow", performance: "group" }, 1)
    expect(kiirtan).toMatchObject({ recordingType: "ai", performance: "group" })
    expect(kiirtan.tempo).toBeUndefined() // the tempo is for Dance music only
    expect(buildSubmission({ ...base, kind: "dance_song", dance: "tandava", recordingType: "live", tempo: "mix" }, 1)).toMatchObject({ recordingType: "live", tempo: "mix" })
    const bhajan = buildSubmission({ ...base, kind: "bhajan", language: "hi", recordingType: "studio", tempo: "slow", performance: "solo" }, 1)
    expect(bhajan.recordingType).toBe("studio")
    expect(bhajan.tempo).toBeUndefined()
    expect(bhajan.performance).toBe("solo")
  })

  it("shows the tags in order and marks AI", () => {
    const tags = infoTags({ recordingType: "ai", tempo: "fast", performance: "solo" })
    expect(tags.map((tag) => tag.id)).toEqual(["type-ai", "tempo-fast", "performance-solo"])
    expect(tags[0]!.ai).toBe(true)
    expect(isAiRecording({ recordingType: "ai" })).toBe(true)
    expect(isAiRecording({ recordingType: "studio" })).toBe(false)
  })
})

describe("changing the type of recording on the form (nothing of the old type leaks)", () => {
  it("clears the old type's fields and keeps the common ones", () => {
    const draft = { ...EMPTY_DRAFT, performer: "Priya", styles: ["indian"], practice: "avarta", recordingType: "ai", tempo: "slow", performance: "group" }
    const next = draftWithPatch(draft, { kind: "bhajan" })
    // the styles stay (a Bhajan may have them); what only a Kiirtan or a dance carries goes, and the type of recording is asked again
    expect(next).toMatchObject({ kind: "bhajan", performer: "Priya", styles: ["indian"], practice: null, recordingType: null, tempo: null, performance: null })
  })
})

describe("the queue when the type changes", () => {
  beforeEach(() => {
    queue().reset()
  })

  it("keeps the files, clears what the rows said about the old type", () => {
    pick("a.mp3", "b.mp3")
    const [first] = queue().items
    queue().setRowFields(first!.id, { practice: "avarta", recordingType: "live" })
    queue().setDraft({ styles: ["indian"], recordingType: "studio", practice: "avarta" })
    queue().setDraft({ kind: "bhajan" })
    expect(queue().items.map((item) => item.fileName)).toEqual(["a.mp3", "b.mp3"])
    expect(queue().items[0]).not.toHaveProperty("practice")
    expect(queue().items[0]).not.toHaveProperty("recordingType")
    expect(queue().draft).toMatchObject({ kind: "bhajan", styles: ["indian"], practice: null })
  })

  it("spells Kiirtan with two i's as the person types a title, the performer or the place", () => {
    pick("a.mp3")
    queue().setTitle(queue().items[0]!.id, "my kirtan 2")
    expect(queue().items[0]!.title).toBe("my Kiirtan 2")
    queue().setDraft({ performer: "kirtan group", place: "Kirtan hall", notes: "kirtan note" })
    expect(queue().draft).toMatchObject({ performer: "Kiirtan group", place: "Kiirtan hall", notes: "kirtan note" })
  })

  it("does not touch the rows when the same type is chosen again", () => {
    pick("a.mp3")
    queue().setRowFields(queue().items[0]!.id, { recordingType: "live" })
    queue().setDraft({ kind: "kiirtan", performer: "Priya" })
    expect(queue().items[0]!.recordingType).toBe("live")
  })

  it("opening the screen drops files left from an earlier visit that were never sent", () => {
    pick("old.mp3")
    queue().setDraft({ kind: "bhajan", performer: "Someone" })
    queue().openFresh()
    expect(queue().items).toEqual([])
    expect(queue().draft).toEqual(EMPTY_DRAFT)
  })

  it("opening the screen keeps a queue that has work in it", () => {
    pick("sent.mp3", "waiting.mp3")
    queue().remove(queue().items[1]!.id)
    useUploadQueueStore.setState({ items: queue().items.map((item) => ({ ...item, status: "failed" as const })) })
    queue().openFresh()
    expect(queue().items).toHaveLength(1)
  })
})

describe("search data", () => {
  it("maps the three fields into tags, and nothing when a recording has none", () => {
    const k = { ...buildSubmission({ ...base, recordingType: "ai", performance: "group" }, 1), tags: { occasion: ["retreat"] } }
    expect(menuTags(k)).toEqual({ occasion: ["retreat"], recorded: ["ai"], performance: ["group"] })
    const dance = { ...buildSubmission({ ...base, kind: "dance_song", dance: "tandava", recordingType: "live", tempo: "slow" }, 1), tags: { occasion: ["retreat"] } }
    expect(menuTags(dance)).toEqual({ occasion: ["retreat"], recorded: ["live"], tempo: ["slow"] })
    expect(menuTags(buildSubmission(base, 1))).toBeNull()
  })

  it("titles those shelves with translated words, AI as 'AI-generated'", () => {
    expect(shelfTitle({ id: "facet:recorded:ai", label: { type: "named", name: "Ai" } })).toBe("AI-generated")
    expect(shelfTitle({ id: "facet:recorded:live", label: { type: "named", name: "Live" } })).toBe("Live recording (concert)")
    expect(shelfTitle({ id: "facet:tempo:mix", label: { type: "named", name: "Mix" } })).toBe("Mix")
    expect(shelfTitle({ id: "facet:tempo:fast", label: { type: "named", name: "Fast" } })).toBe("Fast")
    expect(shelfTitle({ id: "facet:occasion:retreat", label: { type: "named", name: "Retreat" } })).toBe("Retreat")
  })

  it("reads the three fields from the server's recording", () => {
    const remote = { id: "r1", title: "T", author: "A", kind: "kiirtan", type: "bnk", status: "published", recording_type: "live", tempo: "fast", performance: "solo" } as unknown as RemoteRecording
    const read = fromRemote(remote)
    expect(read).toMatchObject({ recordingType: "live", performance: "solo" })
    expect(read).not.toHaveProperty("tempo") // an older row's Kiirtan tempo is kept on the server and not shown
    expect(fromRemote({ ...remote, kind: "dance_song", dance: "tandava", type: "other" } as unknown as RemoteRecording)).toMatchObject({ tempo: "fast" })
    // the removed "home" reads as a studio recording
    expect(fromRemote({ ...remote, recording_type: "home" } as unknown as RemoteRecording)).toMatchObject({ recordingType: "studio" })
    expect(fromRemote({ ...remote, recording_type: null, tempo: null, performance: null } as unknown as RemoteRecording)).not.toHaveProperty("recordingType")
  })
})
