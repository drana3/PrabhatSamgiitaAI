import { describe, expect, it } from "vitest"

import { fixKiirtanSpelling, fixKiirtanSpellingIn, hasKirtanSpelling } from "@/lib/kirtan/kiirtanSpelling"

/** Dada, 9 Nov 2026: whatever is typed in a title or a name, the word is "Kiirtan" with two i's. */

describe("Kiirtan spelling", () => {
  it("corrects the word in any case and any spelling", () => {
    for (const typed of ["kirtan", "Kirtan", "KIRTAN", "kiirtan", "Kiirtan", "KIIRTAN", "kIrTaN"]) expect(fixKiirtanSpelling(typed), typed).toBe("Kiirtan")
  })

  it("corrects it inside a longer text, at the start, in the middle and at the end", () => {
    expect(fixKiirtanSpelling("my kirtan 2")).toBe("my Kiirtan 2")
    expect(fixKiirtanSpelling("kirtan of the day")).toBe("Kiirtan of the day")
    expect(fixKiirtanSpelling("Evening, kirtan.")).toBe("Evening, Kiirtan.")
    expect(fixKiirtanSpelling("(kirtan)")).toBe("(Kiirtan)")
    expect(fixKiirtanSpelling("Baba Nam Kevalam kirtan, Lila kirtan")).toBe("Baba Nam Kevalam Kiirtan, Lila Kiirtan")
  })

  it("keeps a plural and leaves words that only contain it alone", () => {
    expect(fixKiirtanSpelling("kirtans")).toBe("Kiirtans")
    expect(fixKiirtanSpelling("Sankirtan")).toBe("Sankirtan")
    expect(fixKiirtanSpelling("Ananda Marga")).toBe("Ananda Marga")
  })

  it("changes nothing that is already right, so a field can run it on every keystroke", () => {
    for (const text of ["Kiirtan", "Baba Nam Kevalam", "", "  Kiirtan  "]) expect(fixKiirtanSpelling(text)).toBe(text)
    expect(hasKirtanSpelling("kirtan")).toBe(true)
    expect(hasKirtanSpelling("Kiirtan")).toBe(false)
  })

  it("fixes the named text fields of a patch and nothing else", () => {
    const patch = { performer: "kirtan group", place: "Kirtan hall", year: "1998", psSong: null }
    expect(fixKiirtanSpellingIn(patch, ["performer", "place", "psSong"])).toEqual({ performer: "Kiirtan group", place: "Kiirtan hall", year: "1998", psSong: null })
    expect(fixKiirtanSpellingIn({ notes: "kirtan" }, ["performer" as never])).toEqual({ notes: "kirtan" })
    expect(fixKiirtanSpellingIn(patch, ["year"])).toBe(patch)
  })
})
