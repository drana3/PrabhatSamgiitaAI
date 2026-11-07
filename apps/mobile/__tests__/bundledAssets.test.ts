import { readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(__dirname, "..")

describe("bundled image weight", () => {
  it("every image brand.ts requires stays small (it ships in the APK and sits in memory)", () => {
    const source = readFileSync(path.join(root, "constants/brand.ts"), "utf8")
    const files = [...source.matchAll(/require\("\.\.\/(assets\/[^"]+)"\)/g)].map((m) => m[1])
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const kb = statSync(path.join(root, file)).size / 1024
      expect(kb, `${file} is ${Math.round(kb)} KB`).toBeLessThan(500)
    }
  })

  it("the large hero pictures are WebP", () => {
    const source = readFileSync(path.join(root, "constants/brand.ts"), "utf8")
    expect(source).toContain("dawn-hero.webp")
    expect(source).toContain("guru-quote.webp")
  })
})
