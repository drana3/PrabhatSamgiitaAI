import { describe, expect, it } from "vitest"

import { savedViewState } from "@/lib/savedView"
import { distinctSubtitle } from "@/lib/songMap"

describe("savedViewState (BUG-28)", () => {
  it("shows only the loading state while the first sync has nothing yet", () => {
    expect(savedViewState({ syncing: true, count: 0 })).toBe("loading")
  })

  it("shows the empty state only when not syncing and nothing is saved", () => {
    expect(savedViewState({ syncing: false, count: 0 })).toBe("empty")
  })

  it("shows the list as soon as there are rows, even during a refresh", () => {
    expect(savedViewState({ syncing: true, count: 3 })).toBe("list")
    expect(savedViewState({ syncing: false, count: 3 })).toBe("list")
  })
})

describe("distinctSubtitle (BUG-13)", () => {
  it("hides a subtitle that repeats the title", () => {
    expect(distinctSubtitle("Bandhu He Niye Calo", "Bandhu He Niye Calo")).toBeNull()
  })

  it("ignores case, spacing and trailing punctuation when comparing", () => {
    expect(distinctSubtitle("Bandhu he niye calo", "  BANDHU HE NIYE CALO. ")).toBeNull()
  })

  it("keeps a subtitle that adds information", () => {
    expect(distinctSubtitle("Song 1", "Bandhu He Niye Calo")).toBe("Bandhu He Niye Calo")
  })

  it("returns null for empty values", () => {
    expect(distinctSubtitle("Title", "")).toBeNull()
    expect(distinctSubtitle("Title", undefined)).toBeNull()
  })
})

/**
 * These two UI fixes live in React Native components that the node test
 * environment cannot render, so the contract is pinned on the source text.
 */
describe("component contracts", () => {
  const read = async (rel: string) => {
    const { readFileSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    return readFileSync(resolve(__dirname, "..", rel), "utf8")
  }

  it("Continue listening titles wrap to two lines (BUG-31)", async () => {
    const src = await read("components/home/ContinueListeningRow.tsx")
    expect(src).toMatch(/styles\.title\} numberOfLines=\{2\}/)
  })

  it("MiniPlayer never reads currentSong.number before its null guard", async () => {
    const src = await read("components/player/MiniPlayer.tsx")
    const guard = src.indexOf("if (!currentSong) return null")
    expect(guard).toBeGreaterThan(0)
    const beforeGuard = src.slice(0, guard)
    expect(beforeGuard).not.toMatch(/currentSong\.(number|title|id)/)
  })
})
