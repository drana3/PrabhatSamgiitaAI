import { describe, expect, it } from "vitest"

import { isSameAudioTrack, isSameSong } from "@/lib/playback"

const song = { id: "ps-8", number: 8, audioUrl: "https://example.test/a.mp3" }

describe("search/list play identity", () => {
  it("treats a hydrated player and a search row as the same track", () => {
    expect(isSameSong(song, { id: "ps-8", number: 8 })).toBe(true)
    expect(isSameAudioTrack(song, { id: "ps-8", number: 8, audioUrl: null })).toBe(true)
    expect(isSameAudioTrack(song, { id: "ps-8", number: 8, audioUrl: "" })).toBe(true)
  })

  it("still distinguishes alternate recordings of the same song", () => {
    expect(
      isSameAudioTrack(song, { id: "ps-8", number: 8, audioUrl: "https://example.test/b.mp3" }),
    ).toBe(false)
  })

  it("treats two URL-less stubs as different tracks so play hydrates audio", () => {
    const stub = { id: "ps-1", number: 1, audioUrl: null as string | null }
    expect(isSameAudioTrack(stub, { id: "ps-1", number: 1, audioUrl: "" })).toBe(false)
    expect(isSameAudioTrack(null, { id: "ps-1", number: 1, audioUrl: null })).toBe(false)
  })
})
