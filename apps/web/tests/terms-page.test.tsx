import React from "react"
import { render, screen } from "@testing-library/react"

import TermsPage, { metadata } from "@/app/terms/page"
import { COPYRIGHT_EMAIL, MINIMUM_AGE, SUPPORT_EMAIL } from "@/lib/contact"

vi.mock("@/components/site-header", () => ({ SiteHeader: () => <header data-testid="site-header" /> }))

describe("/terms page", () => {
  it("is titled and says the minimum age", () => {
    expect(String(metadata.title)).toMatch(/Terms of use/)
    render(<TermsPage />)
    expect(screen.getByRole("heading", { level: 1, name: "Terms of use" })).toBeInTheDocument()
    expect(MINIMUM_AGE).toBe(16)
    expect(screen.getByText(/at least/i).textContent).toContain("16 years old")
  })

  it("covers uploads, the licence, takedown, deletion and no warranty", () => {
    render(<TermsPage />)
    for (const name of [
      "What you may upload",
      "What you allow us to do with your upload",
      "Copyright and removal requests",
      "Your account and deleting it",
      "No warranty",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument()
    }
  })

  it("links to the takedown, deletion and privacy pages and shows the contact addresses", () => {
    render(<TermsPage />)
    expect(screen.getByRole("link", { name: "copyright notice form" })).toHaveAttribute("href", "/takedown")
    expect(screen.getByRole("link", { name: "account deletion page" })).toHaveAttribute("href", "/delete-account")
    expect(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/privacy")
    expect(screen.getByRole("link", { name: COPYRIGHT_EMAIL })).toHaveAttribute("href", `mailto:${COPYRIGHT_EMAIL}`)
    expect(screen.getByRole("link", { name: SUPPORT_EMAIL })).toHaveAttribute("href", `mailto:${SUPPORT_EMAIL}`)
  })
})
