import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(__dirname, "..")

function sources(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = path.join(dir, name)
    if (statSync(path.join(root, rel)).isDirectory()) return sources(rel)
    return /\.(ts|tsx)$/.test(name) ? [rel] : []
  })
}

describe("the redesign is the only app", () => {
  it("has no v1 screens left", () => {
    for (const gone of ["app/(tabs)", "app/song", "app/search", "app/player", "app/collections", "app/playlist", "app/drive"]) {
      expect(existsSync(path.join(root, gone)), gone).toBe(false)
    }
  })

  it("no screen or helper navigates into the old tab group", () => {
    const offenders = ["app", "components", "hooks", "lib", "stores"]
      .flatMap(sources)
      .filter((file) => file !== path.join("lib", "legacyRoutes.ts"))
      .filter((file) => /["'`]\/\(tabs\)/.test(readFileSync(path.join(root, file), "utf8")))
    expect(offenders).toEqual([])
  })

  it("the start, welcome, sign-in, sign-out and not-found screens all land on the v2 home route", () => {
    for (const file of ["app/index.tsx", "app/welcome.tsx", "app/auth.tsx", "app/auth/google.tsx", "app/complete-profile.tsx", "app/signin/index.tsx", "app/+not-found.tsx"]) {
      expect(readFileSync(path.join(root, file), "utf8"), file).toContain("NAV_V2_HOME_ROUTE")
    }
  })
})
