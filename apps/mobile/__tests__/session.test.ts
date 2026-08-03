import { afterEach, describe, expect, it, vi } from "vitest"
import { createApiClient } from "@prabhat/core"

import { identityFromIdToken } from "@/lib/msalToken"
import { buildMemberAuthHeaders } from "@/lib/principal"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe("member session + chat memory client", () => {
  it("parses an authenticated member session", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      Response.json({
        authenticated: true,
        id: "11111111-1111-1111-1111-111111111111",
        display_name: "Dewasheesh",
        email: "member@example.com",
        identity_provider: "aad",
        personalization_enabled: true,
        is_admin: false,
        favorite_song_numbers: [3, 2155],
      }),
    )
    const api = createApiClient({ baseUrl: "https://api.example.test" })
    const session = await api.fetchMemberSession()
    expect(session.authenticated).toBe(true)
    if (session.authenticated) {
      expect(session.favorite_song_numbers).toEqual([3, 2155])
    }
  })

  it("saves chat memory turns to the member API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ summary: "ok", recent_turns: [] }))
    globalThis.fetch = fetchMock
    const api = createApiClient({ baseUrl: "https://api.example.test" })
    await expect(
      api.saveMemberChat({
        song_number: 3,
        turns: [
          { role: "user", content: "Explain song 3" },
          { role: "assistant", content: "A song of light." },
        ],
      }),
    ).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/members/chat-memory",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("builds member headers with oid when provided", () => {
    const headers = buildMemberAuthHeaders("member@example.com", "Member", "proxy-key", "oid-123")
    expect(headers["X-Member-Proxy-Key"]).toBe("proxy-key")
    const json = Buffer.from(headers["X-MS-CLIENT-PRINCIPAL"], "base64").toString("utf8")
    expect(json).toContain("oid-123")
  })
})

describe("microsoft identity token parsing", () => {
  it("reads email and oid from a JWT payload", () => {
    const payload = Buffer.from(
      JSON.stringify({
        oid: "oid-abc",
        email: "member@example.com",
        name: "Member Name",
      }),
      "utf8",
    ).toString("base64url")
    const token = `hdr.${payload}.sig`
    expect(identityFromIdToken(token)).toEqual({
      id: "oid-abc",
      email: "member@example.com",
      displayName: "Member Name",
      idToken: token,
    })
  })
})
