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
  // The team's v1 screens stay in the repository untouched; only our own code must not point into them.
  const teamV1 = (file: string) =>
    ["app/(tabs)/", "app/song/", "app/search/", "app/player/", "app/collections/", "app/playlist/", "app/drive/", "components/home/", "components/drive/", "components/songs/", "components/search/", "components/playlists/", "components/ai/", "components/common/", "components/player/"].some((dir) =>
      file.split(path.sep).join("/").startsWith(dir),
    )

  it("old v1 screens are kept in the repository", () => {
    for (const kept of ["app/(tabs)", "app/song", "app/search", "app/player"]) {
      expect(existsSync(path.join(root, kept)), kept).toBe(true)
    }
  })

  it("no v2 screen or helper navigates into the old tab group", () => {
    const offenders = ["app", "components", "hooks", "lib", "stores"]
      .flatMap(sources)
      .filter((file) => !teamV1(file))
      .filter((file) => file !== path.join("lib", "legacyRoutes.ts"))
      .filter((file) => /["'`]\/\(tabs\)/.test(readFileSync(path.join(root, file), "utf8")))
    expect(offenders).toEqual([])
  })

  it("the start, welcome, sign-in, sign-out and not-found screens all land on the v2 home route", () => {
    for (const file of ["app/index.tsx", "app/auth.tsx", "app/auth/google.tsx", "app/complete-profile.tsx", "app/signin/index.tsx", "app/+not-found.tsx"]) {
      expect(readFileSync(path.join(root, file), "utf8"), file).toContain("NAV_V2_HOME_ROUTE")
    }
  })

  it("the welcome screen hands over to the onboarding, which ends on a v2 tab (the Kiirtan tab)", () => {
    expect(readFileSync(path.join(root, "components/onboarding/useFinishOnboarding.ts"), "utf8")).toContain("landingRoute()")
    expect(readFileSync(path.join(root, "lib/onboarding/flow.ts"), "utf8")).toContain("NAV_V2_TABS")
  })
})
