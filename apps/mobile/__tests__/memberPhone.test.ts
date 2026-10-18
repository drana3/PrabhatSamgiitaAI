import { describe, expect, it } from "vitest"

import { memberPhoneRequired } from "@/lib/memberPhone"

describe("memberPhoneRequired", () => {
  it("skips phone for OAuth providers even when API marks it required", () => {
    for (const provider of ["apple", "google", "aad", "facebook", "entra"] as const) {
      expect(
        memberPhoneRequired(
          { phone_required: true, phone_e164: null, identity_provider: provider },
          provider,
        ),
      ).toBe(false)
    }
  })

  it("requires phone for local accounts without a saved number", () => {
    expect(
      memberPhoneRequired(
        { phone_required: true, phone_e164: null, identity_provider: "local" },
        "local",
      ),
    ).toBe(true)
  })

  it("never requires phone when one is already saved", () => {
    expect(
      memberPhoneRequired(
        {
          phone_required: true,
          phone_e164: "+919876543210",
          identity_provider: "local",
        },
        "local",
      ),
    ).toBe(false)
  })
})
