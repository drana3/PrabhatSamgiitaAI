import React from "react"
import { render, screen } from "@testing-library/react"

import { Providers } from "@/components/providers"
import { SearchForm } from "@/components/search-form"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

describe("SearchForm", () => {
  it("renders the search input", () => {
    render(
      <Providers>
        <SearchForm onResults={() => void 0} />
      </Providers>,
    )
    expect(screen.getByLabelText(/Search by number/i)).toBeInTheDocument()
  })
})
