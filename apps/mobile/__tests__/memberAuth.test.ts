import { describe, expect, it } from "vitest"

import { buildClientPrincipal, buildMemberAuthHeaders } from "@/lib/principal"

describe("member preview auth", () => {
  it("builds an Azure-compatible base64 principal", () => {
    const principal = buildClientPrincipal("user@example.com", "user@example.com")
    expect(principal.length).toBeGreaterThan(20)
    const json = Buffer.from(principal, "base64").toString("utf8")
    expect(json).toContain("user@example.com")
    expect(json).toContain("objectidentifier")
  })

  it("omits member headers when proxy key is absent", () => {
    expect(buildMemberAuthHeaders("user@example.com", "Member")).toEqual({})
  })

  it("attaches proxy key + principal when configured", () => {
    const headers = buildMemberAuthHeaders("user@example.com", "Member", "proxy-key")
    expect(headers["X-Member-Proxy-Key"]).toBe("proxy-key")
    expect(headers["X-MS-CLIENT-PRINCIPAL"]).toBeTruthy()
  })

  it("sends a person name claim, not the email address as display name", () => {
    const headers = buildMemberAuthHeaders(
      "dewasheesh.rana@gmail.com",
      "dewasheesh.rana@gmail.com",
      "proxy-key",
    )
    const json = Buffer.from(headers["X-MS-CLIENT-PRINCIPAL"], "base64").toString("utf8")
    expect(json).toContain("Dewasheesh Rana")
    expect(json).toContain("dewasheesh.rana@gmail.com")
    const payload = JSON.parse(json) as { claims: Array<{ typ: string; val: string }> }
    const nameClaim = payload.claims.find((claim) => claim.typ === "name")
    expect(nameClaim?.val).toBe("Dewasheesh Rana")
  })
})
