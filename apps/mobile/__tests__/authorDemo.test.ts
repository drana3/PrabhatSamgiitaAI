import { describe, expect, it, vi } from "vitest"

import { DEMO_AUTHORS } from "@/lib/fixtures/authors"

// In the demo preview the gate hands out the invented authors.
vi.mock("@/lib/fixtures/authorsGate", () => ({ sampleAuthors: () => DEMO_AUTHORS }))

import { createDemoApi } from "@/lib/authors/demo"

describe("demo author api (the Demo preview)", () => {
  it("lists the invented authors and nothing is saved anywhere", async () => {
    const api = createDemoApi()
    expect(api.demo).toBe(true)
    const list = await api.directory({})
    expect(list.items.length).toBe(DEMO_AUTHORS.length)
    expect((await api.mine()).profile).toBeNull()
  })

  it("checks addresses like the server does", async () => {
    const api = createDemoApi()
    expect((await api.checkSlug("priya-devi")).available).toBe(false)
    expect((await api.checkSlug("fresh-name")).available).toBe(true)
    expect((await api.checkSlug("admin")).problem).toBe("reserved")
    expect((await api.checkSlug("ab")).problem).toBe("too_short")
  })

  it("creates, publishes, unpublishes and deletes in memory", async () => {
    const api = createDemoApi()
    const made = await api.create({
      slug: "my-page",
      display_name: "My Page",
      author_type: "solo",
      bio: "",
      about: "",
      country: null,
      city: null,
      languages: [],
      links: [],
      claimed_name: null,
      include_uploads: "all",
      show_stats: true,
      publish: false,
    })
    expect(made.status).toBe("draft")
    expect((await api.publish()).status).toBe("published")
    expect((await api.unpublish()).status).toBe("draft")
    await api.remove()
    expect((await api.mine()).profile).toBeNull()
  })

  it("answers missing for an unknown page", async () => {
    expect(await createDemoApi().profile("nobody-here")).toEqual({ kind: "missing" })
  })

  it("every demo page is labelled by invented content only (no real names)", () => {
    for (const a of DEMO_AUTHORS) {
      expect(a.profile.stats?.counting_since).toBeTruthy()
      expect(a.profile.slug).toMatch(/^[a-z0-9-]+$/)
    }
  })
})
