import { describe, expect, it } from "vitest"

import { songRouteNumber } from "@/lib/songPage/songRoute"
import { PS_SONG_COUNT } from "@/lib/learn/learnSongs"

describe("songRouteNumber (QA-003)", () => {
  it("accepts every number the catalogue has", () => {
    expect(songRouteNumber("ps-1")).toBe(1)
    expect(songRouteNumber("PS-662")).toBe(662)
    expect(songRouteNumber("12")).toBe(12)
    expect(songRouteNumber(`ps-${PS_SONG_COUNT}`)).toBe(PS_SONG_COUNT)
  })

  it("refuses numbers past the catalogue and zero", () => {
    for (const id of ["ps-5019", "ps-12345", "ps-999999", "ps-0", "0", "5019", "ps-1234567"]) {
      expect(songRouteNumber(id), id).toBeNull()
    }
  })

  it("refuses ids that are not numbers", () => {
    for (const id of ["ps-abc", "abc", "ps-", "ps-1.5", "1.5", "-3", "ps--3", "ps-1e3", "", " ", "ps-12x", "ps-12/3"]) {
      expect(songRouteNumber(id), id).toBeNull()
    }
    expect(songRouteNumber(undefined)).toBeNull()
    expect(songRouteNumber(null)).toBeNull()
  })
})
