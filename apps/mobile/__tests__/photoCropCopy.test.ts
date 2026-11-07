import { describe, expect, it } from "vitest"

import { cropText } from "@/lib/profile/cropCopy"
import { photoCropEn, photoCropEs, photoCropRu } from "@/locales/photoCrop"

describe("photo crop strings", () => {
  it("ru and es have exactly the keys of en, none empty", () => {
    const keys = Object.keys(photoCropEn).sort()
    expect(Object.keys(photoCropRu).sort()).toEqual(keys)
    expect(Object.keys(photoCropEs).sort()).toEqual(keys)
    for (const dict of [photoCropEn, photoCropRu, photoCropEs]) {
      for (const value of Object.values(dict)) expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  it("is read in the language asked for", () => {
    expect(cropText("en", "photoCrop.done")).toBe("Done")
    expect(cropText("ru", "photoCrop.done")).toBe("Готово")
    expect(cropText("es", "photoCrop.done")).toBe("Hecho")
  })
})
