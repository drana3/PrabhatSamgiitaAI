import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { webBaseUrl: "https://example.test" } } } }))

import { cleanLanguageOther, isLanguageCode, LANGUAGES, languageLabel, LANGUAGE_CODES, LANGUAGE_OTHER_MAX, normalizeLanguageCode, OTHER_LANGUAGE, searchLanguages } from "@/lib/kirtan/languages"
import { DANCES, KIND_LANGUAGE_RULE, RECORDING_KINDS } from "@/lib/kirtan/types"
import { filterBySub, hasSubFilters, isSubFilterOn, languagesIn, NO_SUB_FILTER } from "@/lib/kirtan/tab"
import { applyToAll, effectiveFields, incompleteRows, makeQueueItem, missingCounts, rowMissing, setRowFields, type KindDefaults, type QueueItem } from "@/lib/kirtan/queue"
import { isRequiredField, missingKindFields } from "@/lib/kirtan/uploadForm"
import { languagesEn, languagesEs, languagesRu } from "@/locales/recordingLanguages"

const API = join(__dirname, "..", "..", "api", "app")
const apiSource = (file: string) => readFileSync(join(API, file), "utf8")

describe("the language catalog is the same on the phone and on the server", () => {
  const pairs = [...apiSource("services/recording_languages.py").matchAll(/^\s+\("([a-z]{2,3})", "([^"]+)"\),$/gm)].map((m) => [m[1], m[2]])

  it("the server lists the same codes and English names in the same order", () => {
    expect(pairs.length).toBeGreaterThan(40)
    expect(LANGUAGES.map((l) => [l.code, l.english])).toEqual(pairs)
  })

  it("no code is listed twice and 'other' is not a catalog entry", () => {
    expect(new Set(LANGUAGE_CODES).size).toBe(LANGUAGE_CODES.length)
    expect(LANGUAGE_CODES).not.toContain(OTHER_LANGUAGE)
  })

  it("the rule per kind and the dances are the same in the API models", () => {
    const models = apiSource("models/recordings.py")
    expect(DANCES.every((dance) => models.includes(`"${dance}"`))).toBe(true)
    for (const kind of RECORDING_KINDS) {
      const rule = KIND_LANGUAGE_RULE[kind]
      expect(apiSource("services/recording_languages.py") + models, kind).toContain(`"${kind}": "${rule}"`)
    }
  })

  it("every language has a label in English, Russian and Spanish", () => {
    const books = { en: languagesEn, ru: languagesRu, es: languagesEs } as Record<string, Record<string, string>>
    for (const [name, book] of Object.entries(books)) {
      for (const code of [...LANGUAGE_CODES, OTHER_LANGUAGE]) {
        expect(book[`lang.${code}`]?.trim(), `${name} ${code}`).toBeTruthy()
      }
      expect(Object.keys(book).sort()).toEqual([...LANGUAGE_CODES, OTHER_LANGUAGE].map((code) => `lang.${code}`).sort())
    }
  })
})

describe("language codes", () => {
  it("reads codes, English names, old words and 'other'; refuses the rest", () => {
    expect(normalizeLanguageCode("bn")).toBe("bn")
    expect(normalizeLanguageCode(" Bengali ")).toBe("bn")
    expect(normalizeLanguageCode("hindi")).toBe("hi")
    expect(normalizeLanguageCode("OTHER")).toBe("other")
    expect(normalizeLanguageCode("Klingon")).toBeNull()
    expect(normalizeLanguageCode(7)).toBeNull()
    expect(isLanguageCode("other")).toBe(false)
  })

  it("the free name of 'other' is one line cut to 80 characters; empty is nothing", () => {
    expect(cleanLanguageOther("  Santali \n dialect ")).toBe("Santali dialect")
    expect(cleanLanguageOther("x".repeat(200))).toHaveLength(LANGUAGE_OTHER_MAX)
    expect(cleanLanguageOther("   ")).toBeNull()
    expect(cleanLanguageOther(undefined)).toBeNull()
  })

  it("the picker finds a language by code, English name or label, prefix first", () => {
    const label = (code: string) => (code === "bn" ? "Bangla" : code)
    expect(searchLanguages("", label)).toHaveLength(LANGUAGES.length)
    expect(searchLanguages("bang", label).map((c) => c.code)[0]).toBe("bn")
    expect(searchLanguages("BENGALI", label).map((c) => c.code)).toContain("bn")
    expect(searchLanguages("zzzzzz", label)).toEqual([])
  })

  it("'other' shows the person's own name for it", () => {
    expect(languageLabel("other", "Santali")).toBe("Santali")
    expect(languageLabel(null)).toBe("")
  })
})

describe("what each kind needs", () => {
  it("Kiirtan nothing; Prabhat Samgiita nothing; Bhajan and Spiritual song a language; Dance music a dance", () => {
    expect(missingKindFields({ kind: "kiirtan", language: null, dance: null })).toEqual([])
    expect(missingKindFields({ kind: "bhajan", language: null, dance: null })).toEqual(["language"])
    expect(missingKindFields({ kind: "bhajan", language: "bn", dance: null })).toEqual([])
    expect(missingKindFields({ kind: "prabhat_samgiita", language: null, dance: null })).toEqual([])
    expect(missingKindFields({ kind: "spiritual_song", language: null, dance: null })).toEqual(["language"])
    expect(missingKindFields({ kind: "dance_song", language: null, dance: null })).toEqual(["dance"])
    expect(missingKindFields({ kind: "dance_song", language: "en", dance: "kaoshiki" })).toEqual([])
  })

  it("'Other' without its name is missing the name, for every kind that has a language", () => {
    expect(missingKindFields({ kind: "bhajan", language: "other", languageOther: " ", dance: null })).toEqual(["languageName"])
    expect(missingKindFields({ kind: "spiritual_song", language: "other", languageOther: "Santali", dance: null })).toEqual([])
    expect(missingKindFields({ kind: "kiirtan", language: "other", languageOther: "", dance: null })).toEqual([])
  })

  it("marks the required fields", () => {
    expect(isRequiredField("spiritual_song", "language")).toBe(true)
    expect(isRequiredField("bhajan", "language")).toBe(true)
    expect(isRequiredField("prabhat_samgiita", "language")).toBe(false)
    expect(isRequiredField("dance_song", "language")).toBe(false)
    expect(isRequiredField("kiirtan", "language")).toBe(false)
    expect(isRequiredField("dance_song", "dance")).toBe(true)
    expect(isRequiredField("spiritual_song", "dance")).toBe(false)
  })
})

describe("the queue: per-row validation and 'Apply to all rows'", () => {
  const row = (id: string, patch: Partial<QueueItem> = {}): QueueItem => ({ ...makeQueueItem({ name: `${id}.mp3`, uri: `file:///${id}.mp3`, size: 10, type: "audio/mpeg" }, id), ...patch })
  const spiritual: KindDefaults = { kind: "spiritual_song", language: null, languageOther: "", dance: null }
  const dance: KindDefaults = { kind: "dance_song", language: null, languageOther: "", dance: null }

  it("a row inherits the form's choice unless it has its own", () => {
    const rows = [row("a"), row("b", { language: "bn" })]
    const defaults = { ...spiritual, language: "hi" }
    expect(effectiveFields(rows[0]!, defaults).language).toBe("hi")
    expect(effectiveFields(rows[1]!, defaults).language).toBe("bn")
    // null on a row means "none", not "inherit"
    expect(effectiveFields(row("c", { language: null }), defaults).language).toBeNull()
  })

  it("lists the waiting rows that still miss something, and how many miss which field", () => {
    const rows = [row("a"), row("b", { language: "hi" }), row("c", { language: "other", languageOther: "" }), row("d", { status: "done" })]
    expect(incompleteRows(rows, spiritual)).toEqual([
      { id: "a", missing: ["language"] },
      { id: "c", missing: ["languageName"] },
    ])
    expect(missingCounts(rows, spiritual)).toEqual({ language: 2, dance: 0, rows: 2 })
  })

  it("Dance music miss their dance per row", () => {
    const rows = [row("a"), row("b", { dance: "tandava" })]
    expect(rowMissing(rows[0]!, dance)).toEqual(["dance"])
    expect(rowMissing(rows[1]!, dance)).toEqual([])
    expect(missingCounts(rows, dance)).toEqual({ language: 0, dance: 1, rows: 1 })
  })

  it("choosing a language other than 'other' forgets the typed name; a row that is going or done is not changed", () => {
    const rows = [row("a", { language: "other", languageOther: "Santali" }), row("b", { status: "uploading" }), row("c", { status: "done" })]
    expect(setRowFields(rows, "a", { language: "bn" })[0]).toMatchObject({ language: "bn", languageOther: undefined })
    expect(setRowFields(rows, "b", { language: "bn" })[1]!.language).toBeUndefined()
    expect(setRowFields(rows, "c", { dance: "tandava" })[2]!.dance).toBeUndefined()
  })

  it("apply to all gives every sendable row the choice, overwriting its own; done, going and library rows keep theirs", () => {
    const rows = [row("a", { dance: "kaoshiki" }), row("b"), row("c", { status: "done" }), row("d", { status: "uploading" }), row("e", { status: "duplicate" })]
    const out = applyToAll(rows, { dance: "tandava" })
    expect(out.map((r) => r.dance)).toEqual(["tandava", "tandava", undefined, undefined, undefined])
    expect(missingCounts(out, dance).rows).toBe(0)
  })

  it("apply to all for a language clears per-row names and fixes every row's missing language", () => {
    const rows = [row("a", { language: "other", languageOther: "" }), row("b")]
    const out = applyToAll(rows, { language: "hi" })
    expect(incompleteRows(out, spiritual)).toEqual([])
    expect(out.map((r) => r.language)).toEqual(["hi", "hi"])
  })
})

describe("filters of the Kiirtan screens", () => {
  const list = [
    { dance: "tandava" as const, language: "en" },
    { dance: "kaoshiki" as const, language: "bn" },
    { dance: undefined, language: "bn" },
    { dance: undefined, language: undefined },
  ]

  it("only Spiritual song, Dance music and Baba's Audio have sub-filters", () => {
    expect(RECORDING_KINDS.filter((kind) => hasSubFilters(kind))).toEqual(["spiritual_song", "dance_song", "baba_audio"])
    expect(hasSubFilters("all")).toBe(false)
  })

  it("filters by dance, by language, by both; no filter keeps all", () => {
    expect(isSubFilterOn(NO_SUB_FILTER)).toBe(false)
    expect(filterBySub(list, NO_SUB_FILTER)).toHaveLength(4)
    expect(filterBySub(list, { dance: "tandava", language: null })).toHaveLength(1)
    expect(filterBySub(list, { dance: null, language: "bn" })).toHaveLength(2)
    expect(filterBySub(list, { dance: "kaoshiki", language: "bn" })).toHaveLength(1)
    expect(filterBySub(list, { dance: "tandava", language: "bn" })).toEqual([])
  })

  it("lists only the languages that occur, in catalog order, with 'other' last", () => {
    expect(languagesIn([{ language: "other" }, { language: "en" }, { language: "bn" }, { language: undefined }])).toEqual(["bn", "en", "other"])
    expect(languagesIn([])).toEqual([])
  })
})
