import { afterEach, describe, expect, it } from "vitest"

import { runtimeEnv } from "@/lib/runtime-env"

describe("runtimeEnv", () => {
  afterEach(() => {
    delete process.env.MEMBER_PROXY_KEY
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
