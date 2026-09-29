import { describe, expect, it } from "vitest"

import { buildClientPrincipal } from "@/lib/azure-principal"
import { principalFromEasyAuthMe } from "@/lib/easy-auth"

describe("principalFromEasyAuthMe", () => {
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
})
