import React from "react"
import { render, screen } from "@testing-library/react"

import { StoriesInspiration, SongStoriesPanel } from "@/components/stories-inspiration"

vi.mock("@/lib/api", () => ({
  fetchFeaturedStory: vi.fn().mockResolvedValue(null),
  fetchStories: vi.fn().mockResolvedValue([]),
}))

describe("StoriesInspiration", () => {
  it("renders featured story and browse link from seed fallback", async () => {
    render(<StoriesInspiration />)
    expect(await screen.findByRole("heading", { name: /Memories from the Prabhat Samgiita journey/i })).toBeVisible()
    expect(screen.getByRole("link", { name: /Browse all stories/i })).toHaveAttribute("href", "/stories")
    expect(screen.getByText(/Featured today/i)).toBeVisible()
  })
})

describe("SongStoriesPanel", () => {
  it("shows linked story for song 419", () => {
    render(<SongStoriesPanel songNumber={419} />)
    expect(screen.getByText(/Connected to this song/i)).toBeVisible()
    expect(screen.getByText(/Ananda Karuna/i)).toBeVisible()
  })

  it("renders nothing when no stories are linked", () => {
    const { container } = render(<SongStoriesPanel songNumber={1} />)
    expect(container).toBeEmptyDOMElement()
  })
})
