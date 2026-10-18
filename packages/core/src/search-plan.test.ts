import { describe, expect, it } from "vitest"

import {
  feelingBrowseId,
  feelingSearchAllowed,
  isNaturalLanguageSearch,
  planSearch,
  searchNetworkMode,
} from "./search-plan"

describe("planSearch", () => {
  const guest = { signedIn: false, feelingSearchEnabled: false }
  const memberOff = { signedIn: true, feelingSearchEnabled: false }
  const memberOn = { signedIn: true, feelingSearchEnabled: true }

  it("keeps numbers, collection prompts, and lyrics on the local catalog", () => {
    expect(planSearch("274", guest).layer).toBe("number")
    expect(planSearch("Search Prabhat Samgiita for Hindi Songs", guest).layer).toBe("collection")
    expect(planSearch("bandhu he niye calo", guest).layer).toBe("catalog")
    expect(planSearch("siv", guest).layer).toBe("catalog")
    expect(planSearch("kisna", guest).layer).toBe("catalog")
    expect(searchNetworkMode("bandhu he niye calo", guest)).toBe("catalog")
  })

  it("uses a local mood list for feeling sentences unless Feeling search is on", () => {
    expect(isNaturalLanguageSearch("I am feeling very stressful today")).toBe(true)
    expect(planSearch("I am feeling very stressful today", guest)).toEqual({
      layer: "mood",
      moodId: "peace",
      networkMode: null,
    })
    expect(planSearch("I am feeling very stressful today", memberOff).layer).toBe("mood")
    expect(feelingBrowseId("help me find guru songs")).toBe("guru")
    expect(searchNetworkMode("I am feeling very stressful today", guest)).toBe("catalog")
  })

  it("sends free text to embeddings when a signed-in member enabled Feeling search", () => {
    expect(feelingSearchAllowed(guest)).toBe(false)
    expect(feelingSearchAllowed(memberOn)).toBe(true)
    expect(planSearch("I am feeling very stressful today", memberOn)).toEqual({
      layer: "semantic",
      networkMode: "semantic",
    })
    expect(searchNetworkMode("I am feeling very stressful today", memberOn)).toBe("semantic")
    expect(planSearch("humdardi", memberOn)).toEqual({
      layer: "semantic",
      networkMode: "semantic",
    })
    expect(planSearch("songs about peace", memberOn).layer).toBe("semantic")
    expect(planSearch("274", memberOn).layer).toBe("number")
    expect(planSearch("Search Prabhat Samgiita for Hindi Songs", memberOn).layer).toBe(
      "collection",
    )
  })
})
