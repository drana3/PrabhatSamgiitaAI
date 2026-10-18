import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { buildClientPrincipal } from "@/lib/azure-principal"
import {
  clearGuestChatStorage,
  restoreConversation,
  songChatStorageKey,
  storedMemberConversationMs,
} from "@/lib/chat"
import { GET, POST } from "@/app/api/member/[...path]/route"

/**
 * Regression journeys that previously failed in production:
 * 1) Azure signed-in + member API down looked signed-out → Sign in / Save song bounce
 * 2) Sign-out wiped companion cache → chat lost after sign-in
 * 3) Favorites writes must not be silently available without member backend
 */
describe("member auth journeys", () => {
  const originalProxyKey = process.env.MEMBER_PROXY_KEY
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    if (originalProxyKey === undefined) delete process.env.MEMBER_PROXY_KEY
    else process.env.MEMBER_PROXY_KEY = originalProxyKey
    process.env.NODE_ENV = originalNodeEnv
    vi.unstubAllGlobals()
    window.sessionStorage.clear()
  })

  it("keeps Azure users signed-in in session when member API is down (no Sign in loop)", async () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    process.env.NODE_ENV = "production"
    const principal = buildClientPrincipal("user-oid-42", "member@example.com")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: "upstream down" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )))

    const response = await GET(
      new NextRequest("https://example.test/api/member/session", {
        headers: { "x-ms-client-principal": principal },
      }),
      { params: Promise.resolve({ path: ["session"] }) },
    )
    const body = await response.json()

    expect(body.authenticated).toBe(true)
    // Proxy key is configured, so Save song / admin writes should still be attempted.
    expect(body.member_backend).toBe(true)
    // UI should show account menu, not Sign in → /signin → redirect bounce.
    expect(body.display_name || body.email).toBeTruthy()
  })

  it("blocks favorite writes when member backend is unavailable instead of faking success", async () => {
    delete process.env.MEMBER_PROXY_KEY
    process.env.NODE_ENV = "production"
    const principal = buildClientPrincipal("user-oid-42", "member@example.com")

    const session = await GET(
      new NextRequest("https://example.test/api/member/session", {
        headers: { "x-ms-client-principal": principal },
      }),
      { params: Promise.resolve({ path: ["session"] }) },
    )
    expect((await session.json()).member_backend).toBe(false)

    const write = await POST(
      new NextRequest("https://example.test/api/member/favorites", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ms-client-principal": principal,
        },
        body: JSON.stringify({ song_number: 135 }),
      }),
      { params: Promise.resolve({ path: ["favorites"] }) },
    )
    expect(write.status).toBe(503)
  })

  it("preserves member companion chat across guest cleanup used on sign-out", () => {
    const memberKey = songChatStorageKey(135, true, "aad:user-1")
    const turns = [
      { role: "user" as const, text: "Explain this song", createdAt: Date.now() - 1000 },
      { role: "assistant" as const, text: "A lasting companion answer", createdAt: Date.now() },
    ]
    window.sessionStorage.setItem(memberKey, JSON.stringify(turns))
    window.sessionStorage.setItem(
      songChatStorageKey(135, false),
      JSON.stringify([{ role: "user", text: "guest", createdAt: Date.now() }]),
    )

    // Sign-out path must only clear guest keys.
    clearGuestChatStorage()

    const restored = restoreConversation(
      window.sessionStorage.getItem(memberKey),
      Date.now(),
      storedMemberConversationMs,
    )
    expect(restored.map((turn) => turn.text)).toEqual([
      "Explain this song",
      "A lasting companion answer",
    ])
    expect(window.sessionStorage.getItem(songChatStorageKey(135, false))).toBeNull()
  })

  it("restores live member favorites session when the member API is healthy", async () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    process.env.NODE_ENV = "production"
    const principal = buildClientPrincipal("user-oid-42", "member@example.com")
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        authenticated: true,
        id: "aad:user-oid-42",
        display_name: "Member",
        email: "member@example.com",
        identity_provider: "aad",
        personalization_enabled: true,
        favorite_song_numbers: [],
        is_admin: false,
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([135]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })))

    const session = await GET(
      new NextRequest("https://example.test/api/member/session", {
        headers: { "x-ms-client-principal": principal },
      }),
      { params: Promise.resolve({ path: ["session"] }) },
    )
    expect(await session.json()).toMatchObject({
      authenticated: true,
      member_backend: true,
    })

    const write = await POST(
      new NextRequest("https://example.test/api/member/favorites", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ms-client-principal": principal,
        },
        body: JSON.stringify({ song_number: 135 }),
      }),
      { params: Promise.resolve({ path: ["favorites"] }) },
    )
    expect(write.status).toBe(200)
    expect(await write.json()).toEqual([135])
  })
})
