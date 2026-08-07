import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { buildClientPrincipal, parseClientPrincipalProfile } from "@/lib/azure-principal"
import { memberSessionIsAdmin } from "@/lib/member-admin-proxy"
import { GET, POST } from "@/app/api/member/[...path]/route"

describe("database-backed member source of truth", () => {
  const originalProxyKey = process.env.MEMBER_PROXY_KEY
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    if (originalProxyKey === undefined) delete process.env.MEMBER_PROXY_KEY
    else process.env.MEMBER_PROXY_KEY = originalProxyKey
    process.env.NODE_ENV = originalNodeEnv
    vi.unstubAllGlobals()
  })

  it("does not infer admin from Azure principal email alone", () => {
    const principal = buildClientPrincipal("user-oid-42", "owner@example.com")
    const profile = parseClientPrincipalProfile(principal)
    expect(profile?.is_admin).toBe(false)
  })

  it("uses API is_admin for admin middleware decisions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true, is_admin: true }),
    }))
    const request = { url: "https://example.test/admin/feedback", headers: { get: () => null } } as never
    await expect(memberSessionIsAdmin(request)).resolves.toBe(true)
  })

  it("proxies chat-memory reads for signed-in members (device B restore path)", async () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    process.env.NODE_ENV = "production"
    const principal = buildClientPrincipal("user-oid-42", "member@example.com")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      summary: "",
      recent_turns: [
        { role: "user", content: "Explain PS 135" },
        { role: "assistant", content: "PS 135 is about inner light." },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } })))

    const response = await GET(
      new NextRequest("https://example.test/api/member/chat-memory?song_number=135", {
        headers: { "x-ms-client-principal": principal },
      }),
      { params: Promise.resolve({ path: ["chat-memory"] }) },
    )
    const body = await response.json()

    expect(body.recent_turns).toEqual([
      { role: "user", content: "Explain PS 135" },
      { role: "assistant", content: "PS 135 is about inner light." },
    ])
  })

  it("proxies chat-memory writes so database remains canonical", async () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    process.env.NODE_ENV = "production"
    const principal = buildClientPrincipal("user-oid-42", "member@example.com")
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      summary: "often explores meaning",
      recent_turns: [],
    }), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)

    const response = await POST(
      new NextRequest("https://example.test/api/member/chat-memory", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ms-client-principal": principal,
        },
        body: JSON.stringify({
          song_number: 135,
          turns: [
            { role: "user", content: "What is this song about?" },
            { role: "assistant", content: "A song of light." },
          ],
        }),
      }),
      { params: Promise.resolve({ path: ["chat-memory"] }) },
    )

    expect(response.status).toBe(200)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/members/chat-memory")
  })
})
