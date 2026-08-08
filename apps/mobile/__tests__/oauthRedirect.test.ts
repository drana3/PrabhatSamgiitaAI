import { describe, expect, it } from "vitest"

import { oauthRedirectHint } from "@/lib/oauthRedirectUri"

describe("oauthRedirectHint", () => {
  it("uses the prabhatai scheme with the given path", () => {
    expect(oauthRedirectHint("auth")).toBe("prabhatai://auth")
    expect(oauthRedirectHint("auth/google")).toBe("prabhatai://auth/google")
  })
})
