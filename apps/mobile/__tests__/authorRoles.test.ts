import { describe, expect, it, vi } from "vitest"

import { DEMO_AUTHORS } from "@/lib/fixtures/authors"

// In the demo preview the gate hands out the invented authors.
vi.mock("@/lib/fixtures/authorsGate", () => ({ sampleAuthors: () => DEMO_AUTHORS }))

import { createDemoApi } from "@/lib/authors/demo"
import { createAuthorsApi } from "@/lib/authors/remote"
import { activeRole, defaultRole, kindCountsOf, roleCounts, roleOf, visibleRoles } from "@/lib/authors/roles"
import { DIRECTORY_ROLE_FILTER_LIVE } from "@/lib/authors/constants"
import { buildSubmission, type SubmissionInput } from "@/lib/kirtan/submissions"
import { uploadSubmission, type UploadSource } from "@/lib/kirtan/upload"
import type { RemoteRecording } from "@/lib/kirtan/remote"

const rec = (by_author: boolean, kind = "kiirtan") => ({ by_author, kind }) as Pick<RemoteRecording, "by_author" | "kind">

describe("roles of a person's page (the honest rule)", () => {
  it("'wrote' only when the API says by_author, 'performs' for everything else", () => {
    expect(roleOf({ by_author: true })).toBe("wrote")
    expect(roleOf({ by_author: false })).toBe("performs")
    // a recording whose credits text names somebody is NOT turned into 'wrote': credits are never read
    expect(roleOf({ by_author: false, credits: "Words and music by Priya Devi" } as never)).toBe("performs")
  })

  it("hides an empty tab, and shows no tabs at all when one role is left", () => {
    expect(visibleRoles(roleCounts([rec(true), rec(false)]))).toEqual(["wrote", "performs"])
    expect(visibleRoles(roleCounts([rec(true), rec(true)]))).toEqual([])
    expect(visibleRoles(roleCounts([rec(false)]))).toEqual([])
    expect(visibleRoles(roleCounts([]))).toEqual([])
  })

  it("opens on the role with more recordings, a tie on 'performs'; a pick that is no longer a tab falls back", () => {
    expect(defaultRole({ wrote: 3, performs: 1 })).toBe("wrote")
    expect(defaultRole({ wrote: 1, performs: 3 })).toBe("performs")
    expect(defaultRole({ wrote: 2, performs: 2 })).toBe("performs")
    expect(activeRole({ wrote: 3, performs: 1 }, "performs")).toBe("performs")
    expect(activeRole({ wrote: 3, performs: 0 }, "performs")).toBeNull()
    expect(activeRole({ wrote: 3, performs: 1 }, null)).toBe("wrote")
  })

  it("counts kinds from the recordings in hand", () => {
    expect(kindCountsOf([rec(true, "bhajan"), rec(true, "kiirtan"), rec(false, "kiirtan")])).toEqual([
      { kind: "kiirtan", count: 2 },
      { kind: "bhajan", count: 1 },
    ])
  })
})

describe("the preview shows every state of the page and the role filter", () => {
  it("Priya Devi has both tabs, Arun Deva only 'Wrote', the others only 'Performs'", async () => {
    const api = createDemoApi()
    const counts = async (slug: string) => roleCounts((await api.recordings(slug, {})).items)
    expect(visibleRoles(await counts("priya-devi"))).toEqual(["wrote", "performs"])
    const arun = await counts("arun-deva")
    expect(arun.wrote).toBeGreaterThan(0)
    expect(arun.performs).toBe(0)
    const group = await counts("dharmacakra")
    expect(group.wrote).toBe(0)
    expect(group.performs).toBeGreaterThan(0)
  })

  it("the directory filters by role in the preview", async () => {
    const api = createDemoApi()
    const slugs = async (role?: "writes" | "performs") => (await api.directory({ role })).items.map((a) => a.slug)
    const all = await slugs()
    const writes = await slugs("writes")
    const performs = await slugs("performs")
    expect(writes).toContain("arun-deva")
    expect(writes).toContain("priya-devi")
    expect(writes).not.toContain("dharmacakra")
    expect(performs).toContain("dharmacakra")
    expect(performs).toContain("priya-devi")
    expect(performs).not.toContain("arun-deva")
    expect(all.length).toBeGreaterThan(Math.max(writes.length, performs.length) - 1)
  })

  it("the role filter stays hidden against the real server until the server answers it", () => {
    expect(DIRECTORY_ROLE_FILTER_LIVE).toBe(false)
  })
})

describe("the directory sends the role to the server as `role`", () => {
  it("adds ?role= only when a role is chosen", async () => {
    const urls: string[] = []
    const fetchFake = (async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return new Response(JSON.stringify({ items: [], total: 0, limit: 20, offset: 0, has_more: false }), { status: 200 })
    }) as typeof fetch
    const api = createAuthorsApi({ baseUrl: "https://api.example/", headers: () => ({}), fetch: fetchFake })
    await api.directory({ sort: "new" })
    await api.directory({ sort: "new", role: "writes" })
    expect(urls[0]).not.toContain("role=")
    expect(urls[1]).toContain("role=writes")
  })
})

describe("the upload form's 'I wrote this' tick reaches the server as by_author", () => {
  const input: SubmissionInput = { kind: "kiirtan", fileName: "a.mp3", fileUri: "blob:a", title: "T", author: "Priya Devi", styles: ["indian"], recordingType: "studio", performance: "solo", byAuthor: true, addedBy: "Priya", termsAccepted: true }

  async function bodyOf(source: UploadSource): Promise<Record<string, unknown>> {
    const calls: { url: string; body: unknown }[] = []
    const fetchFake = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body })
      if (String(url).endsWith("/uploads")) return new Response(JSON.stringify({ key: "k", method: "PUT", url: "https://r2.test/put", headers: {}, expires_at: "x", max_bytes: 1 }), { status: 200 })
      if (String(url) === "https://r2.test/put") return new Response(null, { status: 200 })
      return new Response(JSON.stringify({ id: "r1" }), { status: 200 })
    }) as unknown as typeof fetch
    await uploadSubmission({ baseUrl: "https://api.test/", headers: () => ({}), fetch: fetchFake }, source, { readBlob: async () => new Blob(["abc"]), sha256: async () => "ff" })
    return calls[calls.length - 1]!.body as Record<string, unknown>
  }
  const sourceOf = (sub: ReturnType<typeof buildSubmission>): UploadSource => ({ uri: "blob:a", fileName: "a.mp3", kind: sub.kind, title: sub.title, author: sub.author, byAuthor: Boolean(sub.byAuthor) })

  it("ticked: by_author true; not ticked: false", async () => {
    expect((await bodyOf(sourceOf(buildSubmission(input, 1)))).by_author).toBe(true)
    expect((await bodyOf(sourceOf(buildSubmission({ ...input, byAuthor: false }, 1)))).by_author).toBe(false)
  })

  it("never for Prabhat Samgiita, which has one author", async () => {
    expect(buildSubmission({ ...input, kind: "prabhat_samgiita", psSong: 1, byAuthor: true }, 1).byAuthor).toBe(false)
  })
})
