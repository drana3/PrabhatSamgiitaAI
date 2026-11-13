import { afterEach, describe, expect, it } from "vitest"

import { proxyKeyHeaders } from "@/lib/runtime-env"

describe("proxyKeyHeaders", () => {
  const saved = process.env.WEB_PROXY_KEY
  afterEach(() => {
    if (saved === undefined) delete process.env.WEB_PROXY_KEY
    else process.env.WEB_PROXY_KEY = saved
  })

  it("sends only the old shared key while WEB_PROXY_KEY is not set", () => {
    delete process.env.WEB_PROXY_KEY
    expect(proxyKeyHeaders("shared")).toEqual({ "X-Member-Proxy-Key": "shared" })
  })

  it("also sends the website-only key when it is set", () => {
    process.env.WEB_PROXY_KEY = " web-only "
    expect(proxyKeyHeaders("shared")).toEqual({
      "X-Member-Proxy-Key": "shared",
      "X-Web-Proxy-Key": "web-only",
    })
  })
})
