import {
  conversationContextMs,
  followUpQuestions,
  followUpsFromMessages,
  formatAssistantMessage,
  recentConversation,
  restoreConversation,
  starterPrompts,
} from "@/lib/chat"
import { detectChatLanguage } from "@/lib/chat-language"

describe("AI companion conversation contract", () => {
  it("keeps recent turns for ten minutes and expires older context", () => {
    const now = 1_000_000
    const messages = [
      { role: "user" as const, text: "old question", createdAt: now - conversationContextMs - 1 },
      { role: "user" as const, text: "is gaane ka arth batao", createdAt: now - 1_000 },
      { role: "assistant" as const, text: "Yeh gaana prem aur shanti ke baare mein hai.", createdAt: now - 500 },
    ]

    expect(recentConversation(messages, now).map((turn) => turn.content)).toEqual([
      "is gaane ka arth batao",
      "Yeh gaana prem aur shanti ke baare mein hai.",
    ])
    expect(restoreConversation(JSON.stringify(messages), now)).toHaveLength(2)
  })

  it("detects Hindi from Romanized user input", () => {
    expect(detectChatLanguage("is gaane ka arth batao")).toBe("hi")
    expect(detectChatLanguage("Explain this song")).toBe("en")
  })

  it("formats assistant replies for chat display", () => {
    expect(formatAssistantMessage("A grounded answer. [1]\n\nSources:\n[1] Song 1 (meaning)")).toBe(
      "A grounded answer.",
    )
  })

  it("offers starter prompts before the first question", () => {
    expect(starterPrompts()[0]).toMatch(/about/i)
    expect(starterPrompts("hi")[0]).toMatch(/arth/i)
  })

  it("offers useful next questions without repeating the current ask", () => {
    const followUps = followUpQuestions("Explain this song line by line")
    expect(followUps).toHaveLength(3)
    expect(followUps.some((question) => /line by line/i.test(question))).toBe(false)
  })

  it("switches follow-up language to match the user", () => {
    const followUps = followUpQuestions("is gaane ka arth batao", { language: "hi" })
    expect(followUps[0]).toMatch(/line|arth|bhav/i)
  })

  it("builds follow-ups from the full conversation", () => {
    const followUps = followUpsFromMessages([
      { role: "assistant", text: "Namaskar.", createdAt: 1 },
      { role: "user", text: "Explain this song line by line", createdAt: 2 },
      { role: "assistant", text: "Here is the meaning.", createdAt: 3 },
    ])
    expect(followUps.some((question) => /line by line/i.test(question))).toBe(false)
  })

  it("limits API history to the most recent twelve valid turns", () => {
    const messages = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 ? "assistant" as const : "user" as const,
      text: `turn ${index}`,
      createdAt: 10_000 + index,
    }))

    const history = recentConversation(messages, 20_000)
    expect(history).toHaveLength(12)
    expect(history[0].content).toBe("turn 8")
    expect(history[11].content).toBe("turn 19")
  })
})
