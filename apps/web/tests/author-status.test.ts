import { describe, expect, it, vi } from "vitest"

import { authorGoneResponse, authorSlugFromPath, decideAuthorStatus, probeAuthorStatus } from "@/lib/author-status"

describe("author page status", () => {
  it("picks the slug only from /author/<slug>", () => {
    expect(authorSlugFromPath("/author/priya-devi")).toBe("priya-devi")
    expect(authorSlugFromPath("/author/priya-devi/")).toBe("priya-devi")
    expect(authorSlugFromPath("/authors")).toBeNull()
    expect(authorSlugFromPath("/author")).toBeNull()
    expect(authorSlugFromPath("/author/a/b")).toBeNull()
    expect(authorSlugFromPath("/author/%E0%A4%A")).toBeNull()
  })

  it("maps the API answer to a decision", () => {
    expect(decideAuthorStatus(404, null)).toEqual({ kind: "status", status: 404 })
    expect(decideAuthorStatus(410, null)).toEqual({ kind: "status", status: 410 })
    expect(decideAuthorStatus(308, { slug: "new-name" })).toEqual({ kind: "redirect", slug: "new-name" })
    expect(decideAuthorStatus(308, {})).toEqual({ kind: "pass" })
    expect(decideAuthorStatus(200, null)).toEqual({ kind: "pass" })
    expect(decideAuthorStatus(500, null)).toEqual({ kind: "pass" })
  })

  it("never blocks the page when the API cannot be reached", async () => {
    const down = vi.fn().mockRejectedValue(new Error("down")) as unknown as typeof fetch
    expect(await probeAuthorStatus("priya-devi", down)).toEqual({ kind: "pass" })
  })

  it("reads a moved author's new slug from the body", async () => {
    const moved = vi.fn().mockResolvedValue(new Response(JSON.stringify({ slug: "priya-devi" }), { status: 308 })) as unknown as typeof fetch
    expect(await probeAuthorStatus("old-name", moved)).toEqual({ kind: "redirect", slug: "priya-devi" })
  })

  it("answers gone and missing with real codes and noindex", async () => {
    const gone = authorGoneResponse(410)
    expect(gone.status).toBe(410)
    expect(gone.headers.get("x-robots-tag")).toBe("noindex")
    expect(await gone.text()).toContain("noindex")
    expect(authorGoneResponse(404).status).toBe(404)
  })
})
