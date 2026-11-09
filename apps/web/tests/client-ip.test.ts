import { describe, expect, it } from "vitest"

import { trustedClientIp, trustedProxyHops } from "@/lib/client-ip"

describe("trustedClientIp", () => {
  it("takes the entry the platform added, counted from the right", () => {
    expect(trustedClientIp("203.0.113.9", 1)).toBe("203.0.113.9")
    expect(trustedClientIp("198.51.100.7, 203.0.113.9", 1)).toBe("203.0.113.9")
  })

  it("ignores what the visitor typed on the left", () => {
    expect(trustedClientIp("1.1.1.1, 2.2.2.2, 203.0.113.9", 1)).toBe("203.0.113.9")
    expect(trustedClientIp("1.1.1.1, 203.0.113.9, 10.0.0.4", 2)).toBe("203.0.113.9")
  })

  it("has no answer when there are fewer entries than trusted proxies", () => {
    expect(trustedClientIp("203.0.113.9", 2)).toBeUndefined()
    expect(trustedClientIp("", 1)).toBeUndefined()
    expect(trustedClientIp(null, 1)).toBeUndefined()
  })

  it("strips a port and brackets, and refuses things that are not addresses", () => {
    expect(trustedClientIp("203.0.113.9:51234", 1)).toBe("203.0.113.9")
    expect(trustedClientIp("[2001:db8::1]:443", 1)).toBe("2001:db8::1")
    expect(trustedClientIp("2001:db8::1", 1)).toBe("2001:db8::1")
    expect(trustedClientIp("not-an-ip", 1)).toBeUndefined()
    expect(trustedClientIp("1.1.1.1, <script>", 1)).toBeUndefined()
  })
})

describe("trustedProxyHops", () => {
  it("defaults to one proxy and accepts 1 to 5", () => {
    expect(trustedProxyHops(undefined)).toBe(1)
    expect(trustedProxyHops("")).toBe(1)
    expect(trustedProxyHops("2")).toBe(2)
    expect(trustedProxyHops("0")).toBe(1)
    expect(trustedProxyHops("9")).toBe(1)
    expect(trustedProxyHops("x")).toBe(1)
  })
})
