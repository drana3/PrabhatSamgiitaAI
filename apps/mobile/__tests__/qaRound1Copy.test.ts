import { describe, expect, it } from "vitest"

import { dictionaries } from "@/locales"

const LANGUAGES = ["en", "ru", "es"] as const

describe("QA round 1: wording", () => {
  it("the Radio screen has its words in en, ru and es, and never says Drive (QA-007)", () => {
    for (const language of LANGUAGES) {
      const keys = Object.keys(dictionaries[language]).filter((key) => key.startsWith("radio."))
      expect(keys.length, language).toBeGreaterThanOrEqual(13)
      for (const key of keys) {
        const text = dictionaries[language][key] as string
        expect(text, `${language}:${key}`).not.toMatch(/\bdrive\b|за рулём|conducci[oó]n/i)
      }
    }
    expect(dictionaries.en["radio.random.idle"]).toBe("Starts automatically when you open Radio")
    expect(dictionaries.ru["radio.random.idle"]).toMatch(/Радио/)
    expect(dictionaries.es["radio.random.idle"]).toMatch(/Radio/)
  })

  it("the Kiirtan upload copy takes the number of songs from the catalogue constant (QA-027)", () => {
    for (const language of LANGUAGES) {
      const blurb = dictionaries[language]["ugc.add.blurb.prabhat_samgiita"] as string
      expect(blurb, language).toContain("{count}")
      expect(blurb, language).not.toMatch(/5,?018/)
    }
  })

  it("the not-found song page says what the range is (QA-003)", () => {
    for (const language of LANGUAGES) {
      expect(dictionaries[language]["songPage.notFound.range"], language).toContain("{max}")
    }
  })

  it("the anonymity line says the team can see the author of an anonymous comment (QA-011)", () => {
    expect(dictionaries.en["songComments.as.team"]).toMatch(/team can see who wrote an anonymous comment/)
    expect(dictionaries.ru["songComments.as.team"]).toMatch(/команда Prabhat Samgiita видит, кто написал анонимный комментарий/)
    expect(dictionaries.es["songComments.as.team"]).toMatch(/equipo de Prabhat Samgiita puede ver quién escribió un comentario anónimo/)
    for (const language of LANGUAGES) expect(dictionaries[language]["songComments.as.team"], language).not.toMatch(/reported|пожалуются|denuncia/)
  })

  it("a computed festival date is labelled as expected, with the reason (QA-013)", () => {
    for (const language of LANGUAGES) {
      expect(dictionaries[language]["fest.expected"], language).toBeTruthy()
      expect(dictionaries[language]["fest.expected.why"], language).toBeTruthy()
    }
    expect(dictionaries.en["fest.expected"]).toBe("Expected date")
  })
})
