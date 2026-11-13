import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }))

import { copyrightEmail, DEFAULT_COPYRIGHT_EMAIL } from "@/lib/contactEmail"

describe("copyrightEmail", () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_COPYRIGHT_EMAIL
  })

  it("is the organisation's address, never a personal one", () => {
    expect(DEFAULT_COPYRIGHT_EMAIL).toBe("info@anandamarga.org")
    expect(copyrightEmail()).toBe("info@anandamarga.org")
  })

  it("can be changed by a build setting, but only to a real address", () => {
    process.env.EXPO_PUBLIC_COPYRIGHT_EMAIL = "rights@example.org"
    expect(copyrightEmail()).toBe("rights@example.org")
    process.env.EXPO_PUBLIC_COPYRIGHT_EMAIL = "not an address"
    expect(copyrightEmail()).toBe("info@anandamarga.org")
  })
})
