import { render } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

import { SongScrollTop } from "@/components/song-scroll-top"

describe("SongScrollTop", () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("min-width: 768px") ? false : true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    window.history.replaceState(null, "", "/songs/135")
  })

  it("scrolls to top on mobile when opening a song without a hash", () => {
    render(<SongScrollTop songNumber={135} />)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" })
  })

  it("does not scroll when a section hash is present", () => {
    window.history.replaceState(null, "", "/songs/135#ask")
    render(<SongScrollTop songNumber={135} />)
    expect(window.scrollTo).not.toHaveBeenCalled()
  })
})
