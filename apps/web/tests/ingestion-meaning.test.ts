import { describe, expect, it } from "vitest"

import {
  canTranslateMeaningFromEnglish,
  needsEnglishMeaningFirst,
} from "@/lib/ingestion-meaning"

const preview = {
  existing_meanings: {
    en: "This song speaks of devotion.",
    hi: "यह गीत भक्ति के बारे में है",
  },
}

describe("ingestion meaning helpers", () => {
  it("offers translate when English exists and target is missing", () => {
    expect(canTranslateMeaningFromEnglish(preview, "bn")).toBe(true)
  })

  it("does not offer translate for English target", () => {
    expect(canTranslateMeaningFromEnglish(preview, "en")).toBe(false)
  })

  it("does not offer translate when target already exists", () => {
    expect(canTranslateMeaningFromEnglish(preview, "hi")).toBe(false)
  })

  it("flags missing English for non-English targets", () => {
    expect(
      needsEnglishMeaningFirst({ existing_meanings: { hi: "हिन्दी" } }, "bn"),
    ).toBe(true)
  })

  it("does not flag English-first hint for English target", () => {
    expect(needsEnglishMeaningFirst(preview, "en")).toBe(false)
  })
})
