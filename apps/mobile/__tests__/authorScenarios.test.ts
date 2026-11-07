import { describe, expect, it, vi } from "vitest"

import { DEMO_AUTHORS } from "@/lib/fixtures/authors"

vi.mock("@/lib/fixtures/authorsGate", () => ({ sampleAuthors: () => DEMO_AUTHORS }))

import { createDemoApi } from "@/lib/authors/demo"
import { draftFromOwner, emptyDraft, invalidFieldKeys, isDirty, toCreateInput, toPatch, validateDraft, withName, withSlug } from "@/lib/authors/draft"
import { errorKey } from "@/lib/authors/slug"
import { NetworkError, RemoteError } from "@/lib/kirtan/remote"

// the same mapping as stores/authorStore.errorKeyOf (that file pulls in the whole app, so it is not loaded here)
const errorKeyOf = (e: unknown) => (e instanceof NetworkError ? errorKey({ network: true }) : e instanceof RemoteError ? errorKey({ code: e.code, status: e.status }) : errorKey({}))

const input = { slug: "my-page", display_name: "My Page", author_type: "solo" as const, bio: "", about: "", country: null, city: null, languages: [], links: [], claimed_name: null, include_uploads: "all" as const, show_stats: true, publish: false }

describe("the link follows the name", () => {
  it("is made from the name until the person types in the link field", () => {
    let d = withName(emptyDraft(), "Priya Devi")
    expect(d.slug).toBe("priya-devi")
    d = withSlug(d, "priya-music")
    d = withName(d, "Priya Devi Kiirtan")
    expect(d.slug).toBe("priya-music")
  })
  it("an empty name has no link and both are reported, name first", () => {
    const d = emptyDraft()
    expect(invalidFieldKeys(validateDraft(d), false)).toEqual(["name", "slug"])
  })
  it("a good name with a taken link points at the link field", () => {
    const d = withName(emptyDraft(), "Priya Devi")
    expect(invalidFieldKeys(validateDraft(d), false)).toEqual(["slug"])
    expect(invalidFieldKeys(validateDraft(d), true)).toEqual([])
  })
  it("lists the fields top to bottom", () => {
    const d = { ...withName(emptyDraft(), "Priya"), bio: "x".repeat(400), about: "y".repeat(5000), links: [{ kind: "website" as const, url: "" }] }
    expect(invalidFieldKeys(validateDraft(d), true)).toEqual(["bio", "about", "links"])
  })
})

describe("the personal page, every state", () => {
  it("create, edit, photo add and remove, claim a name, publish, hide, delete", async () => {
    const api = createDemoApi()
    const made = await api.create({ ...input, claimed_name: "Dharmacakra Kiirtan" })
    expect(made.claimed_name).toBe("Dharmacakra Kiirtan")
    expect(made.photo_url).toBeNull()
    expect((await api.putPhoto(new Blob(["x"]), "image/jpeg")).photo_url).toMatch(/^data:image/)
    expect((await api.removePhoto()).photo_url).toBeNull()
    const draft = { ...draftFromOwner(made), bio: "Hello" }
    expect(isDirty(draft, made)).toBe(true)
    expect(toPatch(draft, made)).toEqual({ bio: "Hello" })
    expect((await api.update(toPatch(draft, made))).bio).toBe("Hello")
    expect((await api.publish()).status).toBe("published")
    expect((await api.directory({})).items.some((a) => a.slug === "my-page")).toBe(true) // a published page is in the catalog
    expect((await api.unpublish()).status).toBe("draft")
    expect((await api.directory({})).items.some((a) => a.slug === "my-page")).toBe(false) // hidden: out of the catalog
    await api.remove()
    expect((await api.mine()).profile).toBeNull()
  })

  it("link and unlink a recording (shown on the page or not)", async () => {
    const api = createDemoApi()
    await api.create(input)
    const first = (await api.myRecordings()).items[0]!
    expect(first.shown).toBe(true)
    await api.setShown(first.recording.id, false)
    const after = (await api.myRecordings()).items.find((r) => r.recording.id === first.recording.id)!
    expect(after.shown).toBe(false)
    expect(after.exception).toBe(true)
    await api.setShown(first.recording.id, true)
    expect((await api.myRecordings()).items.find((r) => r.recording.id === first.recording.id)!.shown).toBe(true)
  })

  it("verified, suspended, reported and waiting for review are states of the owner's page", async () => {
    const api = createDemoApi()
    api.control.setMine({ status: "published", verified: true })
    expect((await api.mine()).profile?.verified).toBe(true)
    api.control.setMine({ status: "suspended", suspended_reason: "Copyright complaint" })
    expect((await api.mine()).profile?.status).toBe("suspended")
    api.control.setMine({ status: "draft", review_needed: true, review_reason: "reported:impersonation" })
    expect((await api.mine()).profile?.review_reason).toBe("reported:impersonation")
    api.control.setBlocked("Spam")
    expect(await api.mine()).toMatchObject({ can_create: false, suspended_reason: "Spam" })
  })

  it("small listener state and empty states", async () => {
    const api = createDemoApi()
    api.control.setStats("small")
    const small = await api.myStats(30)
    expect(small.public_enough_data).toBe(false)
    expect(small.total_plays).toBeLessThan(10)
    api.control.setStats("empty")
    expect((await api.myStats(7)).top_recordings).toEqual([])
    api.control.setRecordings("none")
    expect((await api.myRecordings()).total).toBe(0)
  })

  it("errors: a failing call fails once, then works; the sentence says what happened", async () => {
    const api = createDemoApi()
    api.control.failNext("create", "network")
    const failure = await api.create(input).catch((e: unknown) => e)
    expect(errorKeyOf(failure)).toBe("authors.error.network")
    expect(errorKeyOf(await Promise.reject(new Error("x")).catch((e: unknown) => e))).toBe("authors.error.generic")
    expect((await api.create(input)).slug).toBe("my-page")
    api.control.failNext("publish", "slug_cooldown")
    expect(errorKeyOf(await api.publish().catch((e: unknown) => e))).toBe("authors.error.slug_cooldown")
  })

  it("public lookups: a moved address, a deleted page, an unknown page", async () => {
    const api = createDemoApi()
    api.control.setLookup("old-name", { moved: "priya-devi" })
    api.control.setLookup("gone-name", "gone")
    expect(await api.profile("old-name")).toEqual({ kind: "moved", slug: "priya-devi" })
    expect(await api.profile("gone-name")).toEqual({ kind: "gone" })
    expect(await api.profile("nobody-here")).toEqual({ kind: "missing" })
  })

  it("reports: received, then already reported", async () => {
    const api = createDemoApi()
    expect((await api.report("priya-devi", { reason: "spam" })).status).toBe("received")
    api.control.setReport("already_reported")
    expect((await api.report("priya-devi", { reason: "spam" })).status).toBe("already_reported")
  })

  it("reset puts the demo back", async () => {
    const api = createDemoApi()
    api.control.setMine({ status: "published" })
    api.control.setBlocked("x")
    api.control.reset()
    expect(await api.mine()).toEqual({ profile: null, can_create: true, suspended_reason: null })
  })
})

describe("the catalog filters", () => {
  it("by kind, by language and both, with the counts of the sample recordings", async () => {
    const api = createDemoApi()
    const all = await api.directory({})
    const bhajan = await api.directory({ kind: "bhajan" })
    expect(bhajan.items.length).toBeGreaterThan(0)
    expect(bhajan.items.length).toBeLessThan(all.items.length)
    const spanish = await api.directory({ language: "spanish" })
    expect(spanish.items.map((a) => a.slug)).toContain("dharmacakra")
    expect((await api.directory({ kind: "bhajan", language: "spanish" })).items).toEqual([])
    expect((await api.directory({ sort: "name" })).items.map((a) => a.display_name)).toEqual([...all.items.map((a) => a.display_name)].sort((a, b) => a.localeCompare(b)))
  })
  it("the input of a new page never carries an empty link", () => {
    const d = withName(emptyDraft(), "Priya Devi")
    expect(toCreateInput(d, false).slug).toBe("priya-devi")
  })
})
