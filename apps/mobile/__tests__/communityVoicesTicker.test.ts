import { describe, expect, it } from "vitest"

import { communityVoices } from "@/data/homeContent"
import {
  clampVoiceIndex,
  isVoiceList,
  mergeLiveVoices,
  nextVoiceIndex,
  voicesFingerprint,
} from "@/lib/communityVoices"

describe("community voices", () => {
  it("keeps every distinct approved quote in order and does not inject seed quotes", () => {
    const voices = mergeLiveVoices([
      { quote_text: "Beautiful morning companion for meditation practice.", display_name: "Ananda" },
      { quote_text: "Festival collections made programme prep simple.", display_name: "Devaki" },
    ])
    expect(voices).toHaveLength(2)
    expect(voices[0]?.name).toBe("Ananda")
    expect(voices[1]?.name).toBe("Devaki")
    expect(voices.some((voice) => communityVoices.some((seed) => seed.quote === voice.quote))).toBe(
      false,
    )
  })

  it("returns nothing for an empty API payload so cache is not overwritten", () => {
    expect(mergeLiveVoices([])).toEqual([])
  })

  it("cycles every quote then wraps", () => {
    expect(nextVoiceIndex(0, 2)).toBe(1)
    expect(nextVoiceIndex(1, 2)).toBe(0)
    expect(nextVoiceIndex(0, 1)).toBe(0)
  })

  it("clamps the visible index when the list shrinks", () => {
    expect(clampVoiceIndex(0, 2)).toBe(0)
    expect(clampVoiceIndex(1, 2)).toBe(1)
    expect(clampVoiceIndex(4, 2)).toBe(0)
  })

  it("rejects empty or malformed cache payloads", () => {
    expect(isVoiceList([])).toBe(false)
    expect(isVoiceList([{ quote: "short", name: "A" }])).toBe(false)
    expect(
      isVoiceList([
        { id: "1", quote: "Beautiful morning companion for meditation.", name: "Ananda" },
      ]),
    ).toBe(true)
  })

  it("treats the same quotes as unchanged", () => {
    const a = mergeLiveVoices([
      { quote_text: "Beautiful morning companion for meditation practice.", display_name: "Ananda" },
    ])
    const b = mergeLiveVoices([
      { quote_text: "Beautiful morning companion for meditation practice.", display_name: "Ananda" },
    ])
    expect(voicesFingerprint(a)).toBe(voicesFingerprint(b))
  })
})
