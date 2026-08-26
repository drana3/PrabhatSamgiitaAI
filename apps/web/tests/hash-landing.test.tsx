import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { HashLanding } from "@/components/hash-landing"
import { scrollToSectionId } from "@/lib/scroll-to-section"

vi.mock("@/lib/scroll-to-section", () => ({
  scrollToSectionId: vi.fn(),
}))

describe("HashLanding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, "", "/songs/135")
    Object.defineProperty(window, "scrollRestoration", {
      configurable: true,
      value: "auto",
      writable: true,
    })
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    })
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0)
      return 0
    })
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined)
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  it("defaults to the AI companion when a song opens without a hash on desktop", async () => {
    render(<HashLanding />)

    await waitFor(() => {
      expect(window.location.hash).toBe("#ask")
      expect(scrollToSectionId).toHaveBeenCalledWith("ask")
    })
  })

  it("lands at the song start on mobile instead of the AI companion", async () => {
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
    window.history.replaceState(null, "", "/songs/135#ask")
    render(<HashLanding />)

    await waitFor(() => {
      expect(window.location.hash).toBe("")
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" })
    })
    expect(scrollToSectionId).not.toHaveBeenCalled()
  })

  it("honors an explicit section hash", async () => {
    window.history.replaceState(null, "", "/songs/135#notation")
    render(<HashLanding />)

    await waitFor(() => {
      expect(scrollToSectionId).toHaveBeenCalledWith("notation")
    })
    expect(window.location.hash).toBe("#notation")
  })

  it("honors explicit non-ask hashes on mobile", async () => {
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
    window.history.replaceState(null, "", "/songs/135#lyrics")
    render(<HashLanding />)

    await waitFor(() => {
      expect(scrollToSectionId).toHaveBeenCalledWith("lyrics")
    })
    expect(window.location.hash).toBe("#lyrics")
  })

  it("does not auto-open the AI companion when returning from sign-in", async () => {
    window.history.replaceState(null, "", "/songs/135?from=signin")
    render(<HashLanding />)

    await waitFor(() => {
      expect(window.location.pathname).toBe("/songs/135")
      expect(window.location.search).toBe("")
      expect(window.location.hash).toBe("")
    })
    expect(scrollToSectionId).not.toHaveBeenCalled()
  })
})
