import { describe, expect, it } from "vitest"

import {
  displayNameFromEmail,
  friendlyPersonName,
  greetFirstName,
  looksLikeEmail,
  memberProfileName,
  profileAvatarInitial,
  profileDisplayLabel,
  resolveStoredDisplayName,
} from "@/lib/displayName"

describe("friendlyPersonName", () => {
  it("keeps a real person name", () => {
    expect(friendlyPersonName("Dewasheesh Rana", "dewasheesh.rana@gmail.com")).toBe(
      "Dewasheesh Rana",
    )
  })

  it("derives a name from the signed-in email when display_name is missing", () => {
    expect(friendlyPersonName("Apple member", "dewasheesh.rana@gmail.com")).toBe("Dewasheesh Rana")
    expect(friendlyPersonName(null, "dewasheesh@gmail.com")).toBe("Dewasheesh")
  })

  it("uses email for profile when Apple hid the name", () => {
    expect(
      memberProfileName({
        mode: "signed_in",
        email: "dewasheesh@gmail.com",
        displayName: "Apple member",
      }),
    ).toBe("Dewasheesh")
  })

  it("keeps a custom name after the member edits their profile", () => {
    expect(
      memberProfileName({
        mode: "signed_in",
        email: "dewasheesh@gmail.com",
        displayName: "Dewasheesh Rana",
        displayNameOverridden: true,
      }),
    ).toBe("Dewasheesh Rana")
  })

  it("detects email-shaped strings", () => {
    expect(looksLikeEmail("a@b.com")).toBe(true)
    expect(looksLikeEmail("Dewasheesh")).toBe(false)
  })

  it("uses first name from email for Namaskar greetings", () => {
    expect(greetFirstName("Apple member", "dewasheesh@gmail.com")).toBe("Dewasheesh")
    expect(greetFirstName(null, "dewasheesh.rana@gmail.com")).toBe("Dewasheesh")
  })

  it("ignores generic OAuth placeholder names and uses email instead", () => {
    expect(resolveStoredDisplayName("Apple member", "dewasheesh@gmail.com")).toBe("Dewasheesh")
    expect(profileDisplayLabel("Apple member", "dewasheesh@gmail.com", "signed_in")).toBe(
      "Dewasheesh",
    )
    expect(profileDisplayLabel("Apple member", null, "signed_in")).toBe("Tap to add your name")
    expect(profileAvatarInitial("Apple member", "dewasheesh@gmail.com", "signed_in")).toBe("D")
    expect(displayNameFromEmail("member@privaterelay.appleid.com")).toBe("Member")
  })
})

describe("greetFirstName with initials (BUG-26)", () => {
  it("does not greet an account called 'I M Dada' as 'I'", () => {
    expect(greetFirstName("I M Dada", null)).toBe("I M Dada")
    // Same name derived from the account email (i.m.dada@...).
    expect(greetFirstName(null, "i.m.dada@gmail.com")).toBe("I M Dada")
  })

  it("keeps the full name when the first token is an initial with a dot", () => {
    expect(greetFirstName("J. Rana", null)).toBe("J. Rana")
  })

  it("still uses only the first name when it is a real word", () => {
    expect(greetFirstName("Dewasheesh Rana", null)).toBe("Dewasheesh")
  })
})
