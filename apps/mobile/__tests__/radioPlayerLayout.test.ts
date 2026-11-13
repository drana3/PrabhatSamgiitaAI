import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { radioArtFor, radioHeroLayout } from "@/lib/radio/radioArt"

const root = path.resolve(__dirname, "..")
const read = (p: string) => readFileSync(path.join(root, p), "utf8")

describe("Radio player picture order", () => {
  const base = { recordingKind: null, seed: "1234" } as const
  it("cover wins, then author photo, then a stock photo without people", () => {
    expect(radioArtFor({ ...base, coverUrl: "https://x/c.jpg", authorPhotoUrl: "https://x/a.jpg" }).kind).toBe("cover")
    expect(radioArtFor({ ...base, coverUrl: null, authorPhotoUrl: "https://x/a.jpg" }).kind).toBe("author")
    expect(radioArtFor({ ...base, coverUrl: "", authorPhotoUrl: null }).kind).toBe("stock")
  })
  it("a bad or local-path cover is ignored", () => {
    expect(radioArtFor({ ...base, coverUrl: "javascript:alert(1)", authorPhotoUrl: null }).kind).toBe("stock")
  })
  it("the stock choice is stable for the same track", () => {
    expect(radioArtFor({ ...base })).toEqual(radioArtFor({ ...base }))
  })
  it("Baba's discourses use the clean frame, never the photo-under-controls layout", () => {
    const art = radioArtFor({ ...base, recordingKind: "baba_audio", coverUrl: "https://x/c.jpg" })
    expect(art.kind).toBe("baba")
    expect(radioHeroLayout(art)).toBe("baba-clean")
  })
})

describe("Radio player keeps Baba photos clean", () => {
  const hero = read("components/radio/RadioHero.tsx")
  const frame = hero.slice(hero.indexOf("export function RadioBabaFrame"), hero.indexOf("const styles"))

  it("the Baba frame is only a BabaPhoto: no gradient, no text, no buttons, no overlay", () => {
    expect(frame).toContain("<BabaPhoto")
    expect(frame).not.toMatch(/LinearGradient|<Text|TouchButton|Pressable|absoluteFill/)
  })
  it("the photo-with-scrim hero cannot be given a Baba picture", () => {
    expect(hero).toMatch(/art: Exclude<RadioArt, \{ kind: "baba" \}>/)
  })
  it("the player draws the scrim hero only when the art is not Baba", () => {
    const player = read("app/player-v2.tsx")
    expect(player).toMatch(/radioView && radioArt && radioArt\.kind !== "baba"/)
  })
  it("the radio screen does not hide the channel row or the stop button on Baba (only the picture differs)", () => {
    const player = read("app/player-v2.tsx")
    expect(player).toContain("<RadioChannelStrip />")
    expect(player).toContain("exitDriveMode()")
  })
})
