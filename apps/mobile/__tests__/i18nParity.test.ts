import { describe, expect, it } from "vitest"

import review from "@/locales/review.json"
import { LANGUAGES, REQUIRED_PLURAL_FORMS, type Language } from "@/lib/i18n/core"
import { dictionaries } from "@/locales"

/**
 * Key parity: English is the source of truth. A key missing in another language, a variable that
 * differs, or a plural form a language needs but lacks fails here, so a half-translated string never ships.
 */

const FORM_RE = /^(.*)_(zero|one|two|few|many|other)$/
const VAR_RE = /\{(\w+)\}/g

type Group = { forms: Map<string, string>; plain: string | null }

function groups(language: Language): Map<string, Group> {
  const out = new Map<string, Group>()
  for (const [key, value] of Object.entries(dictionaries[language])) {
    const m = FORM_RE.exec(key)
    const base = m ? (m[1] as string) : key
    const group = out.get(base) ?? { forms: new Map(), plain: null }
    if (m) group.forms.set(m[2] as string, value)
    else group.plain = value
    out.set(base, group)
  }
  return out
}

function vars(text: string): string[] {
  return [...text.matchAll(VAR_RE)].map((m) => m[1] as string).sort()
}

function groupVars(group: Group): string[] {
  const all = [...group.forms.values(), ...(group.plain === null ? [] : [group.plain])]
  return [...new Set(all.flatMap(vars))].sort()
}

const english = groups("en")
const others = LANGUAGES.filter((l) => l !== "en")

describe("i18n dictionaries", () => {
  it("English has no key that is both plain and plural, and counted strings use {count}", () => {
    for (const [base, group] of english) {
      expect(group.forms.size > 0 && group.plain !== null, `${base} is plain and plural`).toBe(false)
      if (group.forms.size > 0) expect(groupVars(group), `${base} needs {count}`).toContain("count")
    }
  })

  for (const language of LANGUAGES) {
    it(`${language}: plural groups carry exactly the forms the language needs`, () => {
      const need = REQUIRED_PLURAL_FORMS[language]
      for (const [base, group] of groups(language)) {
        if (group.forms.size === 0) continue
        expect([...group.forms.keys()].sort(), `${language}:${base}`).toEqual([...need].sort())
      }
    })

    it(`${language}: no empty strings, no stray whitespace at the ends`, () => {
      for (const [key, value] of Object.entries(dictionaries[language])) {
        expect(value.trim().length, `${language}:${key} is empty`).toBeGreaterThan(0)
        expect(value, `${language}:${key} has edge whitespace`).toBe(value.trim())
      }
    })
  }

  for (const language of others) {
    it(`${language}: has every English key and no extra`, () => {
      const mine = groups(language)
      const missing = [...english.keys()].filter((k) => !mine.has(k))
      const extra = [...mine.keys()].filter((k) => !english.has(k))
      expect(missing, `missing in ${language}`).toEqual([])
      expect(extra, `not in English (${language})`).toEqual([])
    })

    it(`${language}: same {variables} as English for every key`, () => {
      const mine = groups(language)
      for (const [base, group] of english) {
        const other = mine.get(base)
        if (!other) continue
        expect(groupVars(other), `${language}:${base}`).toEqual(groupVars(group))
      }
    })
  }

  it("spelling rules for names that are never translated", () => {
    for (const language of LANGUAGES) {
      for (const [key, value] of Object.entries(dictionaries[language])) {
        // English and Spanish: Kiirtan with two i's; Russian uses the Russian word
        if (language !== "ru") expect(value, `${language}:${key}`).not.toMatch(/\bKirtan/i)
        if (language === "ru") expect(value, `${language}:${key}`).not.toMatch(/Ki?irtan/i)
        if (language === "ru") expect(value, `${language}:${key}`).not.toMatch(/\bBhajan\b/)
        // the app name stays in Latin letters, spelled one way
        for (const name of value.matchAll(/Prabhat\s+\p{L}+/giu)) {
          expect(name[0], `${language}:${key}`).toBe("Prabhat Samgiita")
        }
        expect(value, `${language}:${key}`).not.toMatch(/Прабхат/i)
      }
    }
  })

  it("review.json only names real keys of real languages", () => {
    const data = review as Record<string, Record<string, boolean>>
    for (const [language, entries] of Object.entries(data)) {
      expect(["ru", "es"]).toContain(language)
      const mine = dictionaries[language as Language]
      for (const key of Object.keys(entries)) expect(key in mine, `${language}:${key}`).toBe(true)
    }
  })
})
