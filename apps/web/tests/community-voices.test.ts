import { FALLBACK_COMMUNITY_VOICES, mergeCommunityVoices } from "@/lib/community-voices"

describe("mergeCommunityVoices", () => {
  it("returns fallbacks when the API is empty", () => {
    const merged = mergeCommunityVoices([])
    expect(merged.length).toBeGreaterThanOrEqual(6)
    expect(merged[0]?.display_name).toBe(FALLBACK_COMMUNITY_VOICES[0]?.display_name)
  })

  it("puts API voices first and avoids duplicate quotes", () => {
    const merged = mergeCommunityVoices([
      {
        display_name: "Live Voice",
        display_location: "Dhaka, Bangladesh",
        quote_text: "Prabhat Samgiita guides my morning meditation.",
      },
      {
        display_name: "Duplicate",
        display_location: "Nowhere",
        quote_text: FALLBACK_COMMUNITY_VOICES[0]!.quote_text,
      },
    ])
    expect(merged[0]?.display_name).toBe("Live Voice")
    expect(merged.filter((item) => item.display_name === "Duplicate")).toHaveLength(0)
  })
})
