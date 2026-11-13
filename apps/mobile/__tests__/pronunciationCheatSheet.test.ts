import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { rulesOf } from "@/data/pronunciation"
import type { PronLanguage } from "@/data/pronunciation/types"
import { buildCheatSheet, CHEAT_GROUPS, firstSentence, MAX_SHOWN_SYMBOLS } from "@/lib/pronunciation/cheatSheet"
import { pronunciationEn, pronunciationEs, pronunciationRu } from "@/locales/pronunciation"

type CatalogueSong = { number: number; lyrics_original: string | null }
const catalogue: CatalogueSong[] = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../data/generated/songs.json"), "utf8"))
const lyrics = (n: number) => catalogue.find((row) => row.number === n)?.lyrics_original ?? ""

const LANGUAGES: PronLanguage[] = ["bengali", "sanskrit"]
const dictionaries = { en: pronunciationEn as Record<string, string>, ru: pronunciationRu as Record<string, string>, es: pronunciationEs as Record<string, string> }

describe("pronunciation cheat-sheet: the six groups", () => {
  it("has exactly six groups, in the order the sheet shows them, none empty", () => {
    expect(CHEAT_GROUPS).toEqual(["vowel", "consonant", "nasal", "sibilant", "special", "general"])
    for (const language of LANGUAGES) {
      const sheet = buildCheatSheet(language, lyrics(19))
      expect(sheet.groups.map((g) => g.id)).toEqual([...CHEAT_GROUPS])
      for (const group of sheet.groups) expect(group.rows.length, `${language} ${group.id}`).toBeGreaterThan(0)
    }
  })

  it("holds every rule of the language once, and nothing else", () => {
    for (const language of LANGUAGES) {
      const sheet = buildCheatSheet(language, lyrics(19))
      const ids = sheet.groups.flatMap((g) => g.rows.map((r) => r.rule.id))
      expect(new Set(ids).size).toBe(ids.length)
      expect([...ids].sort()).toEqual(rulesOf(language).map((r) => r.id).sort())
      expect(sheet.total).toBe(ids.length)
    }
  })

  it("puts each rule in the group the data gives it", () => {
    for (const language of LANGUAGES) {
      for (const group of buildCheatSheet(language, "").groups) for (const row of group.rows) expect(row.rule.group).toBe(group.id)
    }
  })
})

describe("pronunciation cheat-sheet: the rows", () => {
  it("lists the letters of the open song first in each group and counts them", () => {
    const sheet = buildCheatSheet("bengali", lyrics(19))
    expect(sheet.inSong).toBeGreaterThan(0)
    let counted = 0
    for (const group of sheet.groups) {
      const flags = group.rows.map((r) => r.inSong)
      expect(flags, group.id).toEqual([...flags].sort((a, b) => Number(b) - Number(a)))
      expect(group.inSong).toBe(flags.filter(Boolean).length)
      counted += group.inSong
    }
    expect(counted).toBe(sheet.inSong)
  })

  it("marks no row as in the song when there is no text", () => {
    for (const text of ["", null, undefined]) {
      const sheet = buildCheatSheet("bengali", text)
      expect(sheet.inSong).toBe(0)
      expect(sheet.groups.every((g) => g.rows.every((r) => !r.inSong))).toBe(true)
    }
  })

  it("keeps the data's own order inside each half", () => {
    const order = new Map(rulesOf("bengali").map((r, i) => [r.id, i]))
    const sheet = buildCheatSheet("bengali", lyrics(19))
    for (const group of sheet.groups) {
      for (const half of [true, false]) {
        const idx = group.rows.filter((r) => r.inSong === half).map((r) => order.get(r.rule.id)!)
        expect(idx, `${group.id} ${half}`).toEqual([...idx].sort((a, b) => a - b))
      }
    }
  })

  it("shows at most four letters on the left and says when there are more", () => {
    for (const language of LANGUAGES) {
      for (const group of buildCheatSheet(language, "").groups) {
        for (const row of group.rows) {
          expect(row.shown.length).toBeLessThanOrEqual(MAX_SHOWN_SYMBOLS)
          expect(row.shown).toEqual(row.rule.symbols.slice(0, MAX_SHOWN_SYMBOLS))
          expect(row.more).toBe(row.rule.symbols.length > MAX_SHOWN_SYMBOLS)
        }
      }
    }
  })

  it("offers the rule's own first word to hear, and none for a rule explained in words only", () => {
    for (const language of LANGUAGES) {
      for (const group of buildCheatSheet(language, "").groups) {
        for (const row of group.rows) expect(row.first, row.rule.id).toBe(row.rule.samples[0] ?? null)
      }
    }
  })

  it("flags exactly the rules that need a native check, and counts them", () => {
    for (const language of LANGUAGES) {
      const sheet = buildCheatSheet(language, "")
      const rows = sheet.groups.flatMap((g) => g.rows)
      for (const row of rows) expect(row.checking, row.rule.id).toBe(row.rule.status === "needs-native-check")
      expect(sheet.checking).toBe(rows.filter((r) => r.checking).length)
      expect(sheet.checking).toBeGreaterThan(0)
    }
  })
})

describe("pronunciation cheat-sheet: the words", () => {
  it("has a line to show for every row in en, ru and es: the sound it is close to, or the rule's text", () => {
    for (const language of LANGUAGES) {
      for (const group of buildCheatSheet(language, "").groups) {
        for (const row of group.rows) {
          const key = row.rule.like ? `pron.${row.rule.id}.like` : `pron.${row.rule.id}.text`
          for (const [name, dict] of Object.entries(dictionaries)) expect(dict[key], `${name} ${key}`).toBeTruthy()
          expect(dictionaries.en[`pron.${row.rule.id}.text`], row.rule.id).toBeTruthy()
        }
      }
    }
  })

  it("has the cheat-sheet labels in en, ru and es", () => {
    const keys = Object.keys(pronunciationEn).filter((k) => k.startsWith("pron.cs."))
    expect(keys.length).toBeGreaterThan(10)
    for (const group of CHEAT_GROUPS) expect(keys).toContain(`pron.cs.group.${group}`)
    for (const [name, dict] of Object.entries(dictionaries)) for (const key of keys) expect(dict[key], `${name} ${key}`).toBeTruthy()
  })

  it("keeps the placeholders of every cheat-sheet label the same in the three languages", () => {
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",")
    for (const key of Object.keys(pronunciationEn).filter((k) => k.startsWith("pron.cs."))) {
      expect(holes(dictionaries.ru[key]), key).toBe(holes(dictionaries.en[key]))
      expect(holes(dictionaries.es[key]), key).toBe(holes(dictionaries.en[key]))
    }
  })

  it("cuts a rule text at its first sentence", () => {
    expect(firstSentence("The letter অ: an open, rounded o. More text.")).toBe("The letter অ: an open, rounded o.")
    expect(firstSentence("No full stop here")).toBe("No full stop here")
    expect(firstSentence("  Short.  ")).toBe("Short.")
    expect(firstSentence("")).toBe("")
  })

  it("gives the basics rows a readable first sentence in English", () => {
    const basics = buildCheatSheet("bengali", "").groups.find((g) => g.id === "general")!
    for (const row of basics.rows) {
      const line = firstSentence(pronunciationEn[`pron.${row.rule.id}.text` as keyof typeof pronunciationEn] as string)
      expect(line.length, row.rule.id).toBeGreaterThan(10)
      expect(line.length, row.rule.id).toBeLessThan(200)
    }
  })
})
