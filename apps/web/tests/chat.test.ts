import {
  chatMemoryTurnsForSave,
  clearGuestChatStorage,
  clearMemberChatStorage,
  clearSongChatStorage,
  conversationContextMs,
  followUpQuestions,
  followUpsFromMessages,
  flattenHistoryDays,
  formatAssistantMessage,
  formatHistoryDayLabel,
  memberProfileContext,
  legacySongChatStorageKey,
  recentConversation,
  restoreConversation,
  songChatStorageKey,
  starterPrompts,
  storedMemberConversationMs,
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

  it("resumes preferred language after a one-shot explain-in-language request", () => {
    expect(conversationLanguage(["explain this song in hindi", "222"], "english")).toBe("en")
    expect(conversationLanguage(["explain this song in hindi", "ok"], "hindi")).toBe("hi")
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

  it("scopes member chat storage by member id", () => {
    expect(songChatStorageKey(3, true, "aad:user-1")).toBe("prabhat-song-chat-member-aad:user-1-3")
    expect(songChatStorageKey(3, true, "aad:user-2")).not.toBe(songChatStorageKey(3, true, "aad:user-1"))
    expect(songChatStorageKey(3, false)).toBe("prabhat-song-chat-guest-3")
  })

  it("keeps member chat cache when sign-out clears only guest storage", () => {
    const memberKey = songChatStorageKey(3, true, "aad:user-1")
    window.sessionStorage.setItem(memberKey, JSON.stringify([
      { role: "user", text: "member turn", createdAt: Date.now() },
    ]))
    window.sessionStorage.setItem(songChatStorageKey(3, false), JSON.stringify([
      { role: "user", text: "guest turn", createdAt: Date.now() },
    ]))
    window.sessionStorage.setItem(legacySongChatStorageKey(3), JSON.stringify([
      { role: "user", text: "legacy turn", createdAt: Date.now() },
    ]))

    clearGuestChatStorage()

    expect(window.sessionStorage.getItem(memberKey)).not.toBeNull()
    expect(window.sessionStorage.getItem(songChatStorageKey(3, false))).toBeNull()
    expect(window.sessionStorage.getItem(legacySongChatStorageKey(3))).toBeNull()

    clearSongChatStorage()
    expect(window.sessionStorage.getItem(memberKey)).toBeNull()
  })

  it("restores member-stored turns beyond the short live-context window", () => {
    const now = 1_000_000
    const raw = JSON.stringify([
      { role: "user", text: "Explain this song", createdAt: now - storedMemberConversationMs + 1_000 },
      { role: "assistant", text: "A lasting answer", createdAt: now - storedMemberConversationMs + 2_000 },
    ])
    expect(restoreConversation(raw, now)).toHaveLength(0)
    expect(restoreConversation(raw, now, storedMemberConversationMs)).toHaveLength(2)
  })

  it("clears only member chat storage for guest sessions", () => {
    window.sessionStorage.setItem(songChatStorageKey(3, true, "aad:user-1"), JSON.stringify([
      { role: "user", text: "member turn", createdAt: Date.now() },
    ]))
    window.sessionStorage.setItem(songChatStorageKey(3, false), JSON.stringify([
      { role: "user", text: "guest turn", createdAt: Date.now() },
    ]))

    clearMemberChatStorage()

    expect(window.sessionStorage.getItem(songChatStorageKey(3, true, "aad:user-1"))).toBeNull()
    expect(window.sessionStorage.getItem(songChatStorageKey(3, false))).not.toBeNull()
  })

  it("flattens day-grouped server history into chat messages", () => {
    const messages = flattenHistoryDays([
      {
        date: "2026-08-07",
        turns: [
          { role: "user", content: "Explain PS 12" },
          { role: "assistant", content: "PS 12 is devotional." },
        ],
      },
    ])
    expect(messages).toHaveLength(2)
    expect(messages[0]?.text).toBe("Explain PS 12")
  })

  it("combines archived and interest summaries for AI context", () => {
    expect(memberProfileContext("Likes meaning.", "2026-06: Asked about meditation.")).toBe(
      "2026-06: Asked about meditation.\n\nLikes meaning.",
    )
  })

  it("labels history days like ChatGPT", () => {
    const now = new Date("2026-08-08T10:00:00.000Z")
    expect(formatHistoryDayLabel("2026-08-08", now)).toBe("Today")
    expect(formatHistoryDayLabel("2026-08-07", now)).toBe("Yesterday")
  })
})
