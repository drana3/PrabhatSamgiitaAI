import type { ConversationTurn } from "./explain"

export type ChatMessage = {
  role: "assistant" | "user"
  text: string
  createdAt: number
}

export const conversationContextMs = 10 * 60 * 1000
export const maximumConversationTurns = 12

export function recentConversation(
  messages: ChatMessage[],
  now = Date.now(),
): ConversationTurn[] {
  return messages
    .filter((message) => message.text.trim() && now - message.createdAt <= conversationContextMs)
    .slice(-maximumConversationTurns)
    .map((message) => ({ role: message.role, content: message.text.slice(0, 2000) }))
}

export function restoreConversation(raw: string | null, now = Date.now()): ChatMessage[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((message): message is ChatMessage => Boolean(
        message
        && typeof message === "object"
        && (message as ChatMessage).role in { assistant: true, user: true }
        && typeof (message as ChatMessage).text === "string"
        && typeof (message as ChatMessage).createdAt === "number"
        && now - (message as ChatMessage).createdAt <= conversationContextMs,
      ))
      .slice(-maximumConversationTurns)
  } catch {
    return []
  }
}

export function followUpQuestions(prompt: string, language?: string | null): string[] {
  const normalized = prompt.toLocaleLowerCase()
  if (/translat|hindi|bengali|magahi|maithili|urdu|தமிழ்|हिन्दी|বাংলা/.test(normalized)) {
    return [
      "Explain the spiritual meaning behind this translation",
      "Help me pronounce the opening lines",
      "Recommend a related Prabhat Samgiita",
    ]
  }
  if (/pronoun|sing|practi[cs]e|learn/.test(normalized)) {
    return [
      "Explain the meaning line by line",
      "Show me how to reflect on this song in meditation",
      "Recommend a related song to practise next",
    ]
  }
  if (/meaning|imagery|spiritual|explain|understand/.test(normalized)) {
    return [
      "Explain the imagery line by line",
      "How can I reflect on this song in meditation?",
      "Recommend a related Prabhat Samgiita",
    ]
  }
  if (/last|previous|conversation|chat/.test(normalized)) {
    return [
      "Summarize the key points from our conversation",
      "Return to this song's spiritual meaning",
      "Recommend a related Prabhat Samgiita",
    ]
  }
  return [
    `Explain this song${language ? ` in ${language}` : ""} line by line`,
    "What spiritual feeling does this song express?",
    "Recommend a related Prabhat Samgiita",
  ]
}
