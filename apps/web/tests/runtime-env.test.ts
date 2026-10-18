import { afterEach, describe, expect, it } from "vitest"

import { googleOAuthClientId, runtimeEnv } from "@/lib/runtime-env"

describe("runtimeEnv", () => {
  afterEach(() => {
    delete process.env.MEMBER_PROXY_KEY
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  })

  it("reads secrets dynamically so Azure runtime values are not build-inlined away", () => {
    process.env.MEMBER_PROXY_KEY = " live-secret "
    expect(runtimeEnv("MEMBER_PROXY_KEY")).toBe("live-secret")
  })

  it("treats blank values as missing", () => {
    process.env.MEMBER_PROXY_KEY = "   "
    expect(runtimeEnv("MEMBER_PROXY_KEY")).toBeUndefined()
  })
})

describe("googleOAuthClientId", () => {
  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  })

  it("prefers runtime GOOGLE_CLIENT_ID for server token exchange", () => {
    process.env.GOOGLE_CLIENT_ID = "runtime-client"
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "build-client"
    expect(googleOAuthClientId()).toBe("runtime-client")
  })

  it("falls back to NEXT_PUBLIC_GOOGLE_CLIENT_ID when runtime id is unset", () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = " build-client "
    expect(googleOAuthClientId()).toBe("build-client")
  })
})
