import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { webBaseUrl: "https://example.test" } } } }))

import { setActiveLanguage, t } from "@/lib/i18n"
import { kindCountLabel, kindHasDiscourse, kindHasPerformer, kindLabel, kindLanguageRule, kindRequiresLanguage, kindTag } from "@/lib/kirtan/kind"
import { publishRecording, type RemoteConfig, type RemoteRecording } from "@/lib/kirtan/remote"
import { buildSubmission, fromRemote, validateSubmission } from "@/lib/kirtan/submissions"
import { KIRTAN_TAB_CHIPS, hasSubFilters, kindOfTabChip } from "@/lib/kirtan/tab"
import { kiirtanTone } from "@/lib/kirtan/tone"
import { BABA_AUTHOR, DISCOURSE_KINDS, KIND_LANGUAGE_RULE, RECORDING_KINDS } from "@/lib/kirtan/types"
import { draftWithPatch, missingKindFields, moreDetailsFor } from "@/lib/kirtan/uploadForm"
import { kiirtanListSourceName } from "@/lib/kirtan/queueBuild"

/** Baba's Discourses (`baba_audio`): language required, no performer, optional place and discourse name or number. */

const base = { kind: "baba_audio" as const, fileName: "talk.mp3", fileUri: "blob:x", title: "Neohumanism", author: "", byAuthor: true, addedBy: "You", termsAccepted: true }

describe("Baba's Discourses on the phone", () => {
  it("is a kind of its own, with its language REQUIRED and no performer", () => {
    expect(RECORDING_KINDS).toContain("baba_audio")
    expect(KIND_LANGUAGE_RULE.baba_audio).toBe("required")
    expect(kindLanguageRule("baba_audio")).toBe("required")
    expect(kindRequiresLanguage("baba_audio")).toBe(true)
    expect(DISCOURSE_KINDS).toEqual(["baba_audio"])
    expect(kindHasDiscourse("baba_audio")).toBe(true)
    expect(kindHasPerformer("baba_audio")).toBe(false)
    for (const kind of RECORDING_KINDS.filter((k) => k !== "baba_audio")) {
      expect(kindHasPerformer(kind)).toBe(true)
      expect(kindHasDiscourse(kind)).toBe(false)
    }
    expect(BABA_AUTHOR).toBe("Shrii Shrii Anandamurti")
  })

  it("has the same words as Dada wrote in every language", () => {
    setActiveLanguage("en")
    expect(kindLabel("baba_audio")).toBe("Baba's Discourses")
    expect(kindCountLabel("baba_audio", 1)).toBe("1 audio discourse")
    expect(kindCountLabel("baba_audio", 3)).toBe("3 audio discourses")
    setActiveLanguage("ru")
    expect(kindLabel("baba_audio")).toBe("Беседы Бабы")
    expect(kindCountLabel("baba_audio", 2)).toBe("2 аудиобеседы")
    expect(kindCountLabel("baba_audio", 5)).toBe("5 аудиобесед")
    expect(kindTag("baba_audio")).not.toMatch(/[A-Za-z]/)
    setActiveLanguage("es")
    expect(kindLabel("baba_audio")).toBe("Discursos de Baba")
    setActiveLanguage("en")
  })

  it("is a chip of the library, with the language sub-filter and a tone of its own", () => {
    expect(KIRTAN_TAB_CHIPS.map((c) => c.id)).toContain("baba_audio")
    expect(kindOfTabChip("baba_audio")).toBe("baba_audio")
    expect(hasSubFilters("baba_audio")).toBe(true)
    expect(kiirtanTone("other", "baba_audio")).not.toEqual(kiirtanTone("other", "spiritual_song"))
    expect(kiirtanListSourceName(null, "baba_audio")).toBe("All Baba's Discourses")
  })

  it("needs a title and a language, never a performer", () => {
    expect(validateSubmission({ ...base, language: null })).toBe("language")
    expect(validateSubmission({ ...base, language: "en" })).toBeNull()
    expect(validateSubmission({ ...base, title: " ", language: "en" })).toBe("title")
    expect(validateSubmission({ ...base, language: "other", languageOther: "" })).toBe("languageName")
    // the other kinds still need their performer
    expect(validateSubmission({ ...base, kind: "spiritual_song", language: "en" })).toBe("author")
    expect(missingKindFields({ kind: "baba_audio", language: null, dance: null })).toEqual(["language"])
  })

  it("keeps Baba as the speaker and the tidied place and discourse; a dance or song number never", () => {
    const k = buildSubmission({ ...base, language: "ru", place: "  Ranchi  ", discourse: " Discourse   12 ", dance: "tandava", psSong: 5, credits: "x" }, 1)
    expect(k).toMatchObject({ kind: "baba_audio", author: BABA_AUTHOR, byAuthor: false, language: "ru", place: "Ranchi", discourse: "Discourse 12" })
    expect(k).not.toHaveProperty("dance")
    expect(k).not.toHaveProperty("psSong")
    const bare = buildSubmission({ ...base, language: "en" }, 2)
    expect(bare).not.toHaveProperty("place")
    expect(bare).not.toHaveProperty("discourse")
    // every kind keeps the place (Dada, 9 Nov 2026); only Baba's Audio keeps the discourse name
    const bhajan = buildSubmission({ ...base, kind: "bhajan", author: "A", language: "en", place: "Ranchi", discourse: "1" }, 3)
    expect(bhajan).toMatchObject({ place: "Ranchi" })
    expect(bhajan).not.toHaveProperty("discourse")
  })

  it("clears the discourse when the kind changes away, and keeps the place (every kind has one)", () => {
    const draft: Parameters<typeof draftWithPatch>[0] = { kind: "baba_audio", language: "en", languageOther: "", dance: null, credits: "", place: "Ranchi", discourse: "12", psSong: null }
    expect(draftWithPatch(draft, {})).toMatchObject({ place: "Ranchi", discourse: "12" })
    expect(draftWithPatch(draft, { kind: "bhajan" })).toMatchObject({ place: "Ranchi", discourse: "" })
    expect(moreDetailsFor("baba_audio")).toEqual({ language: false, credits: false, discourse: true, place: true })
  })

  it("sends the place for every kind and the discourse for this kind only, and reads them back", async () => {
    const calls: { body: Record<string, unknown> }[] = []
    const rec = { id: "r1", kind: "baba_audio", type: "other", title: "T", author: BABA_AUTHOR, added_by: "A", author_id: null, by_author: false, status: "published", duration_sec: null, plays: 0, audio_url: "u", thumbnail_url: null, published_at: null, created_at: "2026-01-01T00:00:00Z" } as RemoteRecording
    const fake = (async (_url: string, init?: RequestInit) => {
      calls.push({ body: JSON.parse(String(init?.body)) })
      return new Response(JSON.stringify(rec), { status: 200, headers: { "content-type": "application/json" } })
    }) as unknown as typeof fetch
    const cfg: RemoteConfig = { baseUrl: "https://api.test/", headers: () => ({}), fetch: fake }
    const common = { key: "k", type: "other", title: "T", author: "", byAuthor: false, termsVersion: "v", confirmDifferent: false, language: "en", place: " Ranchi ", discourse: " 12 " }
    await publishRecording(cfg, { ...common, kind: "baba_audio" })
    expect(calls[0]!.body).toMatchObject({ kind: "baba_audio", language: "en", place: "Ranchi", discourse: "12" })
    await publishRecording(cfg, { ...common, kind: "bhajan" })
    expect(calls[1]!.body).toMatchObject({ place: "Ranchi" })
    expect(calls[1]!.body).not.toHaveProperty("discourse")
    expect(fromRemote({ ...rec, place: "Ranchi", discourse: "12", language: "en" })).toMatchObject({ kind: "baba_audio", place: "Ranchi", discourse: "12" })
    expect(fromRemote(rec)).not.toHaveProperty("place")
  })

  it("shows the same words in the three languages for every key the kind needs", () => {
    const source = readFileSync(join(__dirname, "..", "locales", "recordings.ts"), "utf8")
    const keys = ["kind.baba_audio", "kind.baba_audios", "kind.baba_audio.tag", "kt.head.baba_audio", "kt.what.baba_audio", "kt.day.baba_audio", "kt.day.a11y.baba_audio", "kt.toast.playlistsSoon.baba_audio", "ugc.add.blurb.baba_audio", "rec.more.hint.baba_audio", "rec.place.label", "rec.discourse.label", "ugc.form.error.language.baba_audio"]
    for (const key of keys) expect(source.split(`"${key}"`).length - 1, key).toBe(3)
    for (const language of ["en", "ru", "es"] as const) {
      setActiveLanguage(language)
      for (const key of keys) expect((t as (key: string, vars?: Record<string, unknown>) => string)(key, { count: 1, title: "x" }), `${language} ${key}`).not.toBe(key)
    }
    setActiveLanguage("en")
  })
})
