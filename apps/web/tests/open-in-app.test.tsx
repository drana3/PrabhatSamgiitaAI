import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { OpenInApp } from "@/components/open-in-app"

describe("OpenInApp", () => {
  beforeEach(() => {
    sessionStorage.clear()
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    })
    Object.defineProperty(window.navigator, "webdriver", {
      configurable: true,
      value: false,
    })
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it("hands a shared song to the installed app when open=app is present", () => {
    window.history.replaceState(null, "", "/songs/111?open=app")
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "https://www.prabhatasamgiita.org/songs/111?open=app", search: "?open=app" },
      writable: true,
    })
    render(<OpenInApp songNumber={111} />)
    expect(window.location.href).toBe("prabhatai:///song/ps-111")
  })

  it("does not redirect ordinary mobile song browsing", () => {
    window.history.replaceState(null, "", "/songs/111")
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "https://www.prabhatasamgiita.org/songs/111", search: "" },
      writable: true,
    })
    render(<OpenInApp songNumber={111} />)
    expect(window.location.href).toBe("https://www.prabhatasamgiita.org/songs/111")
  })
})
