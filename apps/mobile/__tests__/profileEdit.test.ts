import { describe, expect, it, vi } from "vitest"

import { saveProfile, type ProfileSink } from "@/lib/profile/saveProfile"
import {
  NAME_MAX,
  NAME_MIN,
  centerSquare,
  initialOf,
  isPhotoDataUri,
  isProfileDirty,
  nameIsMissing,
  normalizeName,
  validateName,
} from "@/lib/profile/validate"

describe("validateName", () => {
  it("trims and collapses spaces", () => {
    expect(normalizeName("  Dada   Maetreya ")).toBe("Dada Maetreya")
    expect(validateName("  Dada   Maetreya ")).toEqual({ ok: true, value: "Dada Maetreya" })
  })

  it("takes 2 to 40 characters after trimming", () => {
    expect(validateName("").ok).toBe(false)
    expect(validateName("   ").ok).toBe(false)
    expect(validateName("A")).toEqual({ ok: false, error: `Use at least ${NAME_MIN} characters.` })
    expect(validateName("Jo").ok).toBe(true)
    expect(validateName("x".repeat(NAME_MAX)).ok).toBe(true)
    expect(validateName("x".repeat(NAME_MAX + 1))).toEqual({ ok: false, error: `Use ${NAME_MAX} characters or fewer.` })
  })

  it("counts a letter with a diacritic or an emoji as one character", () => {
    expect(validateName("Ás").ok).toBe(true)
    expect(validateName("Á").ok).toBe(false)
    expect(validateName("आनंद").ok).toBe(true)
  })

  it("wants a letter and refuses an email address", () => {
    expect(validateName("1234").ok).toBe(false)
    expect(validateName("a@b.co")).toEqual({ ok: false, error: "Use your name, not an email address." })
  })
})

describe("initialOf", () => {
  it("is the first letter in capitals, skipping marks", () => {
    expect(initialOf("dada maetreya")).toBe("D")
    expect(initialOf("  ásvini")).toBe("Á")
    expect(initialOf("- 7 ram")).toBe("R")
    expect(initialOf("")).toBe("·")
    expect(initialOf(null)).toBe("·")
  })
})

describe("isProfileDirty", () => {
  const saved = { name: "Dada", photoUri: null }
  it("is false when nothing changed, even with stray spaces", () => {
    expect(isProfileDirty(saved, { name: " Dada ", photoUri: null })).toBe(false)
    expect(isProfileDirty({ name: "Dada", photoUri: "data:x" }, { name: "Dada", photoUri: "data:x" })).toBe(false)
  })
  it("is true for a new name or a new, removed or added photo", () => {
    expect(isProfileDirty(saved, { name: "Dada M", photoUri: null })).toBe(true)
    expect(isProfileDirty(saved, { name: "Dada", photoUri: "data:x" })).toBe(true)
    expect(isProfileDirty({ name: "Dada", photoUri: "data:x" }, { name: "Dada", photoUri: null })).toBe(true)
  })
})

describe("centerSquare", () => {
  it("takes the middle of a landscape or portrait picture", () => {
    expect(centerSquare(900, 600)).toEqual({ originX: 150, originY: 0, width: 600, height: 600 })
    expect(centerSquare(600, 900)).toEqual({ originX: 0, originY: 150, width: 600, height: 600 })
    expect(centerSquare(512, 512)).toEqual({ originX: 0, originY: 0, width: 512, height: 512 })
  })
  it("never returns a zero or negative crop", () => {
    expect(centerSquare(0, 0).width).toBeGreaterThanOrEqual(1)
  })
})

describe("nameIsMissing", () => {
  it("is true for nothing, a placeholder or the email's own name", () => {
    expect(nameIsMissing("", null)).toBe(true)
    expect(nameIsMissing("Apple member", "a@b.co")).toBe(true)
    expect(nameIsMissing("Friend", null)).toBe(true)
    expect(nameIsMissing("dewasheesh.rana@gmail.com", null)).toBe(true)
    expect(nameIsMissing("Dewasheesh Rana", "dewasheesh.rana@gmail.com")).toBe(true)
  })
  it("is false for a real name", () => {
    expect(nameIsMissing("Dada Maetreya", "kurtaew@gmail.com")).toBe(false)
    expect(nameIsMissing("Dada", null)).toBe(false)
  })
})

describe("isPhotoDataUri", () => {
  it("accepts only JPEG data URIs", () => {
    expect(isPhotoDataUri("data:image/jpeg;base64,AAAA")).toBe(true)
    expect(isPhotoDataUri("https://example.com/a.jpg")).toBe(false)
    expect(isPhotoDataUri(null)).toBe(false)
  })
})

describe("saveProfile", () => {
  const makeSink = () => {
    const apply = vi.fn()
    const sink: ProfileSink = { apply }
    return { sink, apply }
  }

  it("writes the trimmed name through the sink", async () => {
    const { sink, apply } = makeSink()
    const result = await saveProfile({ name: "  Dada  Maetreya " }, sink)
    expect(result).toEqual({ ok: true, name: "Dada Maetreya", photoUri: undefined, synced: false })
    expect(apply).toHaveBeenCalledWith({ name: "Dada Maetreya" })
  })

  it("does not write anything for a bad name", async () => {
    const { sink, apply } = makeSink()
    const result = await saveProfile({ name: "A" }, sink)
    expect(result).toMatchObject({ ok: false, field: "name" })
    expect(apply).not.toHaveBeenCalled()
  })

  it("keeps what is left out and clears a photo given as null", async () => {
    const { sink, apply } = makeSink()
    await saveProfile({ photoUri: null }, sink)
    expect(apply).toHaveBeenCalledWith({ photoUri: null })
    await saveProfile({ photoUri: "data:image/jpeg;base64,AAAA" }, sink)
    expect(apply).toHaveBeenLastCalledWith({ photoUri: "data:image/jpeg;base64,AAAA" })
  })
})
