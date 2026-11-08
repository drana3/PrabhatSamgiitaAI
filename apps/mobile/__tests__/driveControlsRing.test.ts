import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(path.resolve(__dirname, "..", "components/player-v2/DriveControls.tsx"), "utf8")

/** The body of one style entry, e.g. styleBlock("skip") for `skip: { ... },`. */
function styleBlock(name: string): string {
  const start = source.indexOf(`  ${name}: {`)
  expect(start, `style ${name} exists`).toBeGreaterThan(-1)
  return source.slice(start, source.indexOf("\n  },", start) + 5)
}

describe("Radio controls outline (frosted pills)", () => {
  it("draws the outline on its own layer, not as the border of the blurred pill", () => {
    // A border on the pill that carries the blur gets sampled by the blur and smeared inwards at the
    // rounded ends: the sides then look unlined. The ring sits above the frost instead.
    expect(styleBlock("skip")).not.toContain("borderWidth")
    expect(styleBlock("exit")).not.toContain("borderWidth")
    const ring = styleBlock("ring")
    expect(ring).toContain("absoluteFillObject")
    expect(ring).toContain("borderWidth: 1")
    expect(ring).toContain("borderRadius: amRadius.pill")
  })

  it("puts a ring over each of the three frosted pills (Previous, Next, leave)", () => {
    expect(source.match(/<Frost /g)).toHaveLength(3)
    expect(source.match(/styles\.ring\b/g)!.length).toBe(3)
    expect(source).toContain("styles.ringGold")
  })

  it("keeps the rings out of the way of touches", () => {
    expect(source.match(/<View pointerEvents="none" style=\{\[?styles\.ring/g)).toHaveLength(3)
  })
})
