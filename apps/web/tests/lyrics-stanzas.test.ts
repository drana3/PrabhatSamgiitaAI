import { describe, expect, it } from "vitest"

import { lyricsStanzaBlocks } from "@/lib/lyrics-stanzas"

describe("lyricsStanzaBlocks", () => {
  it("splits on blank lines like official stanza paragraphs", () => {
    const text = "REFRAIN\nLINE TWO\n\nREFRAIN\nLINE FOUR"
    expect(lyricsStanzaBlocks(text)).toEqual(["REFRAIN\nLINE TWO", "REFRAIN\nLINE FOUR"])
  })

  it("returns one block when no stanza gaps", () => {
    expect(lyricsStanzaBlocks("ONE\nTWO")).toEqual(["ONE\nTWO"])
  })
})