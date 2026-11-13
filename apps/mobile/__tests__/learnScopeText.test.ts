import { describe, expect, it } from "vitest"

import { PS_SONG_COUNT } from "@/lib/learn/learnSongs"
import { emptyKind, deckLine, partialLine } from "@/lib/learn/scopeText"
import type { ScopeSummary } from "@/lib/learn/scope"

const summary = (patch: Partial<ScopeSummary>): ScopeSummary => ({ mode: "chosen", songs: 3, songsWithWords: 2, words: 42, ...patch })

describe("the deck line", () => {
  it("says how many songs and words", () => {
    expect(deckLine(summary({}))).toBe("Deck: 3 songs, 42 words")
    expect(deckLine(summary({ songs: 1, words: 1 }))).toBe("Deck: 1 song, 1 word")
  })

  it("names all songs without a song count", () => {
    expect(deckLine(summary({ mode: "all", songs: PS_SONG_COUNT, words: 67 }))).toBe("Deck: all songs, 67 words")
  })

  it("says when no song is chosen yet", () => {
    expect(deckLine(summary({ songs: 0, songsWithWords: 0, words: 0 }))).toBe("Deck: no song chosen yet")
  })

  it("keeps a chosen song with no words in the count and says it has none", () => {
    const empty = summary({ songs: 2, songsWithWords: 0, words: 0 })
    expect(deckLine(empty)).toBe("Deck: 2 songs, 0 words")
    expect(partialLine(empty)).toBe("Word meanings so far: 0 of 2 songs.")
  })
})

describe("the partial line", () => {
  it("uses the singular for one song", () => {
    expect(partialLine(summary({ songs: 1, songsWithWords: 0, words: 0 }))).toBe("Word meanings so far: 0 of 1 song.")
  })

  it("shows only when some songs have no words", () => {
    expect(partialLine(summary({}))).toBe("Word meanings so far: 2 of 3 songs.")
    expect(partialLine(summary({ songsWithWords: 3 }))).toBeNull()
    expect(partialLine(summary({ songs: 0, songsWithWords: 0, words: 0 }))).toBeNull()
  })

  it("counts against the whole collection for all songs", () => {
    expect(partialLine(summary({ mode: "all", songs: PS_SONG_COUNT, songsWithWords: 7, words: 67 }))).toBe("Word meanings so far: 7 of 5,018 songs.")
  })
})

describe("why a deck is empty", () => {
  it("is not empty with words", () => {
    expect(emptyKind(summary({}))).toBeNull()
  })

  it("tells no songs from songs without words", () => {
    expect(emptyKind(summary({ songs: 0, songsWithWords: 0, words: 0 }))).toBe("none")
    expect(emptyKind(summary({ songs: 2, songsWithWords: 0, words: 0 }))).toBe("nowords")
    expect(emptyKind(summary({ mode: "all", songs: PS_SONG_COUNT, songsWithWords: 0, words: 0 }))).toBe("nowords")
  })
})
