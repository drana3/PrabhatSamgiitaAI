import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { OpenInApp } from "@/components/open-in-app"

describe("OpenInApp", () => {
  const originalHref = window.location.href

  beforeEach(() => {
    sessionStorage.clear()
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    })
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: originalHref },
      writable: true,
    })
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it("hands a shared song to the installed app on a phone", () => {
    render(<OpenInApp songNumber={111} />)
    expect(window.location.href).toBe("prabhatai:///song/ps-111")
  })

  it("does not loop after the first handoff", () => {
    render(<OpenInApp songNumber={111} />)
    window.location.href = "https://www.prabhatasamgiita.org/songs/111"
    render(<OpenInApp songNumber={111} />)
    expect(window.location.href).toBe("https://www.prabhatasamgiita.org/songs/111")
  })
})
