import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import { ExploreClient } from "@/components/explore-client"
import { COMPLETE_SARGAM_LABEL } from "@/lib/complete-sargam"

const searchSongs = vi.fn()
const searchSongsByVoice = vi.fn()
const fetchSongs = vi.fn()
const fetchPublishedSargamSongs = vi.fn()
const searchCatalogLyrics = vi.fn(() => [])
const shouldSearchCatalogLyrics = vi.fn(() => false)

vi.mock("@/lib/api", () => ({
  searchSongs: (...args: unknown[]) => searchSongs(...args),
  searchSongsByVoice: (...args: unknown[]) => searchSongsByVoice(...args),
  fetchSongs: (...args: unknown[]) => fetchSongs(...args),
  fetchPublishedSargamSongs: (...args: unknown[]) => fetchPublishedSargamSongs(...args),
}))

vi.mock("@/lib/lyric-search", () => ({
  searchCatalogLyrics: (...args: unknown[]) => searchCatalogLyrics(...args),
  shouldSearchCatalogLyrics: (...args: unknown[]) => shouldSearchCatalogLyrics(...args),
  instantExploreSongs: (query: string) => {
    if (!shouldSearchCatalogLyrics(query)) return null
    const hits = searchCatalogLyrics(query) as Array<{
      number: number
      title: string
      firstLine: string
      snippet?: string
    }>
    if (!hits.length) return null
    return hits.map((hit) => ({
      number: hit.number,
      title: hit.firstLine || hit.title,
      first_line: hit.snippet || hit.firstLine || hit.title,
      is_verified: true,
    }))
  },
  lyricHitsToSongs: (hits: Array<{ number: number; title: string; firstLine: string; snippet?: string }>) =>
    hits.map((hit) => ({
      number: hit.number,
      title: hit.firstLine || hit.title,
      first_line: hit.snippet || hit.firstLine || hit.title,
      is_verified: true,
    })),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/explore",
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("@/lib/scroll-to-section", () => ({
  scrollToSectionId: vi.fn(),
}))

vi.mock("@/components/member-provider", () => ({
  useMember: () => ({ loading: false, session: { authenticated: false }, refresh: vi.fn() }),
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
    fetchPublishedSargamSongs.mockReset()
    searchCatalogLyrics.mockReset()
    shouldSearchCatalogLyrics.mockReset()
    fetchSongs.mockResolvedValue([])
    fetchPublishedSargamSongs.mockResolvedValue([])
    searchSongs.mockResolvedValue([])
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

  it("falls through to catalog search when local prefetch is unavailable", async () => {
    searchSongs.mockResolvedValue([prefetchedSong])
    renderExplore(
      <ExploreClient
        initialSongs={[]}
        initialQuery="Musafir aage badhate hain"
        searchKind="catalog"
      />,
    )

    await waitFor(() => {
      expect(searchSongs).toHaveBeenCalledWith("Musafir aage badhate hain", { mode: "catalog" })
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

    const input = screen.getByLabelText(/Search by number/i)
    await user.type(input, "bandhu he niye calo")
    expect(input).toHaveValue("bandhu he niye calo")
    expect(await screen.findByRole("listbox", { name: "Song suggestions" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Search", exact: true }))
    expect(await screen.findByRole("heading", { name: "Bandhu He Niye Calo" })).toBeInTheDocument()
    expect(searchSongs).not.toHaveBeenCalled()
  })

  it("keeps theme asks on catalog search instead of embeddings", async () => {
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
      expect(searchSongs).toHaveBeenCalledWith("songs about peace", { mode: "catalog" })
    })
    expect(searchSongs).not.toHaveBeenCalledWith("songs about peace", { mode: "semantic" })
  })

  it("lists complete Sargam from the API with local fallback", async () => {
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
      expect(fetchPublishedSargamSongs).toHaveBeenCalled()
      expect(searchSongs).not.toHaveBeenCalled()
    })
    expect(await screen.findByText(/Showing songs for:/i)).toBeInTheDocument()
    expect(screen.getByText(COMPLETE_SARGAM_LABEL)).toBeInTheDocument()
  })

  it("loads collection prompts from the catalog search API", async () => {
    searchSongs.mockResolvedValue([prefetchedSong])
    const user = userEvent.setup()

    renderExplore(
      <ExploreClient
        initialSongs={[]}
        initialQuery=""
        searchKind="catalog"
      />,
    )

    await user.click(screen.getByRole("link", { name: /English 3/ }))

    await waitFor(() => {
      expect(searchSongs).toHaveBeenCalledWith(
        "Search Prabhat Samgiita for English Songs",
        { mode: "catalog" },
      )
    })
    expect(await screen.findByRole("heading", { name: /Tomar Katha Bhavi/i })).toBeInTheDocument()
  })

  it("suggests Feeling search when catalog finds nothing", async () => {
    searchSongs.mockResolvedValue([])
    const user = userEvent.setup()

    renderExplore(
      <ExploreClient
        initialSongs={[]}
        initialQuery=""
        searchKind="catalog"
      />,
    )

    await user.type(screen.getByLabelText(/Search by number/i), "peaceful devotion")
    await user.click(screen.getByRole("button", { name: "Search", exact: true }))

    expect(
      await screen.findByRole("heading", { name: "No songs matched — try Feeling search" }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Sign in, then enable Feeling search in Profile/i).length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Sign in for Feeling search" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "No songs matched your search criteria" })).not.toBeInTheDocument()
  })

  it("does not fetch the browse song list when Explore has no query", async () => {
    renderExplore(
      <ExploreClient
        initialSongs={[{ number: 1, title: "Seed", first_line: "Seed", is_verified: true }]}
        initialQuery=""
        searchKind="catalog"
      />,
    )

    await waitFor(() => {
      expect(fetchSongs).not.toHaveBeenCalled()
    })
    expect(screen.queryByRole("heading", { name: "Seed" })).not.toBeInTheDocument()
  })

  it("clears collection search without showing Feeling empty state", async () => {
    searchSongs.mockResolvedValue([prefetchedSong])
    const user = userEvent.setup()

    renderExplore(
      <ExploreClient
        initialSongs={[]}
        initialQuery=""
        searchKind="catalog"
      />,
    )

    await user.click(screen.getByRole("link", { name: /English 3/ }))
    expect(await screen.findByRole("heading", { name: /Tomar Katha Bhavi/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Search by number/i)).toHaveValue("English")
    expect(screen.queryByDisplayValue(/Search Prabhat Samgiita for/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Clear search" }))
    await waitFor(() => {
      expect(screen.queryByText(/Showing songs for:/i)).not.toBeInTheDocument()
    })
    expect(screen.queryByRole("heading", { name: /No songs matched — try Feeling search/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Search by number/i)).toHaveValue("")
  })
})
