import { describe, expect, it } from "vitest"

import { allFestivalObservances } from "./festivalObservances"
import {
  findObservanceForSearchQuery,
  festivalObservanceExploreQuery,
  observanceCollectionLabel,
  observanceCollectionLabelForQuery,
  observanceCatalogSongNumbers,
} from "./festivalCatalogSearch"

describe("festivalCatalogSearch", () => {
  it("maps every reviewed observance to a catalog explore prompt", () => {
    for (const obs of allFestivalObservances) {
      expect(observanceCollectionLabel(obs), obs.id).toBeTruthy()
      expect(festivalObservanceExploreQuery(obs).toLowerCase()).toContain(
        "search prabhat samgiita for",
      )
    }
  })

  it("resolves civil New Year's Day and Navavarsa searches to catalog collections", () => {
    expect(observanceCollectionLabelForQuery("New Year's Day")).toBe("Year-end Song")
    expect(observanceCollectionLabelForQuery("Navavarsa")).toBe("New Year Songs")
    expect(observanceCollectionLabelForQuery("diwali")).toBe(
      "Dipavali (Colour Festival) Day Songs",
    )
  })

  it("matches observance titles and uses curated PS Divasa song numbers", () => {
    const ps = findObservanceForSearchQuery("Prabhat Samgiita Divasa")
    expect(ps?.id).toBe("ps-divasa-2026")
    expect(observanceCatalogSongNumbers(ps!)).toEqual([1, 68, 135, 647, 1418, 4281, 5018])
  })
})