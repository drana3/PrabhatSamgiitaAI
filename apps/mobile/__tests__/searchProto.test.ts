import { describe, expect, it } from "vitest"

import { flattenResults, resultCountLabel, SEARCH_FEELING_CHIPS, SEARCH_HINT_ROWS } from "@/lib/searchProto"
import type { SearchGroup } from "@/lib/unifiedSearch"

const song = (number: number) => ({ id: `ps-${number}`, number, title: `Song ${number}` }) as never

const groups: SearchGroup[] = [
  { id: "number", title: "Exact number", items: [{ song: song(3), reason: { kind: "number" }, line: "" }] },
  {
    id: "lyrics",
    title: "Lyrics matches",
    items: [
      { song: song(3), reason: { kind: "first_line" }, line: "" },
      { song: song(5), reason: { kind: "word" }, line: "" },
    ],
  },
  { id: "meaning", title: "Matches by meaning", items: [{ song: song(7), reason: { kind: "feeling", feeling: "peaceful" }, line: "" }] },
]

describe("flattenResults", () => {
  it("keeps group order, drops repeats and names the reason", () => {
    const flat = flattenResults(groups)
    expect(flat.map((row) => row.item.song.number)).toEqual([3, 5, 7])
    expect(flat.map((row) => row.why)).toEqual(["Number match", "Word match", "Feeling: peaceful"])
  })
  it("is empty without groups", () => {
    expect(flattenResults([])).toEqual([])
  })
})

describe("copy", () => {
  it("counts songs", () => {
    expect(resultCountLabel(1)).toBe("1 song")
    expect(resultCountLabel(0)).toBe("0 songs")
    expect(resultCountLabel(12)).toBe("12 songs")
  })
  it("has the prototype hint rows and feeling chips", () => {
    expect(SEARCH_HINT_ROWS.map((row) => row.example)).toEqual(["3", "bandhu he niye calo", "peaceful"])
    expect(SEARCH_FEELING_CHIPS).toHaveLength(8)
  })
})
