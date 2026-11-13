import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

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
vi.mock("@/lib/kirtan/formExtras", () => ({ flushFormExtras: vi.fn(), forgetFormExtras: vi.fn() }))
vi.mock("@/stores/recordingChordsPendingStore", () => ({ useRecordingChordsPendingStore: { getState: () => ({ flush: vi.fn(async () => undefined), forget: vi.fn() }) } }))

import { dictionaries } from "@/locales"
import {
  cleanInstrument,
  cleanWord,
  ELECTRONIC_INSTRUMENTS,
  INSTRUMENT_IDS,
  instrumentChoices,
  instrumentLabel,
  isElectronic,
  isInstrumentId,
  kindHasInstrument,
  listedInstrumentFor,
  NEW_WORDS_PER_WEEK,
  normalizedWord,
  OTHER_INSTRUMENT,
  similarInstrument,
  WORD_MAX,
  WORD_MIN,
  wordProblem,
} from "@/lib/kirtan/instruments"
import { cleanStyles, STYLE_OTHER_MAX } from "@/lib/kirtan/styles"
import { draftWithPatch } from "@/lib/kirtan/uploadForm"
import { buildSubmission, validateSubmission, type SubmissionInput } from "@/lib/kirtan/submissions"
import { infoTags, kindHasByAuthor, performanceMissing } from "@/lib/kirtan/recordingInfo"
import { newSetDraft, trackFields, validateSetDetails, type SetTrack } from "@/lib/kirtan/sets"
import { menuTags, shelfTitle } from "@/lib/searchMenu/live"
import { EMPTY_DRAFT } from "@/stores/uploadQueueStore"

const NOW = new Date("2026-11-08T10:00:00Z")

describe("the list of main instruments", () => {
  it("is the same list as the API's", () => {
    const python = readFileSync(join(__dirname, "../../api/app/services/recording_instruments.py"), "utf8")
    const block = /INSTRUMENTS: tuple\[str, \.\.\.\] = \(([\s\S]*?)\)/.exec(python)![1]!
    const apiIds = [...block.matchAll(/"([a-z_]+)"/g)].map((m) => m[1])
    expect([...INSTRUMENT_IDS]).toEqual(apiIds)
    const electronic = /ELECTRONIC: tuple\[str, \.\.\.\] = \(([^)]*)\)/.exec(python)![1]!
    expect([...ELECTRONIC_INSTRUMENTS]).toEqual([...electronic.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]))
  })

  it("has the same length limits and weekly allowance as the API", () => {
    const python = readFileSync(join(__dirname, "../../api/app/services/recording_instruments.py"), "utf8")
    expect(Number(/OTHER_MIN = (\d+)/.exec(python)![1])).toBe(WORD_MIN)
    expect(Number(/OTHER_MAX = (\d+)/.exec(python)![1])).toBe(WORD_MAX)
    const words = readFileSync(join(__dirname, "../../api/app/services/value_suggestions.py"), "utf8")
    expect(Number(/NEW_WORDS_PER_WEEK = (\d+)/.exec(words)![1])).toBe(NEW_WORDS_PER_WEEK)
  })

  it("starts with the three Dada named, and marks the electronic ones", () => {
    expect(INSTRUMENT_IDS.slice(0, 3)).toEqual(["guitar", "harmonium", "piano"])
    expect(ELECTRONIC_INSTRUMENTS).toEqual(["synthesizer", "keyboard"])
    expect(isElectronic("keyboard")).toBe(true)
    expect(isElectronic("piano")).toBe(false)
    expect(instrumentChoices().find((c) => c.id === "synthesizer")!.label).toContain("electronic")
  })

  it("has a label in English, Russian and Spanish for every instrument", () => {
    for (const lang of ["en", "ru", "es"] as const) {
      const dict = dictionaries[lang] as Record<string, string>
      for (const id of INSTRUMENT_IDS) expect(dict[`instrument.${id}`], `${lang} ${id}`).toBeTruthy()
      for (const key of ["instrument.field", "instrument.other", "instrument.addOwn", "instrument.electronicTag", "instrument.otherName", "instrument.didYouMean", "instrument.useListed", "instrument.newNote", "ugc.form.error.instrument", "ugc.form.error.performance", "recinfo.performance.hint", "ugc.add.byAuthorHint"]) {
        expect(dict[key], `${lang} ${key}`).toBeTruthy()
      }
    }
  })

  it("every kind of music has an instrument, Baba's Audio Discourses do not", () => {
    for (const kind of ["kiirtan", "bhajan", "prabhat_samgiita", "spiritual_song", "dance_song"]) expect(kindHasInstrument(kind)).toBe(true)
    expect(kindHasInstrument("baba_audio")).toBe(false)
  })
})

describe("a written word", () => {
  it("is cleaned to one line of 2 to 40 characters", () => {
    expect(cleanWord("  bass   guitar ")).toBe("bass guitar")
    expect(cleanWord("x".repeat(100)).length).toBe(WORD_MAX)
    expect(wordProblem("a")).toBe("short")
    expect(wordProblem(" . ")).toBe("short")
    expect(wordProblem("tar")).toBeNull()
  })

  it("is the same word whatever its case, accents and punctuation", () => {
    expect(normalizedWord(" HÁRMONIUM. ")).toBe("harmonium")
    expect(normalizedWord("Bass-guitar")).toBe("bass guitar")
  })

  it("that is a listed instrument becomes it", () => {
    expect(listedInstrumentFor("Piano")).toBe("piano")
    expect(listedInstrumentFor(" bass  guitar")).toBe("bass_guitar")
    expect(listedInstrumentFor("Mridangam")).toBe("khol")
    expect(listedInstrumentFor("theremin")).toBeNull()
  })

  it("that is almost a listed instrument is offered it, a different one is not", () => {
    expect(similarInstrument("harmonyum")).toBe("harmonium")
    expect(similarInstrument("Sitaar")).toBe("sitar")
    expect(similarInstrument("piano")).toBeNull() // it IS listed: no hint
    expect(similarInstrument("theremin")).toBeNull()
  })
})

describe("what the form sends", () => {
  it("keeps a listed instrument and drops a word it does not need", () => {
    expect(cleanInstrument("kiirtan", "piano", "junk")).toEqual({ instrument: "piano", instrumentOther: null, tooShort: false })
    expect(cleanInstrument("kiirtan", "laser", "")).toEqual({ instrument: null, instrumentOther: null, tooShort: false })
    expect(cleanInstrument("kiirtan", null, "")).toEqual({ instrument: null, instrumentOther: null, tooShort: false })
  })

  it("asks a word of at least two letters for 'Add your own', and turns a listed word into its id", () => {
    expect(cleanInstrument("bhajan", OTHER_INSTRUMENT, " ")).toEqual({ instrument: OTHER_INSTRUMENT, instrumentOther: null, tooShort: true })
    expect(cleanInstrument("bhajan", OTHER_INSTRUMENT, "Theremin")).toEqual({ instrument: OTHER_INSTRUMENT, instrumentOther: "Theremin", tooShort: false })
    expect(cleanInstrument("bhajan", OTHER_INSTRUMENT, "Harmonium")).toEqual({ instrument: "harmonium", instrumentOther: null, tooShort: false })
  })

  it("is dropped for Baba's Audio Discourses", () => {
    expect(cleanInstrument("baba_audio", "piano", "")).toEqual({ instrument: null, instrumentOther: null, tooShort: false })
  })

  it("a style named by hand is 2 to 40 characters, and a listed word is that style", () => {
    expect(STYLE_OTHER_MAX).toBe(40)
    expect(cleanStyles("kiirtan", [], ["x"]).missing).toBe(true)
    expect(cleanStyles("kiirtan", [], ["y".repeat(90)]).stylesOther[0]!.length).toBe(40)
    expect(cleanStyles("kiirtan", [], ["Electronic"])).toEqual({ styles: ["electronic"], stylesOther: [], missing: false })
  })
})

describe("the single form", () => {
  const base: SubmissionInput = { kind: "kiirtan", fileName: "a.mp3", fileUri: "file:///a.mp3", fileSize: 1000, fileType: "audio/mpeg", title: "Baba Nam Kevalam", author: "Priya", addedBy: "You", byAuthor: true, termsAccepted: true, styles: ["indian"], recordingType: "studio", performance: "solo" }

  it("a Kiirtan needs solo or group", () => {
    expect(performanceMissing("kiirtan", null)).toBe(true)
    expect(performanceMissing("bhajan", null)).toBe(false)
    expect(validateSubmission({ ...base, performance: null })).toBe("performance")
    expect(validateSubmission(base)).toBeNull()
  })

  it("'Add your own' with no usable word is refused, and the word travels with the submission", () => {
    expect(validateSubmission({ ...base, leadInstrument: "other", leadInstrumentOther: "x" })).toBe("instrument")
    const built = buildSubmission({ ...base, leadInstrument: "other", leadInstrumentOther: " Theremin " }, 1)
    expect(built).toMatchObject({ leadInstrument: "other", leadInstrumentOther: "Theremin" })
    expect(buildSubmission({ ...base, leadInstrument: "tabla" }, 1)).toMatchObject({ leadInstrument: "tabla" })
    expect(buildSubmission(base, 1)).not.toHaveProperty("leadInstrument")
  })

  it("Prabhat Samgiita has no author tick; every other kind that names a performer has", () => {
    expect(kindHasByAuthor("prabhat_samgiita")).toBe(false)
    expect(kindHasByAuthor("baba_audio")).toBe(false)
    for (const kind of ["kiirtan", "bhajan", "spiritual_song", "dance_song"]) expect(kindHasByAuthor(kind)).toBe(true)
    expect(buildSubmission({ ...base, kind: "prabhat_samgiita", psSong: 12 }, 1).byAuthor).toBe(false)
    expect(buildSubmission(base, 1).byAuthor).toBe(true)
  })

  it("the draft drops the tick and the instrument when the type changes", () => {
    const draft = { ...EMPTY_DRAFT, byAuthor: true, leadInstrument: "piano", leadInstrumentOther: "" }
    expect(draftWithPatch(draft, { kind: "prabhat_samgiita" })).toMatchObject({ byAuthor: false, leadInstrument: null })
    expect(draftWithPatch(draft, { leadInstrument: "other", leadInstrumentOther: "Theremin" })).toMatchObject({ leadInstrument: "other", leadInstrumentOther: "Theremin" })
    expect(draftWithPatch({ ...draft, leadInstrument: "other", leadInstrumentOther: "Theremin" }, { leadInstrument: "tabla" })).toMatchObject({ leadInstrument: "tabla", leadInstrumentOther: "" })
  })
})

describe("the playlist", () => {
  const draft = () => ({ ...newSetDraft("s", NOW), title: "Retreat", defaultStyles: ["indian"], defaultRecordingType: "studio", defaultPerformance: "solo" })
  const track = { id: "t", fileName: "a.mp3", title: "A", size: 1, uri: "file:///a.mp3", type: "audio/mpeg", status: "waiting" } as unknown as SetTrack

  it("needs solo or group for its Kiirtans, and a usable word for 'Add your own'", () => {
    expect(validateSetDetails(draft(), NOW)).toBeNull()
    expect(validateSetDetails({ ...draft(), defaultPerformance: null }, NOW)).toBe("performance")
    expect(validateSetDetails({ ...draft(), defaultLeadInstrument: "other", defaultLeadInstrumentOther: " " }, NOW)).toBe("instrument")
    expect(validateSetDetails({ ...draft(), defaultLeadInstrument: "other", defaultLeadInstrumentOther: "Theremin" }, NOW)).toBeNull()
  })

  it("sends the playlist's instrument and author tick with each track, but no tick for Prabhat Samgiita", () => {
    const d = { ...draft(), defaultLeadInstrument: "harmonium", defaultByAuthor: true }
    expect(trackFields(track, d)).toMatchObject({ kind: "kiirtan", leadInstrument: "harmonium", leadInstrumentOther: null, byAuthor: true, performance: "solo" })
    expect(trackFields(track, { ...d, defaultKind: "prabhat_samgiita" })).toMatchObject({ byAuthor: false, leadInstrument: "harmonium" })
    expect(trackFields(track, { ...d, defaultKind: "baba_audio" })).toMatchObject({ byAuthor: false, leadInstrument: null })
  })
})

describe("what a listener and the search see", () => {
  it("the recording page tags carry the instrument, a written word only as written", () => {
    expect(infoTags({ leadInstrument: "piano" }).map((t) => t.label)).toEqual(["Piano"])
    expect(infoTags({ leadInstrument: "other", leadInstrumentOther: "Theremin" }).map((t) => t.label)).toEqual(["Theremin"])
    expect(infoTags({ leadInstrument: "other" })).toEqual([])
  })

  it("the search menu gets an instrument facet for a listed instrument or an accepted word, not for a word still waiting", () => {
    const k = (over: Record<string, unknown>) => ({ id: "k", kind: "kiirtan", title: "T", author: "A", ...over }) as never
    expect(menuTags(k({ leadInstrument: "piano" }))).toEqual({ instrument: ["piano"] })
    expect(menuTags(k({ leadInstrument: "other", leadInstrumentOther: "Theremin", leadInstrumentChecked: true }))).toEqual({ instrument: ["Theremin"] })
    expect(menuTags(k({ leadInstrument: "other", leadInstrumentOther: "Theremin" }))).toBeNull()
    expect(shelfTitle({ id: "facet:instrument:bass-guitar", label: { type: "named", name: "Bass Guitar" } })).toBe("Bass guitar")
  })

  it("labels an instrument id", () => {
    expect(instrumentLabel("piano")).toBe("Piano")
    expect(instrumentLabel("other", "Theremin")).toBe("Theremin")
    expect(isInstrumentId("piano")).toBe(true)
    expect(isInstrumentId("laser")).toBe(false)
  })
})
