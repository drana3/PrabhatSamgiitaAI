import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { vi } from "vitest"

import { SongMeaningSection } from "@/components/song-meaning-section"

const fetchSongLocalization = vi.fn()

vi.mock("@/lib/api", () => ({
  fetchSongLocalization: (...args: unknown[]) => fetchSongLocalization(...args),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/songs/42",
  useSearchParams: () => new URLSearchParams("language=nl"),
}))

vi.mock("@/components/song-language-switcher", () => ({
  SongLanguageSwitcher: ({
    onLanguageChange,
  }: {
    onLanguageChange?: (language: string) => void
  }) => (
    <button type="button" onClick={() => onLanguageChange?.("nl")}>
      Switch to Dutch
    </button>
  ),
}))

const song = {
  english_meaning: "Piercing the veil of darkness.",
  hindi_meaning: null,
  metadata_json: {},
}

describe("SongMeaningSection", () => {
  beforeEach(() => {
    fetchSongLocalization.mockReset()
  })

  it("loads AI meaning for world languages with a long-running request", async () => {
    fetchSongLocalization.mockResolvedValue({
      localized_meaning: "Door de sluier van duisternis heen.",
    })

    render(
      <SongMeaningSection songNumber={42} song={song} initialLanguage="nl" />,
    )

    expect(screen.getByText("Translating meaning")).toBeInTheDocument()
    expect(await screen.findByText("Door de sluier van duisternis heen.")).toBeInTheDocument()
    await waitFor(() => {
      expect(fetchSongLocalization).toHaveBeenCalledWith(42, "Dutch")
    })
  })

  it("does not put English under a Dutch label when translation fails", async () => {
    fetchSongLocalization.mockResolvedValue({ localized_meaning: null })

    render(
      <SongMeaningSection songNumber={42} song={song} initialLanguage="nl" />,
    )

    expect(await screen.findByRole("alert")).toHaveTextContent("Dutch translation isn’t available")
    expect(screen.queryByText("Dutch meaning")).not.toBeInTheDocument()
    expect(screen.getByText("English")).toBeInTheDocument()
    expect(screen.getByText("Piercing the veil of darkness.")).toBeInTheDocument()
  })

  it("does not keep English copy under a Dutch label when the API echoes English", async () => {
    fetchSongLocalization.mockResolvedValue({
      localized_meaning: "Piercing the veil of darkness.",
    })

    render(
      <SongMeaningSection songNumber={42} song={song} initialLanguage="nl" />,
    )

    expect(await screen.findByRole("alert")).toHaveTextContent("Dutch translation isn’t available")
    expect(screen.queryByText("Dutch meaning")).not.toBeInTheDocument()
    expect(screen.getByText("English")).toBeInTheDocument()
  })

  it("uses stored Hindi without calling localization", async () => {
    render(
      <SongMeaningSection
        songNumber={1}
        song={{ ...song, hindi_meaning: "हिन्दी अर्थ" }}
        initialLanguage="hi"
      />,
    )

    expect(await screen.findByText("हिन्दी अर्थ")).toBeInTheDocument()
    expect(fetchSongLocalization).not.toHaveBeenCalled()
  })
})
