import { describe, expect, it } from "vitest"

import {
  buildClientPrincipal,
  resolveClientPrincipal,
} from "@/lib/azure-principal"

describe("resolveClientPrincipal", () => {
  it("returns the full principal header when present", () => {
    const headers = new Headers({ "x-ms-client-principal": "abc123" })
    expect(resolveClientPrincipal(headers)).toBe("abc123")
  })

  it("builds a principal from Azure id and name headers", () => {
    const headers = new Headers({
      "x-ms-client-principal-id": "user-oid-42",
      "x-ms-client-principal-name": "dewasheesh.rana3%40gmail.com",
    })
    const principal = resolveClientPrincipal(headers)
    expect(principal).toBeTruthy()

    const payload = JSON.parse(Buffer.from(principal!, "base64").toString("utf8")) as {
      auth_typ: string
      claims: Array<{ typ: string; val: string }>
    }
    expect(payload.auth_typ).toBe("aad")
    expect(payload.claims.some((claim) => claim.val === "user-oid-42")).toBe(true)
    expect(payload.claims.some((claim) => claim.val === "dewasheesh.rana3@gmail.com")).toBe(true)
  })

  it("builds an email-enriched principal blob", () => {
    const principal = buildClientPrincipal("abc", "member@example.com")
    const payload = JSON.parse(Buffer.from(principal, "base64").toString("utf8")) as {
      claims: Array<{ typ: string; val: string }>
    }
    expect(payload.claims.some((claim) => claim.typ === "email" && claim.val === "member@example.com")).toBe(true)
  })
})
