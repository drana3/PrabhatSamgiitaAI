import { describe, expect, it } from "vitest"

import { googleNativeRedirectUri, googleReversedClientId, oauthRedirectHint } from "@/lib/oauthRedirectUri"

describe("oauthRedirectHint", () => {
  it("uses the prabhatai scheme with the given path", () => {
    expect(oauthRedirectHint("auth")).toBe("prabhatai://auth")
    expect(oauthRedirectHint("auth/google")).toBe("prabhatai://auth/google")
  })

  it("uses reversed Google client id for native redirect", () => {
    const clientId = "495992354696-l5ddf29pefc5ke9f1t8osi9dch0qckrs.apps.googleusercontent.com"
    expect(googleReversedClientId(clientId)).toBe(
      "com.googleusercontent.apps.495992354696-l5ddf29pefc5ke9f1t8osi9dch0qckrs",
    )
    expect(googleNativeRedirectUri(clientId)).toBe("net.prabhatasamgiita.ai:/oauthredirect")
  })
})
