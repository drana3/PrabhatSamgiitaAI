import { mergeCommunityVoices } from "@/lib/community-voices"

describe("mergeCommunityVoices", () => {
  it("returns nothing when the API has no approved testimonials", () => {
    expect(mergeCommunityVoices([])).toEqual([])
  })

  it("keeps approved voices and removes duplicate quotes", () => {
    const merged = mergeCommunityVoices([
      {
        display_name: "Live Voice",
        display_location: "Dhaka, Bangladesh",
        quote_text: "Prabhat Samgiita guides my morning meditation.",
      },
      {
        display_name: "Duplicate",
        display_location: "Nowhere",
        quote_text: "Prabhat Samgiita guides my morning meditation.",
      },
      {
        display_name: "Too short",
        display_location: "Nowhere",
        quote_text: "Nice",
      },
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0]?.display_name).toBe("Live Voice")
  })
})
