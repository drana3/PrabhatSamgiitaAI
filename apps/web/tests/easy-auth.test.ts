import { describe, expect, it } from "vitest"

import { buildClientPrincipal } from "@/lib/azure-principal"
import {
  parseEasyAuthMePayload,
  principalFromEasyAuthMe,
} from "@/lib/easy-auth"

describe("parseEasyAuthMePayload", () => {
  it("reads SWA array responses from /.auth/me", () => {
    const principal = parseEasyAuthMePayload([
      {
        clientPrincipal: {
          identityProvider: "aad",
          userId: "oid-array",
          userDetails: "member@example.com",
          userRoles: ["anonymous", "authenticated"],
        },
      },
    ])
    expect(principal?.userId).toBe("oid-array")
  })

  it("reads object-shaped /.auth/me payloads", () => {
    const principal = parseEasyAuthMePayload({
      clientPrincipal: {
        identityProvider: "aad",
        userId: "oid-object",
        userDetails: "member@example.com",
      },
    })
    expect(principal?.userId).toBe("oid-object")
  })

  it("reads unwrapped SWA array principals", () => {
    const principal = parseEasyAuthMePayload([
      {
        identityProvider: "aad",
        userId: "oid-unwrapped",
        userDetails: "member@example.com",
        userRoles: ["anonymous", "authenticated"],
      },
    ])
    expect(principal?.userId).toBe("oid-unwrapped")
  })

  it("reads userId from Microsoft object-id claims", () => {
    const principal = parseEasyAuthMePayload({
      clientPrincipal: {
        identityProvider: "aad",
        userRoles: ["authenticated"],
        claims: [
          { typ: "http://schemas.microsoft.com/identity/claims/objectidentifier", val: "oid-claim" },
          { typ: "email", val: "member@example.com" },
        ],
      },
    })
    expect(principal?.userId).toBe("oid-claim")
    expect(principal?.userDetails).toBe("member@example.com")
  })
})

describe("principalFromEasyAuthMe", () => {
  it("accepts Microsoft principals that only report the anonymous role after login", () => {
    expect(
      principalFromEasyAuthMe({
        identityProvider: "aad",
        userId: "oid-1",
        userDetails: "member@example.com",
        userRoles: ["anonymous"],
      }),
    ).toBeTruthy()
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
