import { describe, expect, it } from "vitest"

import { favoritesScopeKey } from "@/lib/favoritesScope"

describe("favoritesScopeKey", () => {
  it("isolates guest, preview, and member buckets", () => {
    expect(
      favoritesScopeKey({
        mode: "guest",
        memberId: null,
        identityProvider: null,
        email: null,
      }),
    ).toBe("guest")

    expect(
      favoritesScopeKey({
        mode: "signed_in",
        memberId: "mobile-preview",
        identityProvider: "preview",
        email: "mobile-preview@prabhat.local",
      }),
    ).toBe("preview")

    expect(
      favoritesScopeKey({
        mode: "signed_in",
        memberId: "oid-123",
        identityProvider: "aad",
        email: "member@example.com",
      }),
    ).toBe("member:oid-123")
  })
})
