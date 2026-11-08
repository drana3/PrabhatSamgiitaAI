import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const wellKnown = path.resolve(__dirname, "../../web/public/.well-known")
const read = (name: string) => JSON.parse(readFileSync(path.join(wellKnown, name), "utf8"))
const app = JSON.parse(readFileSync(path.resolve(__dirname, "../app.json"), "utf8")).expo

describe("app links files served by the website", () => {
  it("apple-app-site-association points at this app and the /songs paths", () => {
    const detail = read("apple-app-site-association").applinks.details[0]
    expect(detail.appID).toBe(`2665NAM545.${app.ios.bundleIdentifier}`)
    expect(detail.paths).toContain("/songs/*")
    expect(app.ios.associatedDomains).toContain("applinks:www.prabhatasamgiita.org")
  })

  it("assetlinks.json names the Android package; fingerprints are real SHA-256 or a marked placeholder", () => {
    const [statement] = read("assetlinks.json")
    expect(statement.target.package_name).toBe(app.android.package)
    expect(statement.relation).toContain("delegate_permission/common.handle_all_urls")
    const prints: string[] = statement.target.sha256_cert_fingerprints
    expect(prints.length).toBeGreaterThan(0)
    for (const print of prints) {
      const real = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(print)
      const placeholder = print.startsWith("REPLACE_WITH_")
      expect(real || placeholder, print).toBe(true)
    }
  })

  it("only the host that serves assetlinks.json is auto-verified (a failing host breaks verification on Android 11 and older)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require("../app.config.js")({ config: { ios: {}, android: {}, extra: {} } })
    const filters = config.android.intentFilters as { autoVerify: boolean; data: { scheme?: string; host?: string }[] }[]
    const verified = filters.filter((f) => f.autoVerify).flatMap((f) => f.data.filter((d) => d.scheme === "https").map((d) => d.host))
    expect(verified.length).toBeGreaterThan(0)
    for (const host of verified) expect(host).toBe("www.prabhatasamgiita.org")
    // the bare domain still opens the app, just without verification
    const bare = filters.flatMap((f) => f.data).some((d) => d.host === "prabhatasamgiita.org")
    expect(bare).toBe(true)
  })
})
