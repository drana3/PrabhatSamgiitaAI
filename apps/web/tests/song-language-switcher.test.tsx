import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SongLanguageSwitcher } from "@/components/song-language-switcher"

vi.mock("next/navigation", () => ({
  usePathname: () => "/songs/1",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

beforeEach(() => {
  window.sessionStorage.clear()
  window.scrollTo = vi.fn()
})

describe("song language translation state", () => {
  it("announces progress, keeps position, and clears after translated content arrives", async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const view = render(<SongLanguageSwitcher selectedLanguage="en" navigate={navigate} />)
    const language = screen.getByLabelText("Language")

    await user.selectOptions(language, "hi")

    expect(screen.getByRole("status")).toHaveTextContent("Translating")
    expect(language).toBeDisabled()
    expect(navigate).toHaveBeenCalledWith("/songs/1?language=hi")
    expect(window.sessionStorage.getItem("song-translation-scroll")).not.toBeNull()

    view.rerender(<SongLanguageSwitcher selectedLanguage="hi" navigate={navigate} />)

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(language).toBeEnabled()
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" }))
  })

  it("pins Lyrics when the in-section switcher changes language", async () => {
    const user = userEvent.setup()
    const onLanguageChange = vi.fn()
    window.history.replaceState(null, "", "/songs/1#meaning")

    render(
      <SongLanguageSwitcher selectedLanguage="en" onLanguageChange={onLanguageChange} />,
    )
    await user.selectOptions(screen.getByLabelText("Language"), "hi")

    expect(onLanguageChange).toHaveBeenCalledWith("hi")
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      "/songs/1?language=hi#lyrics",
    )
    expect(window.sessionStorage.getItem("song-translation-scroll")).toBeNull()
  })
})
