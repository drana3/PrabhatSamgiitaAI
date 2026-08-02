import { queryGuidanceFor, queryIsUseful } from "@prabhat/core"

export type ChatMessage = {
  role: "assistant" | "user"
  text: string
}

export const STARTER_PROMPTS = [
  "What is this song about?",
  "Explain the spiritual imagery",
  "Explain this song in Hindi",
  "How can I reflect on this in meditation?",
]

export const FOLLOW_UP_PROMPTS = [
  "Explain the imagery and spiritual feeling",
  "Recommend a related Prabhat Samgiita",
  "How can I reflect on this in meditation?",
]

export function formatAssistantMessage(text: string): string {
  return text
    .replace(/\nSources:\n[\s\S]*$/i, "")
    .replace(/\nSources:\s[^\n]+/gi, "")
    .replace(/\s*\[\d+\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function validatePrompt(value: string): string | null {
  if (!queryIsUseful(value, 800)) return queryGuidanceFor(value)
  return null
}

export function hasUserMessages(messages: ChatMessage[]): boolean {
  return messages.some((message) => message.role === "user")
}
