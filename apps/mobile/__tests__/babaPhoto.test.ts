import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { BABA_ASSET_FILES, BABA_GEOMETRY, cropFits } from "@/lib/photos/babaData"
import { pickFromList, pickPool } from "@/lib/photos/pick"
import { STOCK_PHOTO_META } from "@/lib/photos/photoData"

const root = path.resolve(__dirname, "..")
const SOURCE_DIRS = ["app", "components", "constants", "hooks", "lib", "stores", "utils"]

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}
const files = SOURCE_DIRS.filter((d) => existsSync(path.join(root, d))).flatMap((d) => sourceFiles(path.join(root, d)))
const rel = (f: string) => path.relative(root, f)

/**
 * Photographs of Baba are never shown under text, a scrim, a chip or a button. They are bound in lib/photos/baba.ts
 * and drawn only by components/common/BabaPhoto. Anything else that needs a picture uses stock photos.
 */
describe("Baba photos are shown clean", () => {
  it("only lib/photos/baba.ts (and the OS-drawn lock screen) names a file that shows Baba", () => {
    const allowed = new Set(["lib/photos/baba.ts", "lib/photos/babaData.ts", "lib/playback/rntpCatalogPlayer.ts"])
    const hits: string[] = []
    for (const f of files) {
      if (allowed.has(rel(f))) continue
      const src = readFileSync(f, "utf8")
      for (const name of BABA_ASSET_FILES) if (src.includes(name)) hits.push(`${rel(f)} uses ${name}`)
    }
    expect(hits).toEqual([])
  })

  it("the retired cover files (Baba and a child) are gone and nothing names them", () => {
    const retired = ["home/garland.jpg", "home/portrait.jpg", "home/seated.jpg", "home/guitar.jpg", "player-v2/cover-garland.jpg", "player-v2/cover-portrait.jpg", "player-v2/cover-seated.jpg", "player-v2/cover-guitar.jpg"]
    for (const r of retired) expect(existsSync(path.join(root, "assets", r)), r).toBe(false)
    const hits = files.filter((f) => retired.some((r) => readFileSync(f, "utf8").includes(r)))
    expect(hits.map(rel)).toEqual([])
  })

  it("every file in assets/ that shows Baba is in the list the rule above scans for", () => {
    for (const name of BABA_ASSET_FILES) expect(existsSync(path.join(root, "assets", name)), name).toBe(true)
  })

  it("BabaPhoto takes no children and draws no scrim, glass or opacity", () => {
    const raw = readFileSync(path.join(root, "components/common/BabaPhoto.tsx"), "utf8")
    expect(raw).toMatch(/children\?: never/)
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
    expect(src).not.toMatch(/LinearGradient|Frost|BlurView|opacity|rgba\(/)
    expect(src).not.toMatch(/\{children\}|props\.children/)
  })

  it("no screen passes children to BabaPhoto, and every crop it asks for keeps the face", () => {
    const nested: string[] = []
    const crops: string[] = []
    for (const f of files) {
      if (rel(f) === "components/common/BabaPhoto.tsx") continue
      const src = readFileSync(f, "utf8")
      // an opening tag that is not self-closing has children
      for (const m of src.matchAll(/<BabaPhoto\b([^>]*?)(\/?)>/gs)) {
        if (m[2] !== "/") nested.push(rel(f))
        const id = /id="(\w+)"/.exec(m[1])?.[1] as keyof typeof BABA_GEOMETRY | undefined
        const ratio = /ratio=\{([\d.]+)\}/.exec(m[1])?.[1]
        if (id && ratio && !cropFits(BABA_GEOMETRY[id], Number(ratio))) crops.push(`${rel(f)}: ${id} at ${ratio}`)
      }
    }
    expect(nested).toEqual([])
    expect(crops).toEqual([])
  })

  it("the default frame ratio keeps the face for every picture", () => {
    for (const id of Object.keys(BABA_GEOMETRY) as (keyof typeof BABA_GEOMETRY)[]) {
      expect(cropFits(BABA_GEOMETRY[id], 1.2), id).toBe(true)
    }
  })

  it("cropFits notices a frame that cuts through the face", () => {
    const today = BABA_GEOMETRY.today
    expect(cropFits(today, 1.5)).toBe(true)
    // a wide strip from the top shows only the first fifth of the picture: the face (y 0.14-0.40) is cut
    expect(cropFits(today, 3.5)).toBe(false)
  })

  it("blocks that put text over a photo get a stock photo, not Baba (Today hero keeps its design)", () => {
    for (const f of ["components/home/HomeBlocks.tsx", "components/today/TodayBlocks.tsx", "app/player-v2.tsx"]) {
      const src = readFileSync(path.join(root, f), "utf8")
      expect(src, f).toContain("photoWithoutPeople(")
      expect(src, f).not.toMatch(/BABA_PHOTOS|id="today"/)
    }
  })

  it("the stock picker never returns a photo marked as Baba", () => {
    const list = [
      { id: "a", tone: "warm", moods: ["morning"], people: "none", subject: "baba" },
      { id: "b", tone: "warm", moods: ["morning"], people: "none" },
    ] as const
    expect(pickPool(list as never, "morning").map((p) => (p as { id: string }).id)).toEqual(["b"])
    expect(pickPool(list as never, "morning", { allowPeople: true, size: "small" }).map((p) => (p as { id: string }).id)).toEqual(["b"])
    expect((pickFromList(list as never, "any") as { id: string }).id).toBe("b")
    expect(pickPool([list[0]] as never)).toEqual([])
  })

  it("the stock catalogue holds no Baba photo", () => {
    expect(STOCK_PHOTO_META.filter((p) => (p as { subject?: string }).subject === "baba")).toEqual([])
  })
})
