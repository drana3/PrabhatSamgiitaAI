import React from "react"
import { render, screen } from "@testing-library/react"

import { MobileAppHeroStrip } from "@/components/mobile-app-invite"

describe("MobileAppHeroStrip", () => {
  it("shows the compact invite with app name, QR codes, and store badges", () => {
    render(<MobileAppHeroStrip />)

    expect(screen.getByText(/Best on phone or tablet/i)).toBeInTheDocument()
    expect(screen.getByText("Prabhat Samgiita AI")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Download on the App Store/i })).toHaveAttribute(
      "href",
      expect.stringContaining("apps.apple.com"),
    )
    expect(screen.getByRole("link", { name: /Get it on Google Play/i })).toHaveAttribute(
      "href",
      expect.stringContaining("play.google.com"),
    )
    expect(screen.getByAltText(/Scan for iPhone & iPad/i)).toBeInTheDocument()
    expect(screen.getByAltText(/Scan for Android/i)).toBeInTheDocument()
  })
})
