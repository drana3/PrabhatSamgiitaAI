import { describe, expect, it } from "vitest"

import { emptyDraft, hasErrors, settleSlug, toCreateInput, validateDraft, withName, withSlug } from "@/lib/authors/draft"
import { errorKey, localSlugProblem, normalizeSlug, problemKey, suggestSlug, typingSlug } from "@/lib/authors/slug"

describe("slug rules on the phone", () => {
  it("makes a typed name an address", () => {
    expect(normalizeSlug("Madhu Vrata")).toBe("madhu-vrata")
    expect(normalizeSlug("  Bábá_Nám  ")).toBe("baba-nam")
    expect(normalizeSlug("a--b!!")).toBe("a-b")
    expect(normalizeSlug("ДАДА")).toBe("")
    expect(suggestSlug("A".repeat(50)).length).toBeLessThanOrEqual(30)
  })

  it("names the local problems like the server", () => {
    expect(localSlugProblem("ab")).toBe("too_short")
    expect(localSlugProblem("a".repeat(31))).toBe("too_long")
    expect(localSlugProblem("---")).toBe("characters")
    expect(localSlugProblem("123")).toBe("needs_letter")
    expect(localSlugProblem("madhu-vrata")).toBeNull()
  })

  it("falls back to a generic sentence for unknown codes", () => {
    expect(problemKey("taken")).toBe("authors.slug.taken")
    expect(problemKey("something-new")).toBe("authors.slug.unknown")
    expect(errorKey({ network: true })).toBe("authors.error.network")
    expect(errorKey({ code: "suspended", status: 403 })).toBe("authors.error.suspended")
    expect(errorKey({ code: "link_weird" })).toBe("authors.error.link_url")
    expect(errorKey({ status: 429 })).toBe("authors.error.rate_limited")
    expect(errorKey({ status: 500 })).toBe("authors.error.generic")
  })
})

describe("the creation draft", () => {
  it("follows the name until the person types the address", () => {
    let d = withName(emptyDraft(), "Priya Devi")
    expect(d.slug).toBe("priya-devi")
    d = withSlug(d, "Priya Kiirtan")
    expect(d.slug).toBe("priya-kiirtan")
    d = withName(d, "Priya Devi Group")
    expect(d.slug).toBe("priya-kiirtan")
  })

  it("is invalid when empty and valid with a name and address", () => {
    expect(hasErrors(validateDraft(emptyDraft()))).toBe(true)
    expect(hasErrors(validateDraft(withName(emptyDraft(), "Priya Devi")))).toBe(false)
  })

  it("flags too many links and empty links", () => {
    const base = withName(emptyDraft(), "Priya Devi")
    const many = { ...base, links: Array.from({ length: 7 }, (_, i) => ({ kind: "website" as const, url: `https://x.example/${i}` })) }
    expect(validateDraft(many).links).toBe("too_many")
    expect(validateDraft({ ...base, links: [{ kind: "website", url: " " }] }).links).toBe("empty_url")
  })

  it("builds the request with trimmed text and no empty links", () => {
    const d = {
      ...withName(emptyDraft(), "  Priya   Devi "),
      links: [
        { kind: "youtube" as const, url: " https://youtube.com/@p " },
        { kind: "website" as const, url: "" },
      ],
      country: " Poland ",
      city: "",
    }
    const input = toCreateInput(d, true)
    expect(input.display_name).toBe("Priya Devi")
    expect(input.links).toEqual([{ kind: "youtube", url: "https://youtube.com/@p" }])
    expect(input.country).toBe("Poland")
    expect(input.city).toBeNull()
    expect(input.publish).toBe(true)
  })
})

describe("typing a hyphen in the address (QA-032)", () => {
  /** What the field does with each keystroke: the new text replaces the old one, through `withSlug`. */
  function type(keys: string[]): string {
    let draft = emptyDraft()
    let text = ""
    for (const key of keys) {
      text += key
      draft = withSlug(draft, text)
      text = draft.slug
    }
    return draft.slug
  }

  it("keeps a hyphen typed at the end, so priya + - + devi stays priya-devi", () => {
    expect(typingSlug("priya-")).toBe("priya-")
    expect(type([..."priya-devi"])).toBe("priya-devi")
  })

  it("still folds the rest while typing", () => {
    expect(typingSlug("Priya  Dev")).toBe("priya-dev")
    expect(typingSlug("-priya")).toBe("priya")
    expect(typingSlug("a--b")).toBe("a-b")
  })

  it("settles to the sent form on blur and when it is sent", () => {
    const typed = withSlug(emptyDraft(), "priya-")
    expect(typed.slug).toBe("priya-")
    expect(settleSlug(typed).slug).toBe("priya")
    expect(toCreateInput({ ...typed, displayName: "Priya" }, false).slug).toBe("priya")
    expect(validateDraft({ ...typed, displayName: "Priya" }).slug).toBeUndefined()
  })
})
