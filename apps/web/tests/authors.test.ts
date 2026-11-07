import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  authorDescription,
  authorJsonLd,
  authorPhotoUrl,
  authorRobots,
  authorTitle,
  authorUrl,
  fetchAuthorPage,
  fetchAuthorSitemap,
  formatDuration,
  isoDuration,
  jsonLdString,
  kindsSentence,
  languageName,
  safeHttpsUrl,
  siteOrigin,
  type AuthorProfile,
  type AuthorRecording,
} from "@/lib/authors"

function profile(over: Partial<AuthorProfile> = {}): AuthorProfile {
  return {
    slug: "demo-singer",
    display_name: "Demo Singer",
    author_type: "solo",
    bio: "Kiirtan singer.",
    about: "",
    country: "Poland",
    city: "Warsaw",
    languages: ["english"],
    links: [],
    verified: false,
    kinds: [
      { kind: "kiirtan", count: 3 },
      { kind: "bhajan", count: 1 },
    ],
    recordings_count: 4,
    collections_count: 0,
    photo_url: "/api/v1/authors/demo-singer/photo?v=2",
    published_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
    stats: null,
    indexable: true,
    ...over,
  }
}

function recording(over: Partial<AuthorRecording> = {}): AuthorRecording {
  return {
    id: "r1",
    kind: "kiirtan",
    title: "Baba Nam Kevalam",
    duration_sec: 205,
    audio_url: "https://cdn.example/a.mp3",
    language: "sanskrit",
    year: 2024,
    ps_song_number: null,
    published_at: null,
    ...over,
  }
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://site.example/")
  vi.stubEnv("API_BASE_URL", "http://api.internal:8000")
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("addresses", () => {
  it("builds the canonical address from the site origin", () => {
    expect(siteOrigin()).toBe("https://site.example")
    expect(authorUrl("demo-singer")).toBe("https://site.example/author/demo-singer")
  })

  it("falls back to the default origin when the setting is not a URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url")
    expect(siteOrigin()).toBe("https://www.prabhatasamgiita.org")
  })

  it("makes the picture address one a visitor's browser can reach", () => {
    expect(authorPhotoUrl("/api/v1/authors/x/photo?v=1")).toBe("https://api.example/api/v1/authors/x/photo?v=1")
    expect(authorPhotoUrl("https://img.example/p.jpg")).toBe("https://img.example/p.jpg")
    expect(authorPhotoUrl(null)).toBeNull()
  })
})

describe("search-engine rules", () => {
  it("lists only an indexable profile", () => {
    expect(authorRobots(true)).toEqual({ index: true, follow: true })
    expect(authorRobots(false)).toEqual({ index: false, follow: false })
  })

  it("names the page by the author and what they sing", () => {
    expect(kindsSentence([{ kind: "kiirtan", count: 2 }, { kind: "bhajan", count: 1 }, { kind: "prabhat_samgiita", count: 4 }])).toBe(
      "Kiirtans, bhajans and Prabhat Samgiita",
    )
    expect(authorTitle(profile())).toBe("Demo Singer: Kiirtans and bhajans | Prabhat Samgiita")
    expect(authorTitle(profile({ kinds: [] }))).toBe("Demo Singer | Prabhat Samgiita")
  })

  it("uses the bio, cut to a snippet, else a plain sentence", () => {
    expect(authorDescription(profile())).toBe("Kiirtan singer.")
    expect(authorDescription(profile({ bio: "x".repeat(300) })).length).toBeLessThanOrEqual(200)
    expect(authorDescription(profile({ bio: "" }))).toContain("Listen to 4 recordings by Demo Singer")
    expect(authorDescription(profile({ bio: "", recordings_count: 0, kinds: [] }))).toBe("Demo Singer on Prabhat Samgiita.")
  })

  it("writes durations in ISO 8601 and on screen", () => {
    expect(isoDuration(205)).toBe("PT3M25S")
    expect(isoDuration(119.6)).toBe("PT2M0S")
    expect(isoDuration(null)).toBeUndefined()
    expect(isoDuration(0)).toBeUndefined()
    expect(formatDuration(205)).toBe("3:25")
    expect(formatDuration(119.6)).toBe("2:00")
    expect(formatDuration(null)).toBe("")
  })
})

describe("links", () => {
  it("drops everything that is not https", () => {
    expect(safeHttpsUrl("https://example.com/a")).toBe("https://example.com/a")
    expect(safeHttpsUrl("javascript:alert(1)")).toBeNull()
    expect(safeHttpsUrl("http://example.com")).toBeNull()
    expect(safeHttpsUrl("data:text/html,x")).toBeNull()
    expect(safeHttpsUrl("not a url")).toBeNull()
  })
})

describe("JSON-LD", () => {
  it("describes a solo singer as a Person with recordings that point back at them", () => {
    const data = authorJsonLd(
      profile({ links: [{ kind: "youtube", url: "https://youtube.com/@x", rel: "" }, { kind: "website", url: "javascript:alert(1)", rel: "" }] }),
      [recording()],
    ) as { "@graph": Record<string, unknown>[] }
    const graph = data["@graph"]
    const person = graph.find((n) => n["@type"] === "Person")!
    expect(person.name).toBe("Demo Singer")
    expect(person.sameAs).toEqual(["https://youtube.com/@x"])
    const track = graph.find((n) => n["@type"] === "MusicRecording")!
    expect(track.byArtist).toEqual({ "@id": "https://site.example/author/demo-singer#author" })
    expect(track.duration).toBe("PT3M25S")
    expect(track.inLanguage).toBe("sa")
    expect(graph.some((n) => n["@type"] === "ProfilePage")).toBe(true)
  })

  it("describes a group as a MusicGroup", () => {
    const data = authorJsonLd(profile({ author_type: "group" }), []) as { "@graph": Record<string, unknown>[] }
    expect(data["@graph"].some((n) => n["@type"] === "MusicGroup")).toBe(true)
    expect(data["@graph"].some((n) => n["@type"] === "Person")).toBe(false)
  })

  it("can never close the script tag", () => {
    const text = jsonLdString(authorJsonLd(profile({ display_name: "</script><script>alert(1)</script> & co " }), []))
    expect(text).not.toContain("</script>")
    expect(text).not.toContain("<")
    expect(text).not.toContain(" ")
    expect(JSON.parse(text)["@graph"][1].name).toBe("</script><script>alert(1)</script> & co ")
  })
})

describe("names that carry HTML (QA)", () => {
  const evil = `<img src=x onerror=alert(1)> & "q" </script>`

  it("serialises every field with JSON.stringify and escapes < > & so nothing can leave the script tag", () => {
    const data = authorJsonLd(
      profile({ display_name: evil, bio: evil, city: evil, country: evil }),
      [recording({ title: evil })],
    )
    const text = jsonLdString(data)
    expect(text).not.toMatch(/[<>&]/)
    expect(text).toContain("\\u003cimg")
    // and it is still the same data after the browser reads it
    const back = JSON.parse(text) as { "@graph": Record<string, unknown>[] }
    expect(back["@graph"].find((n) => n["@type"] === "Person")?.name).toBe(evil)
    expect(back["@graph"].find((n) => n["@type"] === "MusicRecording")?.name).toBe(evil)
  })

  it("keeps the language written by the author as text, not markup, in the data", () => {
    expect(languageName("<b>other</b>")).toBe("<b>other</b>") // React escapes it where it is shown
    const text = jsonLdString(authorJsonLd(profile(), [recording({ language: "<b>x</b>" })]))
    expect(text).not.toContain("<b>")
    expect(text).not.toContain("inLanguage") // an unknown language is left out, never copied in
  })
})

describe("reading the API", () => {
  function answer(map: Record<string, { status: number; body?: unknown }>) {
    const fetchMock = vi.fn(async (url: string) => {
      const hit = Object.entries(map).find(([path]) => url.includes(path))
      const { status, body } = hit?.[1] ?? { status: 404 }
      return { status, json: async () => body } as unknown as Response
    })
    vi.stubGlobal("fetch", fetchMock)
    return fetchMock
  }

  it("returns the profile with its recordings and playlists", async () => {
    const fetchMock = answer({
      "/authors/demo-singer/recordings": { status: 200, body: { items: [recording()] } },
      "/authors/demo-singer/collections": { status: 200, body: { items: [] } },
      "/authors/demo-singer": { status: 200, body: profile() },
    })
    const data = await fetchAuthorPage("demo-singer")
    expect(data.kind).toBe("profile")
    if (data.kind === "profile") expect(data.recordings).toHaveLength(1)
    expect(fetchMock.mock.calls[0]![0]).toBe("http://api.internal:8000/api/v1/authors/demo-singer")
  })

  it("asks to redirect when the address moved", async () => {
    answer({ "/authors/old": { status: 301, body: { code: "moved", slug: "new" } } })
    expect(await fetchAuthorPage("old")).toEqual({ kind: "moved", slug: "new" })
  })

  it("tells gone, missing and broken apart", async () => {
    answer({ "/authors/a": { status: 410 }, "/authors/b": { status: 404 }, "/authors/c": { status: 500 } })
    expect((await fetchAuthorPage("a")).kind).toBe("gone")
    expect((await fetchAuthorPage("b")).kind).toBe("missing")
    expect((await fetchAuthorPage("c")).kind).toBe("error")
  })

  it("treats an unreachable API as an error, not as a missing page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down") }))
    expect((await fetchAuthorPage("x")).kind).toBe("error")
    expect(await fetchAuthorSitemap()).toEqual([])
  })

  it("reads the sitemap list", async () => {
    answer({ "/authors/sitemap": { status: 200, body: { items: [{ slug: "a", updated_at: "2026-01-01T00:00:00Z" }] } } })
    expect(await fetchAuthorSitemap()).toEqual([{ slug: "a", updated_at: "2026-01-01T00:00:00Z" }])
  })
})
