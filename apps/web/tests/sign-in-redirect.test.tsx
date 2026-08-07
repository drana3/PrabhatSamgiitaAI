import React from "react"
import { render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SignInRedirect } from "@/components/sign-in-redirect"

const refresh = vi.fn()
const useMemberMock = vi.fn()

vi.mock("@/components/member-provider", () => ({
  useMember: () => useMemberMock(),
}))

describe("SignInRedirect", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    refresh.mockReset()
  })

  it("leaves /signin once the member session is authenticated", async () => {
    const replace = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, replace },
    })
    useMemberMock.mockReturnValue({
      loading: false,
      session: {
        authenticated: true,
        id: "aad:1",
        display_name: "A",
        identity_provider: "aad",
        personalization_enabled: true,
        favorite_song_numbers: [],
        is_admin: false,
      },
      refresh,
    })

    render(<SignInRedirect next="/account" />)

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/account")
    })
  })

  it("does not auto-redirect non-admins to admin destinations", async () => {
    const replace = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, replace },
    })
    useMemberMock.mockReturnValue({
      loading: false,
      session: {
        authenticated: true,
        id: "aad:1",
        display_name: "A",
        identity_provider: "aad",
        personalization_enabled: true,
        favorite_song_numbers: [],
        is_admin: false,
      },
      refresh,
    })

    render(<SignInRedirect next="/admin/feedback" />)

    await waitFor(() => {
      expect(refresh).not.toHaveBeenCalled()
    })
    expect(replace).not.toHaveBeenCalled()
  })

  it("leaves /signin when Easy Auth already has a principal even if member API is slow", async () => {
    const replace = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, replace },
    })
    refresh.mockResolvedValue(undefined)
    useMemberMock.mockReturnValue({
      loading: false,
      session: { authenticated: false },
      refresh,
    })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ clientPrincipal: { userId: "oid" } }),
    }))

    render(<SignInRedirect next="/quiz" />)

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/quiz")
    }, { timeout: 2000 })
  })
})
