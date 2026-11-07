import { beforeEach, describe, expect, it, vi } from "vitest"

const memory = new Map<string, string>()
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => memory.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: async (key: string) => {
      memory.delete(key)
    },
  },
}))

import {
  DEFAULT_RADIO_SELECTION,
  NO_COUNTS,
  RADIO_CATEGORIES,
  RADIO_SELECTION_VERSION,
  effectiveSelection,
  isAllSelected,
  radioCategoryOf,
  sanitizeSelection,
  selectAll,
  summaryLine,
  toggleCategory,
  type RadioCounts,
} from "@/lib/radio/categories"
import { useRadioSelectionStore } from "@/stores/radioSelectionStore"
import { RECORDING_KINDS } from "@/lib/kirtan/types"

const counts = (over: Partial<RadioCounts> = {}): RadioCounts => ({
  prabhat_samgiita: 3700,
  kiirtan: 40,
  bhajan: 12,
  spiritual_song: 8,
  dance_song: 0,
  baba_audio: 3,
  ...over,
})

describe("radio categories", () => {
  it("are exactly the app's recording kinds, in chip order", () => {
    expect([...RADIO_CATEGORIES].sort()).toEqual([...RECORDING_KINDS].sort())
    expect(RADIO_CATEGORIES[0]).toBe("prabhat_samgiita")
    expect(RADIO_CATEGORIES.at(-1)).toBe("baba_audio")
  })

  it("reads the removed devotional_song id as a Bhajan and rejects unknown ids", () => {
    expect(radioCategoryOf("devotional_song")).toBe("bhajan")
    expect(radioCategoryOf("kiirtan")).toBe("kiirtan")
    expect(radioCategoryOf("jazz")).toBeNull()
    expect(radioCategoryOf(7)).toBeNull()
  })

  it("sanitizes a stored value: unknown dropped, no repeats, chip order, never empty", () => {
    expect(sanitizeSelection(["bhajan", "kiirtan", "bhajan", "nope"])).toEqual(["kiirtan", "bhajan"])
    expect(sanitizeSelection([])).toEqual([...DEFAULT_RADIO_SELECTION])
    expect(sanitizeSelection("kiirtan")).toEqual([...DEFAULT_RADIO_SELECTION])
    expect(sanitizeSelection(undefined)).toEqual([...DEFAULT_RADIO_SELECTION])
    expect(sanitizeSelection(["devotional_song"])).toEqual(["bhajan"])
  })

  describe("toggleCategory", () => {
    it("adds a category that has tracks", () => {
      const r = toggleCategory(["prabhat_samgiita"], "kiirtan", counts())
      expect(r.result).toBe("added")
      expect(r.selected).toEqual(["prabhat_samgiita", "kiirtan"])
    })

    it("removes one when another stays on", () => {
      const r = toggleCategory(["prabhat_samgiita", "kiirtan"], "kiirtan", counts())
      expect(r.result).toBe("removed")
      expect(r.selected).toEqual(["prabhat_samgiita"])
    })

    it("refuses to switch off the last one (the guard)", () => {
      const r = toggleCategory(["kiirtan"], "kiirtan", counts())
      expect(r.result).toBe("last")
      expect(r.selected).toEqual(["kiirtan"])
    })

    it("refuses a category with nothing to play (count 0)", () => {
      const r = toggleCategory(["kiirtan"], "dance_song", counts())
      expect(r.result).toBe("empty")
      expect(r.selected).toEqual(["kiirtan"])
    })

    it("a stale tick on an emptied category does not count as 'another one is on'", () => {
      // dance_song was ticked, then emptied; kiirtan is the only live one: it is the last
      const r = toggleCategory(["kiirtan", "dance_song"], "kiirtan", counts())
      expect(r.result).toBe("last")
    })

    it("never leaves the list empty, whatever the taps", () => {
      let sel: ReturnType<typeof toggleCategory>["selected"] = ["prabhat_samgiita"]
      for (let i = 0; i < 200; i += 1) {
        const id = RADIO_CATEGORIES[(i * 7) % RADIO_CATEGORIES.length]
        sel = toggleCategory(sel, id, counts()).selected
        expect(sel.length).toBeGreaterThan(0)
        expect(sel).not.toContain("dance_song")
      }
    })
  })

  describe("effectiveSelection", () => {
    it("keeps the chosen that have tracks", () => {
      expect(effectiveSelection(["kiirtan", "dance_song"], counts())).toEqual(["kiirtan"])
    })
    it("falls back to the default, then to anything with tracks", () => {
      expect(effectiveSelection(["dance_song"], counts())).toEqual(["prabhat_samgiita"])
      expect(effectiveSelection(["dance_song"], counts({ prabhat_samgiita: 0 }))).toEqual([
        "kiirtan",
        "bhajan",
        "spiritual_song",
        "baba_audio",
      ])
      expect(effectiveSelection(["kiirtan"], NO_COUNTS)).toEqual([])
    })
  })

  describe("All", () => {
    it("ticks every category that has tracks and skips the empty one", () => {
      const all = selectAll(counts())
      expect(all).toEqual(["prabhat_samgiita", "kiirtan", "bhajan", "spiritual_song", "baba_audio"])
      expect(isAllSelected(all, counts())).toBe(true)
      expect(isAllSelected(["kiirtan"], counts())).toBe(false)
    })
  })

  describe("summaryLine", () => {
    it("says all when everything live is on", () => {
      expect(summaryLine(selectAll(counts()), counts())).toEqual({ type: "all" })
    })
    it("lists up to three names, then folds the rest", () => {
      expect(summaryLine(["kiirtan", "bhajan"], counts())).toEqual({ type: "list", shown: ["kiirtan", "bhajan"], more: 0 })
      const four = summaryLine(["prabhat_samgiita", "kiirtan", "bhajan", "baba_audio"], counts())
      expect(four).toEqual({ type: "list", shown: ["prabhat_samgiita", "kiirtan"], more: 2 })
    })
    it("one single category is a one-name list, not 'all'", () => {
      expect(summaryLine(["kiirtan"], counts())).toEqual({ type: "list", shown: ["kiirtan"], more: 0 })
    })
  })
})

describe("radio selection store", () => {
  beforeEach(() => {
    memory.clear()
    useRadioSelectionStore.getState().reset()
  })

  it("starts on Prabhat Samgiita, as the Radio always did", () => {
    expect(useRadioSelectionStore.getState().selected).toEqual(["prabhat_samgiita"])
  })

  it("toggles, guards the last tick and reports it", () => {
    const s = useRadioSelectionStore.getState()
    expect(s.toggle("kiirtan", counts())).toBe("added")
    expect(useRadioSelectionStore.getState().selected).toEqual(["prabhat_samgiita", "kiirtan"])
    expect(useRadioSelectionStore.getState().toggle("prabhat_samgiita", counts())).toBe("removed")
    expect(useRadioSelectionStore.getState().toggle("kiirtan", counts())).toBe("last")
    expect(useRadioSelectionStore.getState().selected).toEqual(["kiirtan"])
    expect(useRadioSelectionStore.getState().toggle("dance_song", counts())).toBe("empty")
    expect(useRadioSelectionStore.getState().selected).toEqual(["kiirtan"])
  })

  it("All ticks every live category", () => {
    useRadioSelectionStore.getState().chooseAll(counts())
    expect(useRadioSelectionStore.getState().selected).toHaveLength(5)
  })

  it("is remembered: written under a versioned key", async () => {
    useRadioSelectionStore.getState().toggle("bhajan", counts())
    await Promise.resolve()
    const raw = memory.get("prabhat-radio-selection")
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw as string)
    expect(parsed.version).toBe(RADIO_SELECTION_VERSION)
    expect(parsed.state.selected).toEqual(["prabhat_samgiita", "bhajan"])
  })

  it("rehydrates a saved choice", async () => {
    memory.set(
      "prabhat-radio-selection",
      JSON.stringify({ state: { selected: ["kiirtan", "baba_audio"] }, version: RADIO_SELECTION_VERSION }),
    )
    await useRadioSelectionStore.persist.rehydrate()
    expect(useRadioSelectionStore.getState().selected).toEqual(["kiirtan", "baba_audio"])
  })

  it("migrates an older or broken saved value without losing what still reads", async () => {
    memory.set(
      "prabhat-radio-selection",
      JSON.stringify({ state: { selected: ["devotional_song", "mystery", "kiirtan"] }, version: 0 }),
    )
    await useRadioSelectionStore.persist.rehydrate()
    expect(useRadioSelectionStore.getState().selected).toEqual(["kiirtan", "bhajan"])
    memory.set("prabhat-radio-selection", JSON.stringify({ state: { selected: [] }, version: 0 }))
    await useRadioSelectionStore.persist.rehydrate()
    expect(useRadioSelectionStore.getState().selected).toEqual(["prabhat_samgiita"])
  })
})
