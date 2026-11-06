import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { ALL_RULES, PRON_SOURCES } from "@/data/pronunciation"
import { tokensInRoman } from "@/lib/pronunciation/symbols"
import { en } from "@/locales/en"
import { es } from "@/locales/es"
import { pronunciationEn, pronunciationEs, pronunciationRu } from "@/locales/pronunciation"
import { ru } from "@/locales/ru"

type CatalogueSong = { number: number; lyrics_original: string | null }
const catalogue: CatalogueSong[] = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../data/generated/songs.json"), "utf8"))
const bySong = new Map(catalogue.map((row) => [row.number, row]))

const AUDIO_DIR = path.resolve(__dirname, "../assets/audio/pronunciation")
const COMPUTER = path.join(AUDIO_DIR, "computer")
const NATIVE = path.join(AUDIO_DIR, "native")
const clipFiles = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(m4a|mp3|wav)$/.test(f)) : [])
const clipIds = (dir: string) => clipFiles(dir).map((f) => f.replace(/\.(m4a|mp3|wav)$/, ""))

/** Rules that are explained in words only: there is no single word to play for them. */
const TEXT_ONLY = ["bn.g.roman", "bn.g.stress", "bn.g.nasalvowel", "sa.g.roman", "sa.g.stress"]
const KNOWN_PATTERNS = ["@diph", "@nga", "@nya", "@visarga", "@yphala", "@vphala"]

const samples = ALL_RULES.flatMap((rule) => rule.samples.map((sample) => ({ rule, sample })))

describe("pronunciation data: rules", () => {
  it("has unique ids that start with the language", () => {
    const ids = ALL_RULES.map((rule) => rule.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const rule of ALL_RULES) expect(rule.id.startsWith(rule.language === "bengali" ? "bn." : "sa."), rule.id).toBe(true)
  })

  it("names at least one source for every rule, and every source exists", () => {
    const known = new Set(PRON_SOURCES.map((source) => source.id))
    expect(known.size).toBe(PRON_SOURCES.length)
    for (const rule of ALL_RULES) {
      expect(rule.sources.length, rule.id).toBeGreaterThan(0)
      for (const id of rule.sources) expect(known.has(id), `${rule.id} -> ${id}`).toBe(true)
    }
  })

  it("describes every source: a title, an address, what was taken from it and when it was read", () => {
    for (const source of PRON_SOURCES) {
      expect(source.title.length, source.id).toBeGreaterThan(0)
      expect(/^https:\/\/|^data\//.test(source.url), source.id).toBe(true)
      expect(source.used.length, source.id).toBeGreaterThan(20)
      expect(source.read, source.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it("has a verified flag and a status for every rule; no rule claims a native speaker has confirmed it", () => {
    for (const rule of ALL_RULES) {
      expect(typeof rule.verified, rule.id).toBe("boolean")
      expect(["sourced", "needs-native-check"], rule.id).toContain(rule.status)
      // no native speaker has listened yet: do not let a rule pretend so
      expect(rule.verified, rule.id).toBe(false)
      if (rule.status === "needs-native-check") expect((rule.checkNote ?? "").length, rule.id).toBeGreaterThan(30)
    }
  })

  it("gives every rule a sound to play, except the few explained in words only", () => {
    for (const rule of ALL_RULES) {
      if (TEXT_ONLY.includes(rule.id)) expect(rule.samples.length, rule.id).toBe(0)
      else expect(rule.samples.length, rule.id).toBeGreaterThan(0)
    }
  })

  it("only lists text-only rules that exist", () => {
    for (const id of TEXT_ONLY) expect(ALL_RULES.some((rule) => rule.id === id), id).toBe(true)
  })
})

describe("pronunciation data: examples come from the real lyrics", () => {
  it("has a unique audio id per example, built from the rule id", () => {
    const ids = samples.map(({ sample }) => sample.audio)
    expect(new Set(ids).size).toBe(ids.length)
    for (const { rule, sample } of samples) expect(sample.audio.startsWith(`${rule.id}.`), sample.audio).toBe(true)
  })

  it("uses a word that really occurs in the stated song", () => {
    const wordRe = (word: string) => new RegExp(`(^|[^\\p{L}\\p{M}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{M}])`, "u")
    for (const { rule, sample } of samples) {
      const song = bySong.get(sample.song)
      expect(song, `${sample.audio}: PS ${sample.song}`).toBeTruthy()
      const text = (song?.lyrics_original ?? "").normalize("NFC").toLowerCase()
      expect(wordRe(sample.roman.normalize("NFC").toLowerCase()).test(text), `${rule.id}: "${sample.roman}" in PS ${sample.song}`).toBe(true)
    }
  })

  it("gives each example in the script its language reads: Bengali script or Devanagari", () => {
    for (const { rule, sample } of samples) {
      const range = rule.language === "bengali" ? /^[ঀ-৿]+$/ : /^[ऀ-ॿ]+$/
      expect(range.test(sample.script), `${sample.audio}: ${sample.script}`).toBe(true)
    }
  })

  it("uses only symbols that the catalogue's Roman text really contains", () => {
    const seen = new Set<string>()
    for (const row of catalogue) for (const token of tokensInRoman(row.lyrics_original ?? "")) seen.add(token)
    for (const rule of ALL_RULES) {
      for (const token of rule.tokens) {
        if (token.startsWith("@")) expect(KNOWN_PATTERNS, `${rule.id}: ${token}`).toContain(token)
        else expect(tokensInRoman(token).has(token), `${rule.id}: ${token} is not a symbol the reader produces`).toBe(true)
        expect(seen.has(token), `${rule.id}: ${token} never occurs in the catalogue`).toBe(true)
      }
    }
  })
})

describe("pronunciation data: audio", () => {
  it("has a clip for every example, and no clip without an example", () => {
    const wanted = new Set(samples.map(({ sample }) => sample.audio))
    const have = new Set([...clipIds(COMPUTER), ...clipIds(NATIVE)])
    for (const id of wanted) expect(have.has(id), `missing clip ${id}`).toBe(true)
    for (const id of have) expect(wanted.has(id), `clip without an example: ${id}`).toBe(true)
  })

  it("lists every example in the generated index, and the index lists nothing else", () => {
    const index = fs.readFileSync(path.resolve(__dirname, "../data/pronunciation/audioIndex.ts"), "utf8")
    const inIndex = new Set([...index.matchAll(/^\s+"([^"]+)": \{ kind:/gm)].map((m) => m[1]))
    expect(inIndex).toEqual(new Set(samples.map(({ sample }) => sample.audio)))
  })

  it("says in the index which clips are recordings: a file in native/ wins over the computer voice", () => {
    const index = fs.readFileSync(path.resolve(__dirname, "../data/pronunciation/audioIndex.ts"), "utf8")
    const native = new Set(clipIds(NATIVE))
    for (const match of index.matchAll(/^\s+"([^"]+)": \{ kind: "(\w+)"/gm)) expect(match[2], match[1]).toBe(native.has(match[1]) ? "native" : "computer")
  })

  it("keeps the bundle small", () => {
    const bytes = [...clipFiles(COMPUTER).map((f) => path.join(COMPUTER, f)), ...clipFiles(NATIVE).map((f) => path.join(NATIVE, f))].reduce((sum, file) => sum + fs.statSync(file).size, 0)
    expect(bytes).toBeLessThan(1_500_000)
  })

  it("records how the computer clips were made", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(COMPUTER, "manifest.json"), "utf8")) as { voices: Record<string, string>; clips: Array<{ audio: string; text: string }> }
    expect(manifest.voices).toEqual({ bengali: "Piya", sanskrit: "Lekha" })
    expect(new Set(manifest.clips.map((c) => c.audio))).toEqual(new Set(samples.map(({ sample }) => sample.audio)))
    for (const clip of manifest.clips) expect(samples.find(({ sample }) => sample.audio === clip.audio)?.sample.script).toBe(clip.text)
  })
})

describe("pronunciation data: texts in en, ru and es", () => {
  const keysFor = ALL_RULES.flatMap((rule) => [`pron.${rule.id}.text`, ...(rule.like ? [`pron.${rule.id}.like`] : [])])

  it("has a text for every rule and a 'close to' line for every rule that asks for one, in all three languages", () => {
    for (const key of keysFor) {
      expect((pronunciationEn as Record<string, string>)[key]?.length, `en ${key}`).toBeGreaterThan(5)
      expect(pronunciationRu[key]?.length, `ru ${key}`).toBeGreaterThan(5)
      expect((pronunciationEs as Record<string, string>)[key]?.length, `es ${key}`).toBeGreaterThan(5)
    }
  })

  it("has no text for a rule that does not exist and no 'close to' line for a rule that says it has none", () => {
    const allowed = new Set(keysFor)
    for (const key of Object.keys(pronunciationEn)) {
      const match = /^pron\.((?:bn|sa)\.[\w.]+)\.(text|like)$/.exec(key)
      if (match) expect(allowed.has(key), key).toBe(true)
    }
  })

  it("keeps ru and es in step with en, key for key, and the keys reach the app dictionaries", () => {
    const enKeys = Object.keys(pronunciationEn).sort()
    expect(Object.keys(pronunciationRu).sort()).toEqual(enKeys)
    expect(Object.keys(pronunciationEs).sort()).toEqual(enKeys)
    for (const key of enKeys) {
      expect(key in en, `en ${key}`).toBe(true)
      expect(key in ru, `ru ${key}`).toBe(true)
      expect(key in es, `es ${key}`).toBe(true)
    }
  })

  it("keeps the placeholders of ru and es the same as en", () => {
    for (const [key, value] of Object.entries(pronunciationEn)) {
      const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      expect(names(pronunciationRu[key]), `ru ${key}`).toEqual(names(value))
      expect(names((pronunciationEs as Record<string, string>)[key]), `es ${key}`).toEqual(names(value))
    }
  })
})
