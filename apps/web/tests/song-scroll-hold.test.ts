import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"

import { useSongScrollHold } from "@/lib/song-scroll-hold"
import { scrollToSectionId } from "@/lib/scroll-to-section"

vi.mock("@/lib/scroll-to-section", () => ({
  scrollToSectionId: vi.fn(),
  stickyHeaderOffset: () => 0,
}))

describe("useSongScrollHold", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, "", "/songs/1#lyrics")
    document.body.innerHTML =
      '<main><section id="lyrics"></section><section id="meaning"></section></main>'
    class RO {
      cb: ResizeObserverCallback
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb
      }
      observe() {
        this.cb([], this as unknown as ResizeObserver)
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", RO)
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute("data-song-scroll-hold")
    document.documentElement.style.removeProperty("overflow-anchor")
  })

  it("pins to lyrics while active", () => {
    renderHook(() => useSongScrollHold("lyrics", true))
    expect(scrollToSectionId).toHaveBeenCalledWith("lyrics")
    expect(document.documentElement.getAttribute("data-song-scroll-hold")).toBe("lyrics")
  })

  it("does not pin when inactive", () => {
    renderHook(() => useSongScrollHold("lyrics", false))
    expect(scrollToSectionId).not.toHaveBeenCalled()
  })
})
