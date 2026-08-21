import { describe, expect, it } from "vitest"

import {
  ADMIN_GATE_COOKIE,
  buildAdminGateToken,
  verifyAdminGateToken,
} from "@/lib/admin-gate"

describe("admin gate cookie", () => {
  it("accepts a freshly minted token for the same principal", () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    const principal = "encoded-principal"
    const nowSec = Math.floor(Date.now() / 1000)
    const token = buildAdminGateToken(principal, nowSec)
    expect(verifyAdminGateToken(token, principal)).toBe(true)
    expect(verifyAdminGateToken(token, "other-principal")).toBe(false)
    expect(ADMIN_GATE_COOKIE).toBe("psa_admin_gate")
  })

  it("rejects expired tokens", () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    const principal = "encoded-principal"
    const token = buildAdminGateToken(principal, Math.floor(Date.now() / 1000) - 400)
    expect(verifyAdminGateToken(token, principal)).toBe(false)
  })
})
