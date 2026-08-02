import {
  chatMemoryTurnsForSave,
  clearMemberChatStorage,
  clearSongChatStorage,
  conversationContextMs,
  followUpQuestions,
  followUpsFromMessages,
  formatAssistantMessage,
  legacySongChatStorageKey,
  recentConversation,
  restoreConversation,
  songChatStorageKey,
  starterPrompts,
} from "@/lib/chat"
import { conversationLanguage, detectChatLanguage } from "@/lib/chat-language"

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

  it("does not keep Hindi follow-ups after an English numeric turn", () => {
    expect(conversationLanguage(["explain this song in hindi", "222"])).toBe("en")
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
    expect(followUps[0]).toMatch(/arth|bhav|dhyan/i)
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

  it("stores trimmed companion replies for member chat memory", () => {
    const turns = chatMemoryTurnsForSave(
      "What is this song about?",
      "A grounded answer. [1]\n\nSources:\n[1] Song 1 (meaning)\n" + "x".repeat(9000),
    )
    expect(turns[0]?.content).toBe("What is this song about?")
    expect(turns[1]?.content).toBe("A grounded answer.")
    expect(turns[1]?.content.length).toBeLessThanOrEqual(8000)
  })

  it("keeps guest and member chat storage separate and clears both on sign out", () => {
    window.sessionStorage.setItem(songChatStorageKey(3, true), JSON.stringify([
      { role: "user", text: "member turn", createdAt: Date.now() },
    ]))
    window.sessionStorage.setItem(songChatStorageKey(3, false), JSON.stringify([
      { role: "user", text: "guest turn", createdAt: Date.now() },
    ]))
    window.sessionStorage.setItem(legacySongChatStorageKey(3), JSON.stringify([
      { role: "user", text: "legacy turn", createdAt: Date.now() },
    ]))

    clearSongChatStorage()

    expect(window.sessionStorage.getItem(songChatStorageKey(3, true))).toBeNull()
    expect(window.sessionStorage.getItem(songChatStorageKey(3, false))).toBeNull()
    expect(window.sessionStorage.getItem(legacySongChatStorageKey(3))).toBeNull()
  })

  it("clears only member chat storage for guest sessions", () => {
    window.sessionStorage.setItem(songChatStorageKey(3, true), JSON.stringify([
      { role: "user", text: "member turn", createdAt: Date.now() },
    ]))
    window.sessionStorage.setItem(songChatStorageKey(3, false), JSON.stringify([
      { role: "user", text: "guest turn", createdAt: Date.now() },
    ]))

    clearMemberChatStorage()

    expect(window.sessionStorage.getItem(songChatStorageKey(3, true))).toBeNull()
    expect(window.sessionStorage.getItem(songChatStorageKey(3, false))).not.toBeNull()
  })
})
