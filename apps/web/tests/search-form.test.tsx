import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SearchForm } from "@/components/search-form"

vi.mock("@/components/member-provider", () => ({
  useMember: () => ({ loading: false, session: { authenticated: false } }),
}))

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/" }))

describe("SearchForm", () => {
  it("renders the search input", () => {
    const client = new QueryClient()
    render(
      <QueryClientProvider client={client}>
        <SearchForm onResults={() => void 0} />
      </QueryClientProvider>,
    )
    expect(screen.getByLabelText(/Search by number/i)).toBeInTheDocument()
  })

  it("shows searching on the button while an external search is running", () => {
    const client = new QueryClient()
    render(
      <QueryClientProvider client={client}>
        <SearchForm onResults={() => void 0} isSearching />
      </QueryClientProvider>,
    )
    expect(screen.getByRole("button", { name: "Searching" })).toBeDisabled()
    expect(screen.getByText("Searching")).toBeInTheDocument()
  })

  it("suggests catalog songs while typing", async () => {
    const user = userEvent.setup()
    const client = new QueryClient()
    render(
      <QueryClientProvider client={client}>
        <SearchForm onResults={() => void 0} />
      </QueryClientProvider>,
    )
    await user.type(screen.getByLabelText(/Search by number/i), "1")
    expect(screen.getByRole("listbox", { name: "Song suggestions" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /PS 1\b/i })).toHaveAttribute("href", "/songs/1#ask")
  })
})
