import { describe, expect, it } from "vitest"

import { subjectFromPrincipal } from "@/lib/oauthIdentity"
import { buildClientPrincipal } from "@/lib/principal"

describe("oauth identity helpers", () => {
  it("extracts the stable subject from a client principal", () => {
    const principal = buildClientPrincipal("google-subject-42", "Member", "google", "member@example.com")
    expect(subjectFromPrincipal(principal)).toBe("google-subject-42")
  })
})
