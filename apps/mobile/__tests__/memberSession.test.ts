import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  __testing,
  adoptTokenResponse,
  bearerHeaders,
  clearMemberTokens,
  currentMemberTokens,
  ensureFreshAccessToken,
  exchangeProviderProof,
  hydrateMemberSession,
  revokeMemberSession,
  saveMemberTokens,
  type TokenStore,
} from "@/lib/memberSession"

const BASE = "https://api.example.test"

function memoryStore(initial: string | null = null) {
  const state = { value: initial }
  const store: TokenStore = {
    read: async () => state.value,
    write: async (value) => {
      state.value = value
    },
    remove: async () => {
      state.value = null
    },
  }
  return { state, store }
}

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

const pair = (suffix: string, expiresIn = 3600) => ({
  access_token: `access-${suffix}`,
  refresh_token: `refresh-${suffix}`,
  expires_in: expiresIn,
  account_id: "acc-1",
})

let clock = 1_000_000
let storage = memoryStore()

beforeEach(() => {
  __testing.reset()
  clock = 1_000_000
  storage = memoryStore()
  __testing.useStore(storage.store)
  __testing.useClock(() => clock)
})

describe("member session tokens", () => {
  it("sends no header when there are no tokens", () => {
    expect(bearerHeaders()).toEqual({})
  })

  it("keeps tokens in secure storage and reads them back after a restart", async () => {
    await adoptTokenResponse(pair("1"))
    expect(bearerHeaders()).toEqual({ Authorization: "Bearer access-1" })
    expect(storage.state.value).toContain("refresh-1")

    __testing.reset()
    __testing.useStore(storage.store)
    expect(bearerHeaders()).toEqual({})
    await hydrateMemberSession()
    expect(bearerHeaders()).toEqual({ Authorization: "Bearer access-1" })
  })

  it("treats a damaged stored value as signed out", async () => {
    __testing.useStore(memoryStore("{not json").store)
    expect(await hydrateMemberSession()).toBeNull()
    __testing.useStore(memoryStore(JSON.stringify({ accessToken: 5 })).store)
    expect(await hydrateMemberSession()).toBeNull()
  })

  it("a sign-in answer without tokens drops the previous person's tokens", async () => {
    await adoptTokenResponse(pair("1"))
    await adoptTokenResponse({ access_token: null })
    expect(currentMemberTokens()).toBeNull()
    expect(storage.state.value).toBeNull()
  })
})

describe("exchange", () => {
  it("trades the provider proof for tokens and stores them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, pair("x")))
    __testing.useFetch(fetchMock as unknown as typeof fetch)
    const tokens = await exchangeProviderProof(BASE, { provider: "google", idToken: "g.jwt" })
    expect(tokens?.accessToken).toBe("access-x")
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/api/v1/members/session/exchange`)
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      provider: "google",
      id_token: "g.jwt",
    })
    expect(bearerHeaders()).toEqual({ Authorization: "Bearer access-x" })
  })

  it("clears the previous account's tokens even when the exchange fails", async () => {
    await adoptTokenResponse(pair("old"))
    __testing.useFetch(vi.fn().mockResolvedValue(jsonResponse(401)) as unknown as typeof fetch)
    expect(await exchangeProviderProof(BASE, { provider: "apple", idToken: "a.jwt" })).toBeNull()
    expect(currentMemberTokens()).toBeNull()
  })

  it("does nothing without a proof and survives a network error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"))
    __testing.useFetch(fetchMock as unknown as typeof fetch)
    expect(await exchangeProviderProof(BASE, { provider: "google" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await exchangeProviderProof(BASE, { provider: "google", idToken: "x" })).toBeNull()
  })
})

describe("refresh", () => {
  it("does not refresh a token that is still fresh", async () => {
    await adoptTokenResponse(pair("1"))
    const fetchMock = vi.fn()
    __testing.useFetch(fetchMock as unknown as typeof fetch)
    await ensureFreshAccessToken(BASE)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refreshes close to expiry, once for many callers at the same time", async () => {
    await adoptTokenResponse(pair("1", 3600))
    clock += 3_500_000 // 100 s left, inside the early-refresh window
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, pair("2")))
    __testing.useFetch(fetchMock as unknown as typeof fetch)
    const results = await Promise.all([
      ensureFreshAccessToken(BASE),
      ensureFreshAccessToken(BASE),
      ensureFreshAccessToken(BASE),
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(results.every((r) => r?.accessToken === "access-2")).toBe(true)
    expect(JSON.parse(storage.state.value as string).refreshToken).toBe("refresh-2")
  })

  it("signs the person out of this phone when the server refuses the refresh token", async () => {
    await adoptTokenResponse(pair("1", 60))
    __testing.useFetch(vi.fn().mockResolvedValue(jsonResponse(401)) as unknown as typeof fetch)
    expect(await ensureFreshAccessToken(BASE)).toBeNull()
    expect(currentMemberTokens()).toBeNull()
    expect(storage.state.value).toBeNull()
  })

  it("keeps the tokens when the network or the server is down", async () => {
    await adoptTokenResponse(pair("1", 60))
    __testing.useFetch(vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch)
    expect((await ensureFreshAccessToken(BASE))?.accessToken).toBe("access-1")
    __testing.useFetch(vi.fn().mockResolvedValue(jsonResponse(503)) as unknown as typeof fetch)
    expect((await ensureFreshAccessToken(BASE, true))?.accessToken).toBe("access-1")
  })
})

describe("sign-out", () => {
  it("forgets the tokens at once and tells the server in the background", async () => {
    await saveMemberTokens({
      accessToken: "a",
      refreshToken: "r",
      expiresAt: clock + 3_600_000,
      accountId: null,
    })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200))
    __testing.useFetch(fetchMock as unknown as typeof fetch)
    const done = revokeMemberSession(BASE)
    expect(currentMemberTokens()).toBeNull()
    await done
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/api/v1/members/session/revoke`)
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer a" })
    await clearMemberTokens()
  })

  it("still signs out locally when the server cannot be reached", async () => {
    await adoptTokenResponse(pair("1"))
    __testing.useFetch(vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch)
    await revokeMemberSession(BASE)
    expect(currentMemberTokens()).toBeNull()
  })
})
