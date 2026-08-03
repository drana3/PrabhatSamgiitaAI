import { afterEach, describe, expect, it, vi } from "vitest"

import { createApiClient } from "./api"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

function client(fetchImpl?: typeof fetch) {
  return createApiClient({
    baseUrl: "https://api.example.test",
    fetchImpl: fetchImpl ?? globalThis.fetch,
  })
}

describe("API client resilience (shared with website)", () => {
  it("keeps the catalog usable when GET /songs fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("error", { status: 503 }))
    await expect(client().fetchSongs()).resolves.toEqual([])
  })

  it("rejects malformed catalog data instead of rendering broken cards", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(Response.json([{ number: "one" }]))
    await expect(client().fetchSongs()).resolves.toEqual([])
  })

  it("blocks garbage search without making a request", async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock
    await expect(client().searchSongs("djcvjcvhjcvhjc")).rejects.toThrow(/Please ask something specific/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("surfaces a useful server search error", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ detail: "Search is warming up. Please retry." }, { status: 503 }))
    await expect(client().searchSongs("morning meditation")).rejects.toThrow("Search is warming up")
  })

  it("posts catalog mode by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([]))
    globalThis.fetch = fetchMock
    await client().searchSongs("morning devotion")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ query: "morning devotion", mode: "catalog" }),
      }),
    )
  })

  it("returns null for invalid today recommendation payloads", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(Response.json({ recommendations: "wrong" }))
    await expect(client().fetchTodayRecommendations()).resolves.toBeNull()
  })

  it("parses today recommendations with humanitarian context", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      Response.json({
        context: {
          recommendation_mode: "daily_reflection",
          humanitarian_context: "disaster",
          festival: null,
        },
        signals: [
          {
            title: "Flood alert",
            category: "disaster",
            summary: "Communities need care.",
            source_name: "NDMA",
            source_url: "https://example.test",
          },
        ],
        recommendations: [
          {
            number: 3,
            title: "A song",
            reasons: ["AMURT"],
            is_verified: true,
          },
        ],
        disclaimer: "Not authoritative.",
      }),
    )
    const today = await client().fetchTodayRecommendations()
    expect(today?.context.humanitarian_context).toBe("disaster")
    expect(today?.recommendations[0]?.number).toBe(3)
  })

  it("parses daily reflection book references", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      Response.json({
        quote_text: "Infinite happiness is ánanda (bliss).",
        attribution: "Shrii Shrii Anandamurti ji",
        source_title: "Ánanda Sútram",
        source_url: "https://www.sarkarverse.org/wiki/Ananda_Sutram",
        source_date: "1961 · Chapter 2, Sútra 3",
        context_label: "Daily spiritual reflection",
        verification_status: "source_verified",
      }),
    )
    const reflection = await client().fetchTodayReflection()
    expect(reflection?.source_title).toBe("Ánanda Sútram")
    expect(reflection?.source_date).toContain("1961")
  })

  it("surfaces voice search failures clearly", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ detail: "Voice search is warming up." }, { status: 503 }))
    await expect(client().searchSongsByVoice("morning meditation")).rejects.toThrow("Voice search is warming up")
  })

  it("returns empty testimonials on failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }))
    await expect(client().fetchTestimonials()).resolves.toEqual([])
  })

  it("returns the feedback acknowledgement", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      Response.json(
        { message: "Thank you for the thoughtful feedback.", feedback_id: "abc", status: "received" },
        { status: 201 },
      ),
    )
    await expect(
      client().submitFeedback({ category: "experience", rating: 5, comment: "Beautiful experience" }),
    ).resolves.toMatchObject({ message: expect.stringContaining("Thank you"), feedback_id: "abc" })
  })

  it("surfaces feedback rate limiting without losing the message", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ detail: "Please wait before sending more feedback." }, { status: 429 }))
    await expect(
      client().submitFeedback({ category: "experience", rating: 1, comment: "Needs work" }),
    ).rejects.toThrow("Please wait")
  })

  it("parses notation and localization payloads", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          song_number: 1,
          source_scale: "C",
          target_scale: "D",
          verification_status: "practice_draft",
          notation: {
            version: 1,
            source_scale: "C",
            tempo_bpm: null,
            tala: { name: "Kaharva", beats: 8, groups: [4, 4] },
            lines: [
              {
                line_number: 1,
                lyrics: "BANDHU HE NIYE CALO",
                measures: [
                  {
                    beats: [
                      {
                        beat: 1,
                        notes: [{ sargam: "S", western: "D4", duration: 1, octave: "middle" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          song_number: 1,
          language: "Hindi",
          localized_title: "बन्धु हे",
          localized_meaning: "हे प्रिय सखा",
          localized_explanation: null,
        }),
      )

    const notation = await client().fetchNotation(1, "D")
    expect(notation?.target_scale).toBe("D")
    expect(notation?.notation.lines[0]?.lyrics).toBe("BANDHU HE NIYE CALO")

    const localized = await client().fetchSongLocalization(1, "Hindi")
    expect(localized?.localized_meaning).toContain("प्रिय")
  })

  it("returns empty admin lists when unauthorized", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("deny", { status: 403 }))
    await expect(client().fetchAdminFeedback()).resolves.toEqual({ total: 0, items: [] })
    await expect(client().fetchAdminMembers()).resolves.toEqual([])
  })

  it("parses buffered SSE when response.body is unavailable (React Native)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
      text: async () => "data: A calm dawn song.\n\ndata: Source: Song 1\n\n",
    })
    const chunks: string[] = []
    await client().streamExplanation(1, (chunk) => chunks.push(chunk), "What is this song about?")
    expect(chunks).toEqual(["A calm dawn song.", "Source: Song 1"])
  })
})
