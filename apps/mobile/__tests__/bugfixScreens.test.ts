import { describe, expect, it } from "vitest"

import { distinctSubtitle } from "@/lib/songMap"

describe("distinctSubtitle (BUG-13)", () => {
  it("hides a subtitle that repeats the title", () => {
    expect(distinctSubtitle("Bandhu He Niye Calo", "Bandhu He Niye Calo")).toBeNull()
  })

  it("ignores case, spacing and trailing punctuation when comparing", () => {
    expect(distinctSubtitle("Bandhu he niye calo", "  BANDHU HE NIYE CALO. ")).toBeNull()
  })

  it("keeps a subtitle that adds information", () => {
    expect(distinctSubtitle("Song 1", "Bandhu He Niye Calo")).toBe("Bandhu He Niye Calo")
  })

  it("returns null for empty values", () => {
    expect(distinctSubtitle("Title", "")).toBeNull()
    expect(distinctSubtitle("Title", undefined)).toBeNull()
  })
})
