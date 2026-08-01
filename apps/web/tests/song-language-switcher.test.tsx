import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SongLanguageSwitcher } from "@/components/song-language-switcher"

const replace = vi.fn()
vi.mock("next/navigation", () => ({
  usePathname: () => "/songs/1",
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}))

beforeEach(() => {
  replace.mockClear()
  window.sessionStorage.clear()
  window.scrollTo = vi.fn()
})

describe("song language translation state", () => {
  it("announces progress, keeps position, and clears after translated content arrives", async () => {
    const user = userEvent.setup()
    const view = render(<SongLanguageSwitcher selectedLanguage="en" />)
    const language = screen.getByLabelText("Reading language")

    await user.selectOptions(language, "hi")

    expect(screen.getByRole("status")).toHaveTextContent("Translation in progress")
    expect(language).toBeDisabled()
    expect(replace).toHaveBeenCalledWith("/songs/1?language=hi", { scroll: false })
    expect(window.sessionStorage.getItem("song-translation-scroll")).not.toBeNull()

    view.rerender(<SongLanguageSwitcher selectedLanguage="hi" />)

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(language).toBeEnabled()
  })
})
