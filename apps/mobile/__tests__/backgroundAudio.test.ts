import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import path from "path"

/** FB-06: background audio mode for song playback. */
describe("background audio config", () => {
  it("locks UIBackgroundModes audio on iOS", () => {
    const appJson = JSON.parse(
      readFileSync(path.join(__dirname, "../app.json"), "utf8"),
    ) as { expo?: { ios?: { infoPlist?: { UIBackgroundModes?: string[] } } } }
    const modes = appJson.expo?.ios?.infoPlist?.UIBackgroundModes ?? []
    expect(modes).toContain("audio")
  })

  it("app.config keeps audio background mode", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expoConfig = require("../app.config.js") as (ctx: {
      config: Record<string, unknown>
    }) => { ios?: { infoPlist?: { UIBackgroundModes?: string[] } } }
    const base = JSON.parse(readFileSync(path.join(__dirname, "../app.json"), "utf8"))
    const built = expoConfig({ config: base.expo })
    expect(built.ios?.infoPlist?.UIBackgroundModes).toContain("audio")
  })
})
