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

  it("prefers Microsoft OID over email so mobile does not fork the website account", () => {
    const headers = buildMemberAuthHeaders(
      "member@example.com",
      "Member",
      "proxy-key",
      "11111111-2222-3333-4444-555555555555",
    )
    const payload = JSON.parse(
      Buffer.from(headers["X-MS-CLIENT-PRINCIPAL"], "base64").toString("utf8"),
    ) as { claims: Array<{ typ: string; val: string }> }
    const oid = payload.claims.find((claim) => claim.typ.includes("objectidentifier"))
    expect(oid?.val).toBe("11111111-2222-3333-4444-555555555555")
  })

  it("does not use a real email as the principal object id", () => {
    const headers = buildMemberAuthHeaders("member@example.com", "Member", "proxy-key")
    const payload = JSON.parse(
      Buffer.from(headers["X-MS-CLIENT-PRINCIPAL"], "base64").toString("utf8"),
    ) as { claims: Array<{ typ: string; val: string }> }
    const oid = payload.claims.find((claim) => claim.typ.includes("objectidentifier"))
    expect(oid?.val).not.toBe("member@example.com")
    expect(oid?.val).toMatch(/^preview:/)
  })

  it("builds member headers with OID when email is empty", () => {
    const headers = buildMemberAuthHeaders(
      "",
      "Member",
      "proxy-key",
      "11111111-2222-3333-4444-555555555555",
    )
    expect(headers["X-Member-Proxy-Key"]).toBe("proxy-key")
    const payload = JSON.parse(
      Buffer.from(headers["X-MS-CLIENT-PRINCIPAL"], "base64").toString("utf8"),
    ) as { claims: Array<{ typ: string; val: string }> }
    const oid = payload.claims.find((claim) => claim.typ.includes("objectidentifier"))
    expect(oid?.val).toBe("11111111-2222-3333-4444-555555555555")
  })
})
