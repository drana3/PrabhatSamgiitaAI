import { describe, expect, it } from "vitest"

import { shareCardText } from "@/lib/share/cardCopy"
import { shareCardEn, shareCardEs, shareCardRu } from "@/locales/shareCard"

describe("share card strings", () => {
  it("ru and es have exactly the keys of en, none empty", () => {
    const keys = Object.keys(shareCardEn).sort()
    expect(Object.keys(shareCardRu).sort()).toEqual(keys)
    expect(Object.keys(shareCardEs).sort()).toEqual(keys)
    for (const dict of [shareCardEn, shareCardRu, shareCardEs]) {
      for (const value of Object.values(dict)) expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  it("is read in the language asked for", () => {
    expect(shareCardText("en", "shareCard.save")).toBe("Save image")
    expect(shareCardText("ru", "shareCard.save")).toBe("Сохранить картинку")
    expect(shareCardText("es", "shareCard.save")).toBe("Guardar imagen")
  })
})
