import React from "react"
import { render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SignInRedirect } from "@/components/sign-in-redirect"

const refresh = vi.fn()
const useMemberMock = vi.fn()
const syncEasyAuthSessionFromBrowser = vi.fn()

vi.mock("@/components/member-provider", () => ({
  useMember: () => useMemberMock(),
}))

vi.mock("@/lib/easy-auth-client", () => ({
  syncEasyAuthSessionFromBrowser: () => syncEasyAuthSessionFromBrowser(),
}))

describe("SignInRedirect", () => {
  afterEach(() => {
    refresh.mockReset()
    syncEasyAuthSessionFromBrowser.mockReset()
  })

  it("leaves /signin once the member session is authenticated", async () => {
    const replace = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, replace, search: "" },
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
      value: { ...window.location, replace, search: "" },
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

  it("syncs Easy Auth from the browser while the member session is still guest", async () => {
    const replace = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, replace, search: "" },
    })
    refresh.mockResolvedValue(undefined)
    syncEasyAuthSessionFromBrowser.mockResolvedValue(false)
    useMemberMock.mockReturnValue({
      loading: false,
      session: { authenticated: false },
      refresh,
    })

    render(<SignInRedirect next="/quiz" />)

    await waitFor(() => {
      expect(syncEasyAuthSessionFromBrowser).toHaveBeenCalled()
    })
    expect(replace).not.toHaveBeenCalled()
  })
})
