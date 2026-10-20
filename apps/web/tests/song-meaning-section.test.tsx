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

  it("uses stored Hindi meaning but still localizes Central idea", async () => {
    fetchSongLocalization.mockResolvedValue({
      localized_meaning: "हिन्दी अर्थ",
      localized_explanation: "अनुवादित केंद्रीय भाव",
    })

    render(
      <SongMeaningSection
        songNumber={1}
        song={{
          ...song,
          hindi_meaning: "हिन्दी अर्थ",
          central_idea: "Paramapurusa is the real friend.",
        }}
        initialLanguage="hi"
      />,
    )

    expect(await screen.findByText("हिन्दी अर्थ")).toBeInTheDocument()
    expect(await screen.findByText("अनुवादित केंद्रीय भाव")).toBeInTheDocument()
    expect(screen.getByText(/Central idea \(English\)/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(fetchSongLocalization).toHaveBeenCalledWith(1, "Hindi")
    })
  })

  it("offers copy for the visible meaning", async () => {
    fetchSongLocalization.mockResolvedValue({
      localized_explanation: "A simple heart of the song.",
      explanation_kind: "generated",
    })
    render(
      <SongMeaningSection songNumber={42} song={song} initialLanguage="en" />,
    )

    expect(await screen.findByRole("button", { name: "Copy meaning" })).toBeInTheDocument()
  })

  it("shows an LLM simple Central idea when the song has no official purport", async () => {
    fetchSongLocalization.mockResolvedValue({
      localized_meaning: "Door de sluier van duisternis heen.",
      localized_explanation: "Het lied vraagt om licht in eenvoudige woorden.",
      explanation_kind: "generated",
    })

    render(
      <SongMeaningSection songNumber={42} song={song} initialLanguage="nl" />,
    )

    expect(await screen.findByText("Door de sluier van duisternis heen.")).toBeInTheDocument()
    expect(screen.getByText(/In simple words/i)).toBeInTheDocument()
    expect(screen.getByText("Het lied vraagt om licht in eenvoudige woorden.")).toBeInTheDocument()
  })
})
