import { describe, expect, it } from "vitest"

import {
  PROFILE_ROUTES,
  PROFILE_ROUTE_READY,
  assistantLimitLabel,
  buildProfileIdentity,
  formatStorage,
  isRouteReady,
  reviewStyleRowValue,
  storageRowValue,
  versionLabel,
} from "@/lib/profileSheet"

describe("profile sheet: identity", () => {
  it("shows a guest without status strings", () => {
    const id = buildProfileIdentity({ mode: "guest", displayName: "Guest", email: null })
    expect(id.signedIn).toBe(false)
    expect(id.title).toBe("Guest")
    expect(id.initial).toBe("G")
    expect(id.subtitle ?? "").not.toMatch(/synced|apple|saved ·/i)
  })

  it("shows name, email and an initial for a member", () => {
    const id = buildProfileIdentity({ mode: "signed_in", displayName: "Anand Kumar", email: "a@b.org" })
    expect(id).toMatchObject({ signedIn: true, title: "Anand Kumar", subtitle: "a@b.org", initial: "A" })
  })

  it("never uses an email or an OAuth placeholder as the name", () => {
    const fromEmail = buildProfileIdentity({
      mode: "signed_in",
      displayName: "dewasheesh.rana@gmail.com",
      email: "dewasheesh.rana@gmail.com",
    })
    expect(fromEmail.title).toBe("Dewasheesh Rana")
    const placeholder = buildProfileIdentity({ mode: "signed_in", displayName: "Apple member", email: null })
    expect(placeholder.title).not.toMatch(/member/i)
    expect(placeholder.initial).toMatch(/^[A-Z]$/)
  })
})

describe("profile sheet: storage row", () => {
  it("formats decimal megabytes", () => {
    expect(formatStorage(0)).toBe("0 MB")
    expect(formatStorage(null)).toBe("0 MB")
    expect(formatStorage(40_000)).toBe("<0.1 MB")
    expect(formatStorage(3_700_000)).toBe("3.7 MB")
    expect(formatStorage(48_400_000)).toBe("48 MB")
    expect(formatStorage(2_300_000_000)).toBe("2.3 GB")
  })

  it("says Nothing saved when there are no files", () => {
    expect(storageRowValue(0, 0)).toBe("Nothing saved")
    expect(storageRowValue(7_400_000, 2)).toBe("7.4 MB")
  })
})

describe("profile sheet: rows", () => {
  it("names the review style with its spec label", () => {
    expect(reviewStyleRowValue("simple")).toBe("Simple steps")
    expect(reviewStyleRowValue("daily")).toBe("Daily practice")
  })

  it("only links to screens that exist", () => {
    expect(isRouteReady(PROFILE_ROUTES.signIn)).toBe(true)
    expect(isRouteReady(PROFILE_ROUTES.reviewStyle)).toBe(true)
    expect(isRouteReady(PROFILE_ROUTES.scriptAndTranslations)).toBe(true)
    expect(Object.keys(PROFILE_ROUTE_READY).sort()).toEqual([...Object.values(PROFILE_ROUTES)].sort())
  })

  it("states the daily assistant limit and the version", () => {
    expect(assistantLimitLabel(true, 15, 50)).toBe("50 a day")
    expect(assistantLimitLabel(false, 15, 50)).toBe("15 a day")
    expect(versionLabel("2.0.8")).toBe("Version 2.0.8")
  })
})
