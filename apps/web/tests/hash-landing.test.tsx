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
  })

  it("defaults to the AI companion when a song opens without a hash", async () => {
    render(<HashLanding />)

    await waitFor(() => {
      expect(window.location.hash).toBe("#ask")
      expect(scrollToSectionId).toHaveBeenCalledWith("ask")
    })
  })

  it("honors an explicit section hash", async () => {
    window.history.replaceState(null, "", "/songs/135#notation")
    render(<HashLanding />)

    await waitFor(() => {
      expect(scrollToSectionId).toHaveBeenCalledWith("notation")
    })
    expect(window.location.hash).toBe("#notation")
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
