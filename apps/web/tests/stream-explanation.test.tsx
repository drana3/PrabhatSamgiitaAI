import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { StreamExplanation } from "@/components/stream-explanation"
import { streamExplanation } from "@/lib/explain"

vi.mock("@/lib/explain", () => ({ streamExplanation: vi.fn() }))
vi.mock("@/components/member-provider", () => ({
  useMember: () => memberState.value,
}))
vi.mock("@/lib/member", () => ({
  fetchMemberChat: vi.fn().mockResolvedValue({ summary: "", recent_turns: [] }),
  saveMemberChat: vi.fn().mockResolvedValue(true),
}))

const mockedStream = vi.mocked(streamExplanation)
const memberState = vi.hoisted(() => ({
  value: { loading: false, session: { authenticated: false } },
}))

describe("Prabhat Samgiita AI companion", () => {
  beforeEach(() => {
    mockedStream.mockReset()
    memberState.value = { loading: false, session: { authenticated: false } }
    window.sessionStorage.clear()
    Reflect.deleteProperty(window, "webkitSpeechRecognition")
  })

  it("shows starter prompts before the first question", () => {
    render(<StreamExplanation songNumber={135} />)
    expect(screen.getByText("Try asking")).toBeVisible()
    expect(screen.getByRole("button", { name: "What is this song about?" })).toBeVisible()
    expect(screen.queryByText("Would you like to explore next?")).not.toBeInTheDocument()
  })

  it("presents a clearly identified, ready AI companion", () => {
    render(<StreamExplanation songNumber={135} />)

    expect(screen.getByRole("status", { name: /ready to help/i })).toBeVisible()
    expect(screen.getByRole("img", { name: "Prabhat Samgiita AI" })).toBeVisible()
    expect(screen.getByPlaceholderText("Ask Prabhat Samgiita AI about this song...")).toBeVisible()
    expect(screen.getByText(/Guest.*grounded answers first/i)).toBeVisible()
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
    expect(screen.getByText("Would you like to explore next?").parentElement?.querySelectorAll("button").length).toBeGreaterThanOrEqual(2)
  })

  it("does not restore a signed-in conversation after sign out", async () => {
    const now = Date.now()
    window.sessionStorage.setItem("prabhat-song-chat-member-135", JSON.stringify([
      { role: "user", text: "Explain line by line", createdAt: now },
      { role: "assistant", text: "1. Lyric: old answer", createdAt: now + 1 },
    ]))

    memberState.value = { loading: false, session: { authenticated: true } }
    const { rerender } = render(<StreamExplanation songNumber={135} />)
    expect(await screen.findByText(/Explain line by line/i)).toBeVisible()

    memberState.value = { loading: false, session: { authenticated: false } }
    rerender(<StreamExplanation songNumber={135} />)

    await waitFor(() => {
      expect(screen.queryByText(/Explain line by line/i)).not.toBeInTheDocument()
    })
    expect(screen.getByText("Try asking")).toBeVisible()
  })

  it("does not restore an older guest conversation after sign out", async () => {
    const now = Date.now()
    window.sessionStorage.setItem("prabhat-song-chat-guest-135", JSON.stringify([
      { role: "user", text: "Old guest question", createdAt: now },
      { role: "assistant", text: "Old guest answer", createdAt: now + 1 },
    ]))

    memberState.value = { loading: false, session: { authenticated: true } }
    const { rerender } = render(<StreamExplanation songNumber={135} />)
    await waitFor(() => {
      expect(screen.queryByText(/Old guest question/i)).not.toBeInTheDocument()
    })

    memberState.value = { loading: false, session: { authenticated: false } }
    rerender(<StreamExplanation songNumber={135} />)

    await waitFor(() => {
      expect(screen.queryByText(/Old guest question/i)).not.toBeInTheDocument()
    })
    expect(screen.getByText("Try asking")).toBeVisible()
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

  it("fills the question box from voice input", async () => {
    class Recognition {
      continuous = false
      interimResults = false
      lang = ""
      maxAlternatives = 1
      onresult: ((event: { resultIndex: number; results: { length: number; [index: number]: { 0: { transcript: string } } } }) => void) | null = null
      onerror: (() => void) | null = null
      onend: (() => void) | null = null

      start() {
        this.onresult?.({
          resultIndex: 0,
          results: { 0: { 0: { transcript: "what is this song about" } }, length: 1 },
        })
      }

      stop() {
        this.onend?.()
      }
    }
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: Recognition })

    const user = userEvent.setup()
    render(<StreamExplanation songNumber={135} />)

    await user.click(screen.getByRole("button", { name: "Ask by voice" }))

    expect(screen.getByLabelText("Ask about this song")).toHaveValue("what is this song about")
  })
})
