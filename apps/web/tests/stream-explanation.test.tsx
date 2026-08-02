import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { StreamExplanation } from "@/components/stream-explanation"
import { streamExplanation } from "@/lib/explain"

vi.mock("@/lib/explain", () => ({ streamExplanation: vi.fn() }))
vi.mock("@/components/member-provider", () => ({
  useMember: () => ({ loading: false, session: { authenticated: false } }),
}))
vi.mock("@/lib/member", () => ({
  fetchMemberChat: vi.fn().mockResolvedValue({ summary: "", recent_turns: [] }),
  saveMemberChat: vi.fn().mockResolvedValue(true),
}))

const mockedStream = vi.mocked(streamExplanation)

describe("Prabhat Samgiita AI companion", () => {
  beforeEach(() => {
    mockedStream.mockReset()
    window.sessionStorage.clear()
  })

  it("presents a clearly identified, ready AI companion", () => {
    render(<StreamExplanation songNumber={135} />)

    expect(screen.getByRole("status", { name: /ready to help/i })).toBeVisible()
    expect(screen.getByRole("img", { name: "Prabhat Samgiita AI" })).toBeVisible()
    expect(screen.getByPlaceholderText("Ask Prabhat Samgiita AI about this song...")).toBeVisible()
    expect(screen.getByText(/Remembers this browser conversation for 10 minutes/i)).toBeVisible()
  })

  it("rejects gibberish before an AI request is made", async () => {
    const user = userEvent.setup()
    render(<StreamExplanation songNumber={135} />)

    await user.type(screen.getByLabelText("Ask about this song"), "kcwcbiubckebckcvjebfkjcckve")
    await user.click(screen.getByRole("button", { name: "Send question" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("specific about Prabhat Samgiita")
    expect(mockedStream).not.toHaveBeenCalled()
  })

  it("accepts Romanized Hindi and presents grounded follow-up choices", async () => {
    const user = userEvent.setup()
    mockedStream.mockImplementation(async (_number, onChunk) => {
      onChunk("Yeh gaana pyar, bhakti aur antarik shanti ko vyakt karta hai. [1]")
    })
    render(<StreamExplanation songNumber={452} />)

    await user.type(screen.getByLabelText("Ask about this song"), "is gaane ka arth pyar ke sandarbh mein batao")
    await user.click(screen.getByRole("button", { name: "Send question" }))

    expect(await screen.findByText(/Yeh gaana pyar/i)).toBeVisible()
    expect(mockedStream).toHaveBeenCalledWith(
      452,
      expect.any(Function),
      "is gaane ka arth pyar ke sandarbh mein batao",
      [],
      "",
    )
    expect(screen.getByText("Would you like to explore next?")).toBeVisible()
    expect(screen.getByText("Would you like to explore next?").parentElement?.querySelectorAll("button")).toHaveLength(3)
  })

  it("sends prior user and assistant turns with the next question", async () => {
    const user = userEvent.setup()
    mockedStream
      .mockImplementationOnce(async (_number, onChunk) => { onChunk("The song expresses formless beauty and peace. [1]") })
      .mockImplementationOnce(async (_number, onChunk) => { onChunk("Your previous question asked what the song means.") })
    render(<StreamExplanation songNumber={452} />)

    const input = screen.getByLabelText("Ask about this song")
    await user.type(input, "what this song is about")
    await user.click(screen.getByRole("button", { name: "Send question" }))
    await screen.findByText(/formless beauty/i)
    await user.type(input, "what did I ask last?")
    await user.click(screen.getByRole("button", { name: "Send question" }))

    await waitFor(() => expect(mockedStream).toHaveBeenCalledTimes(2))
    const history = mockedStream.mock.calls[1][3]
    expect(history).toEqual([
      { role: "user", content: "what this song is about" },
      { role: "assistant", content: "The song expresses formless beauty and peace. [1]" },
    ])
  })
})
