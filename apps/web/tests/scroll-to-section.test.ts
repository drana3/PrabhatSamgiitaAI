import { describe, expect, it, vi } from "vitest"

import { scrollElementAboveKeyboard, scrollToSectionId, stickyHeaderOffset } from "@/lib/scroll-to-section"

describe("scrollToSectionId", () => {
  it("scrolls below the sticky site header", () => {
    document.body.innerHTML = `
      <div class="sticky top-0" style="height:80px"></div>
      <section id="lyrics" style="height:200px;margin-top:400px">Lyrics</section>
    `
    window.scrollTo = vi.fn()
    Object.defineProperty(window, "scrollY", { value: 120, configurable: true })
    const sticky = document.querySelector(".sticky.top-0") as HTMLElement
    vi.spyOn(sticky, "getBoundingClientRect").mockReturnValue({
      top: 0,
      left: 0,
      right: 0,
      bottom: 80,
      width: 320,
      height: 80,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const section = document.getElementById("lyrics")!
    vi.spyOn(section, "getBoundingClientRect").mockReturnValue({
      top: 420,
      left: 0,
      right: 0,
      bottom: 620,
      width: 320,
      height: 200,
      x: 0,
      y: 420,
      toJSON: () => ({}),
    })

    scrollToSectionId("lyrics")

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: expect.any(Number),
      behavior: "auto",
    })
    const top = vi.mocked(window.scrollTo).mock.calls[0]?.[0]?.top as number
    expect(top).toBeGreaterThan(300)
    expect(stickyHeaderOffset()).toBe(80)
  })
})

describe("scrollElementAboveKeyboard", () => {
  it("scrolls the focused search shell into the mobile visible area", () => {
    document.body.innerHTML = `
      <div class="sticky top-0" style="height:64px"></div>
      <div id="search-shell">Search</div>
    `
    window.scrollBy = vi.fn()
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query.includes("max-width: 767px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: { offsetTop: 0, height: 400 },
    })
    const sticky = document.querySelector(".sticky.top-0") as HTMLElement
    vi.spyOn(sticky, "getBoundingClientRect").mockReturnValue({
      top: 0, left: 0, right: 0, bottom: 64, width: 390, height: 64, x: 0, y: 0, toJSON: () => ({}),
    })
    const shell = document.getElementById("search-shell")!
    vi.spyOn(shell, "getBoundingClientRect").mockReturnValue({
      top: 280, left: 0, right: 0, bottom: 340, width: 390, height: 60, x: 0, y: 280, toJSON: () => ({}),
    })

    scrollElementAboveKeyboard(shell)

    expect(window.scrollBy).toHaveBeenCalled()
  })
})
