import { describe, expect, it } from "vitest"

import { buildClientPrincipal } from "@/lib/azure-principal"
import {
  easyAuthPrincipalMatchesHeaders,
  isAuthenticatedEasyAuthPrincipal,
  principalFromEasyAuthMe,
} from "@/lib/easy-auth"

describe("principalFromEasyAuthMe", () => {
  it("rejects SWA principals that are not in the authenticated role", () => {
    expect(
      principalFromEasyAuthMe({
        identityProvider: "aad",
        userId: "oid-1",
        userDetails: "member@example.com",
        userRoles: ["anonymous"],
      }),
    ).toBeNull()
  })

  it("builds a member principal blob from SWA /.auth/me payload", () => {
    const principal = principalFromEasyAuthMe({
      identityProvider: "aad",
      userId: "oid-123",
      userDetails: "member@example.com",
    })
    expect(principal).toBeTruthy()
    const profile = JSON.parse(Buffer.from(principal!, "base64").toString("utf8")) as {
      auth_typ: string
      claims: Array<{ typ: string; val: string }>
    }
    expect(profile.auth_typ).toBe("aad")
    expect(profile.claims.some((claim) => claim.val === "oid-123")).toBe(true)
  })

  it("normalizes Azure Active Directory provider names", () => {
    const principal = principalFromEasyAuthMe({
      identityProvider: "azureactivedirectory",
      userId: "oid-456",
      userDetails: "Member",
    })
    expect(principal).toBe(buildClientPrincipal("oid-456", "Member", "aad", null))
  })

  it("builds principals for azureActiveDirectory identityProvider values from SWA", () => {
    const principal = principalFromEasyAuthMe({
      identityProvider: "azureActiveDirectory",
      userId: "00000000-0000-0000-0000-000000000099",
      userDetails: "member@example.com",
      userRoles: ["authenticated"],
    })
    expect(principal).toBeTruthy()
    const payload = JSON.parse(Buffer.from(principal!, "base64").toString("utf8")) as { auth_typ: string }
    expect(payload.auth_typ).toBe("aad")
  })
})
