import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { microsoftRedirectHint } from "@/lib/msalRedirect"

describe("Microsoft redirect URI", () => {
  it("uses a path-based custom scheme Azure accepts", () => {
    expect(microsoftRedirectHint()).toBe("prabhatai://auth")
  })
})

describe("Microsoft sign-out", () => {
  it("clears SSO locally without opening Entra logout in a browser", () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const source = readFileSync(join(here, "../lib/msal.ts"), "utf8")
    expect(source).toMatch(/export async function signOutWithMicrosoft/)
    expect(source).toMatch(/markMicrosoftLoginRequired/)
    // Browser logout steals Android focus and delays welcome.
    expect(source).not.toMatch(/openAuthSessionAsync\(logoutUrl/)
  })
})
