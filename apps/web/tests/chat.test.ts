import {
  conversationContextMs,
  followUpQuestions,
  recentConversation,
  restoreConversation,
} from "@/lib/chat"

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

  it("offers useful next questions after meanings, translation, and practice", () => {
    expect(followUpQuestions("explain its spiritual meaning")).toHaveLength(3)
    expect(followUpQuestions("translate in Hindi")[0]).toContain("spiritual meaning")
    expect(followUpQuestions("help me practise pronunciation")[0]).toContain("meaning")
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
