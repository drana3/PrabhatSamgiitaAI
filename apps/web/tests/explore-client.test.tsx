import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import { ExploreClient } from "@/components/explore-client"

const searchSongs = vi.fn()
const searchSongsByVoice = vi.fn()
const fetchSongs = vi.fn()
const searchCatalogLyrics = vi.fn(() => [])
const shouldSearchCatalogLyrics = vi.fn(() => false)

vi.mock("@/lib/api", () => ({
  searchSongs: (...args: unknown[]) => searchSongs(...args),
  searchSongsByVoice: (...args: unknown[]) => searchSongsByVoice(...args),
  fetchSongs: (...args: unknown[]) => fetchSongs(...args),
}))

vi.mock("@/lib/lyric-search", () => ({
  searchCatalogLyrics: (...args: unknown[]) => searchCatalogLyrics(...args),
  shouldSearchCatalogLyrics: (...args: unknown[]) => shouldSearchCatalogLyrics(...args),
  lyricHitsToSongs: (hits: Array<{ number: number; title: string; firstLine: string; snippet?: string }>) =>
    hits.map((hit) => ({
      number: hit.number,
      title: hit.firstLine || hit.title,
      first_line: hit.snippet || hit.firstLine || hit.title,
      is_verified: true,
    })),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("@/lib/scroll-to-section", () => ({
  scrollToSectionId: vi.fn(),
}))

vi.mock("@/components/voice-search-button", () => ({
  VoiceSearchButton: () => null,
}))

const prefetchedSong = {
  number: 111,
  title: "Tomar Katha Bhavi",
  first_line: "Tomar Katha Bhavi",
  is_verified: true,
}

function renderExplore(ui: React.ReactElement) {
  const client = new QueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe("ExploreClient prefetch hydration", () => {
  beforeEach(() => {
    searchSongs.mockReset()
    searchSongsByVoice.mockReset()
    fetchSongs.mockReset()
    searchCatalogLyrics.mockReset()
    shouldSearchCatalogLyrics.mockReset()
    fetchSongs.mockResolvedValue([])
    searchCatalogLyrics.mockReturnValue([])
    shouldSearchCatalogLyrics.mockReturnValue(false)
  })

  it("shows prefetched catalog results without a client search", async () => {
    renderExplore(
      <ExploreClient
        initialSongs={[prefetchedSong]}
        initialQuery="Musafir aage badhate hain"
        searchKind="catalog"
        searchPrefetched
      />,
    )

    expect(await screen.findByRole("heading", { name: /Tomar Katha Bhavi/i })).toBeInTheDocument()
    await waitFor(() => {
      expect(searchSongs).not.toHaveBeenCalled()
    })
  })

  it("runs a client catalog search when results were not prefetched", async () => {
    searchSongs.mockResolvedValue([prefetchedSong])

    renderExplore(
      <ExploreClient
        initialSongs={[]}
        initialQuery="Musafir aage badhate hain"
        searchKind="catalog"
      />,
    )

    await waitFor(() => {
      expect(searchSongs).toHaveBeenCalledWith(
        "Musafir aage badhate hain",
        { mode: "catalog" },
      )
    })
    expect(await screen.findByRole("heading", { name: /Tomar Katha Bhavi/i })).toBeInTheDocument()
  })

  it("resolves lyric lines locally without calling the search API", async () => {
    shouldSearchCatalogLyrics.mockReturnValue(true)
    searchCatalogLyrics.mockReturnValue([
      {
        number: 1,
        title: "BANDHU HE NIYE CALO",
        firstLine: "BANDHU HE NIYE CALO",
        snippet: "BANDHU HE NIYE CALO",
        score: 100,
        matchedBy: "opening_line",
      },
    ])
    const user = userEvent.setup()

    renderExplore(
      <ExploreClient
        initialSongs={[]}
        initialQuery=""
        searchKind="catalog"
      />,
    )

    await user.type(screen.getByLabelText(/Search by number/i), "bandhu he niye calo")
    await user.click(screen.getByRole("button", { name: "Search", exact: true }))

    expect(await screen.findByRole("heading", { name: "Bandhu He Niye Calo" })).toBeInTheDocument()
    expect(searchSongs).not.toHaveBeenCalled()
  })

  it("routes explore form theme asks to semantic search", async () => {
    searchSongs.mockResolvedValue([prefetchedSong])
    const user = userEvent.setup()

    renderExplore(
      <ExploreClient
        initialSongs={[]}
        initialQuery=""
        searchKind="catalog"
      />,
    )

    await user.type(screen.getByLabelText(/Search by number/i), "songs about peace")
    await user.click(screen.getByRole("button", { name: "Search", exact: true }))

    await waitFor(() => {
      expect(searchSongs).toHaveBeenCalledWith("songs about peace", { mode: "semantic" })
    })
  })

  it("lists complete Sargam from the local catalog without calling search", async () => {
    const user = userEvent.setup()

    renderExplore(
      <ExploreClient
        initialSongs={[]}
        initialQuery=""
        searchKind="catalog"
      />,
    )

    await user.click(screen.getByRole("button", { name: /Full Sargam/i }))

    await waitFor(() => {
      expect(searchSongs).not.toHaveBeenCalled()
    })
    expect(await screen.findByRole("heading", { name: /Songs with complete Sargam/i })).toBeInTheDocument()
  })
})
