import { describe, expect, it } from "vitest"

import { friendlyPersonName, greetFirstName, looksLikeEmail } from "@/lib/displayName"

describe("friendlyPersonName", () => {
  it("keeps a real person name", () => {
    expect(friendlyPersonName("Dewasheesh Rana", "dewasheesh.rana@gmail.com")).toBe(
      "Dewasheesh Rana",
    )
  })

  it("derives a name from an email when display_name is the address", () => {
    expect(friendlyPersonName("dewasheesh.rana@gmail.com", "dewasheesh.rana@gmail.com")).toBe(
      "Dewasheesh Rana",
    )
  })

  it("falls back to email local part when display name is empty", () => {
    expect(friendlyPersonName(null, "seeker_one@example.com")).toBe("Seeker One")
  })

  it("detects email-shaped strings", () => {
    expect(looksLikeEmail("a@b.com")).toBe(true)
    expect(looksLikeEmail("Dewasheesh")).toBe(false)
  })

  it("uses first name for Namaskar greetings", () => {
    expect(greetFirstName("Dewasheesh Rana", "dewasheesh.rana@gmail.com")).toBe("Dewasheesh")
    expect(greetFirstName("dewasheesh.rana@gmail.com", "dewasheesh.rana@gmail.com")).toBe(
      "Dewasheesh",
    )
  })
})
