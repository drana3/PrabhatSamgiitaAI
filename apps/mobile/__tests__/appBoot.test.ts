import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(__dirname, "..")

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8")
}

describe("android cold start", () => {
  it("waits for auth hydration and defers first navigation", () => {
    expect(read("app/index.tsx")).not.toMatch(/<Redirect/)
    expect(read("app/index.tsx")).toMatch(/router\.replace/)
    expect(read("app/_layout.tsx")).toMatch(/shellReady/)
    expect(read("app/_layout.tsx")).toMatch(/authHydrated/)
  })
})
