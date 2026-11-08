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

import { hasNonLatinLetters, cleanRecordingInfo, infoTags, isAiRecording, kindAllowsAi, kindHasPerformance, kindHasTempo, kindRequiresRecordingType, PERFORMANCES, RECORDING_TYPES, recordingTypeMissing, recordingTypesFor, TEMPO_IDS, titleNeedsEnglish } from "@/lib/kirtan/recordingInfo"
import { menuTags, shelfTitle } from "@/lib/searchMenu/live"
import { fromRemote } from "@/lib/kirtan/submissions"
import type { RemoteRecording } from "@/lib/kirtan/remote"
import { buildSubmission, validateSubmission, type SubmissionInput } from "@/lib/kirtan/submissions"
import { draftWithPatch } from "@/lib/kirtan/uploadForm"
import { EMPTY_DRAFT, useUploadQueueStore } from "@/stores/uploadQueueStore"

const base: SubmissionInput = { kind: "kiirtan", fileName: "a.mp3", fileUri: "file:///a.mp3", fileSize: 1000, fileType: "audio/mpeg", title: "Baba Nam Kevalam", author: "Priya", addedBy: "You", byAuthor: false, termsAccepted: true, style: "bengali" }
const queue = () => useUploadQueueStore.getState()
const pick = (...names: string[]) => queue().addFiles(names.map((name) => ({ name, uri: `blob:${name}`, size: 1000, type: "audio/mpeg" })))

describe("the lists (the same ids as the API and as anandamarga.org/music)", () => {
  it("has the four types of recording, three tempos and solo or group", () => {
    expect([...RECORDING_TYPES]).toEqual(["studio", "live", "home", "ai"])
    expect([...TEMPO_IDS]).toEqual(["slow", "medium", "fast"])
    expect([...PERFORMANCES]).toEqual(["solo", "group"])
  })

  it("asks for the type of recording on a Kiirtan only; AI is not offered for a Bhajan", () => {
    expect(kindRequiresRecordingType("kiirtan")).toBe(true)
    expect(kindRequiresRecordingType("bhajan")).toBe(false)
    expect(kindAllowsAi("bhajan")).toBe(false)
    expect(recordingTypesFor("kiirtan")).toEqual(["studio", "live", "home", "ai"])
    expect(recordingTypesFor("bhajan")).toEqual(["studio", "live", "home"])
    expect(kindHasTempo("bhajan")).toBe(false)
    expect(kindHasPerformance("dance_song")).toBe(false)
  })
})

describe("cleaning", () => {
  it("keeps what the kind carries and drops the rest", () => {
    expect(cleanRecordingInfo("kiirtan", { recordingType: "live", tempo: "fast", performance: "group" })).toEqual({ recordingType: "live", tempo: "fast", performance: "group" })
    expect(cleanRecordingInfo("bhajan", { recordingType: "studio", tempo: "fast", performance: "solo" })).toEqual({ recordingType: "studio", tempo: null, performance: "solo" })
    expect(cleanRecordingInfo("baba_audio", { recordingType: "studio", tempo: "slow", performance: "solo" })).toEqual({ recordingType: null, tempo: null, performance: null })
  })

  it("drops AI from a Bhajan and any word that is not in the list", () => {
    expect(cleanRecordingInfo("bhajan", { recordingType: "ai" }).recordingType).toBeNull()
    expect(cleanRecordingInfo("kiirtan", { recordingType: "robot", tempo: "turbo" })).toEqual({ recordingType: null, tempo: null, performance: null })
  })

  it("says what is missing: the type of a Kiirtan", () => {
    expect(recordingTypeMissing("kiirtan", null)).toBe(true)
    expect(recordingTypeMissing("kiirtan", "home")).toBe(false)
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
    expect(validateSubmission({ ...base, style: undefined })).toBe("style")
    expect(validateSubmission(base)).toBe("recordingType")
    expect(validateSubmission({ ...base, recordingType: "studio" })).toBeNull()
  })

  it("refuses a Kiirtan title that is not in English, and not a Bhajan's", () => {
    expect(validateSubmission({ ...base, recordingType: "studio", title: "Баба Нам" })).toBe("titleEnglish")
    expect(validateSubmission({ ...base, kind: "bhajan", language: "ru", title: "Баба Нам" })).toBeNull()
  })

  it("keeps the three values on the upload, the Kiirtan's only", () => {
    expect(buildSubmission({ ...base, recordingType: "ai", tempo: "slow", performance: "group" }, 1)).toMatchObject({ recordingType: "ai", tempo: "slow", performance: "group" })
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
    const draft = { ...EMPTY_DRAFT, performer: "Priya", style: "bengali", practice: "avarta", recordingType: "ai", tempo: "slow", performance: "group" }
    const next = draftWithPatch(draft, { kind: "bhajan" })
    expect(next).toMatchObject({ kind: "bhajan", performer: "Priya", style: null, practice: null, recordingType: null, tempo: null, performance: null })
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
    queue().setDraft({ style: "bengali", recordingType: "studio", practice: "avarta" })
    queue().setDraft({ kind: "bhajan" })
    expect(queue().items.map((item) => item.fileName)).toEqual(["a.mp3", "b.mp3"])
    expect(queue().items[0]).not.toHaveProperty("practice")
    expect(queue().items[0]).not.toHaveProperty("recordingType")
    expect(queue().draft).toMatchObject({ kind: "bhajan", style: null, practice: null, recordingType: null })
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
    const k = { ...buildSubmission({ ...base, recordingType: "ai", tempo: "slow", performance: "group" }, 1), tags: { occasion: ["retreat"] } }
    expect(menuTags(k)).toEqual({ occasion: ["retreat"], recorded: ["ai"], tempo: ["slow"], performance: ["group"] })
    expect(menuTags(buildSubmission(base, 1))).toBeNull()
  })

  it("titles those shelves with translated words, AI as 'Made by AI'", () => {
    expect(shelfTitle({ id: "facet:recorded:ai", label: { type: "named", name: "Ai" } })).toBe("Made by AI")
    expect(shelfTitle({ id: "facet:tempo:fast", label: { type: "named", name: "Fast" } })).toBe("Fast")
    expect(shelfTitle({ id: "facet:occasion:retreat", label: { type: "named", name: "Retreat" } })).toBe("Retreat")
  })

  it("reads the three fields from the server's recording", () => {
    const remote = { id: "r1", title: "T", author: "A", kind: "kiirtan", type: "bnk", status: "published", recording_type: "live", tempo: "fast", performance: "solo" } as unknown as RemoteRecording
    expect(fromRemote(remote)).toMatchObject({ recordingType: "live", tempo: "fast", performance: "solo" })
    expect(fromRemote({ ...remote, recording_type: null, tempo: null, performance: null } as unknown as RemoteRecording)).not.toHaveProperty("recordingType")
  })
})
