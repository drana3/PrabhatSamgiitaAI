import { describe, expect, it } from "vitest"

import { NO_COUNTS, type RadioCounts } from "@/lib/radio/categories"
import { activeChannel, channelsFor, selectionForChannel } from "@/lib/radio/channels"
import { radioArtFor, radioHeroLayout } from "@/lib/radio/radioArt"

const counts = (over: Partial<RadioCounts>): RadioCounts => ({ ...NO_COUNTS, ...over })

describe("radio channels (variant D)", () => {
  const c = counts({ prabhat_samgiita: 3753, kiirtan: 14, bhajan: 8, baba_audio: 3 })

  it("All first, then every category that has tracks; empty ones have no channel", () => {
    expect(channelsFor(c)).toEqual(["all", "prabhat_samgiita", "kiirtan", "bhajan", "baba_audio"])
    expect(channelsFor(counts({ kiirtan: 4 }))).toEqual(["kiirtan"])
    expect(channelsFor(NO_COUNTS)).toEqual([])
  })

  it("a tap on a channel chooses only that category; All chooses everything", () => {
    expect(selectionForChannel("kiirtan", c)).toEqual(["kiirtan"])
    expect(selectionForChannel("all", c).length).toBeGreaterThan(4)
  })

  it("tells which channel is on, or none for a mix", () => {
    expect(activeChannel(selectionForChannel("all", c), c)).toBe("all")
    expect(activeChannel(["kiirtan"], c)).toBe("kiirtan")
    expect(activeChannel(["kiirtan", "bhajan"], c)).toBeNull()
  })
})

describe("the picture behind the radio", () => {
  const base = { recordingKind: "kiirtan" as const, seed: "k1" }

  it("cover first, then the author's photo, then a stock photo without people", () => {
    expect(radioArtFor({ ...base, coverUrl: "https://x/c.jpg", authorPhotoUrl: "https://x/a.jpg" })).toEqual({ kind: "cover", uri: "https://x/c.jpg" })
    expect(radioArtFor({ ...base, coverUrl: null, authorPhotoUrl: "https://x/a.jpg" })).toEqual({ kind: "author", uri: "https://x/a.jpg" })
    expect(radioArtFor({ ...base, coverUrl: "", authorPhotoUrl: null })).toEqual({ kind: "stock", seed: "radio-k1" })
  })

  it("an unusable address is skipped, not drawn", () => {
    expect(radioArtFor({ ...base, coverUrl: "not a url", authorPhotoUrl: "javascript:alert(1)" }).kind).toBe("stock")
  })

  it("a Prabhat Samgiita song gets its own stock photo by its number", () => {
    expect(radioArtFor({ recordingKind: null, seed: "ps-42" })).toEqual({ kind: "stock", seed: "radio-ps-42" })
  })

  it("Baba's discourses use the clean Baba layout, whatever cover they have", () => {
    const art = radioArtFor({ recordingKind: "baba_audio", coverUrl: "https://x/c.jpg", seed: "b1" })
    expect(art.kind).toBe("baba")
    expect(radioHeroLayout(art)).toBe("baba-clean")
    expect(radioHeroLayout({ kind: "stock", seed: "s" })).toBe("photo-under-controls")
  })
})
