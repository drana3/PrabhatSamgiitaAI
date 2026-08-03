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

/** Suggested questions when the companion is grounded on one song. */
export function songCompanionSuggestions(song: { number: number; title: string }): string[] {
  const shortTitle = song.title.length > 42 ? `${song.title.slice(0, 40).trim()}…` : song.title
  return [
    `What is PS ${song.number} about?`,
    `Explain the spiritual meaning of “${shortTitle}”`,
    `Explain PS ${song.number} in Hindi`,
    `How can I use PS ${song.number} in meditation?`,
  ]
}

/** Browse-mode prompts when no song is selected yet. */
export function generalCompanionSuggestions(): string[] {
  return [
    "Suggest a morning devotion song",
    "Which song helps with peace of mind?",
    "Tell me about Prabhat Samgiita",
    "Recommend a song for meditation",
  ]
}

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

/** Prefer an explicit PS number in the prompt, else the currently loaded song. */
export function resolveExplainSongNumber(prompt: string, currentSongNumber?: number | null): number {
  const match = prompt.match(
    /\b(?:song|ps|prabhat\s+(?:samgiita|sangeet))\s*(?:number|no\.?|#)?\s*(\d{1,4})\b/i,
  )
  if (match) {
    const number = Number(match[1])
    if (number >= 1 && number <= 5018) return number
  }
  if (/^\d{1,4}$/.test(prompt.trim())) {
    const number = Number(prompt.trim())
    if (number >= 1 && number <= 5018) return number
  }
  if (currentSongNumber && currentSongNumber >= 1 && currentSongNumber <= 5018) {
    return currentSongNumber
  }
  return 1
}

export function hasUserMessages(messages: ChatMessage[]): boolean {
  return messages.some((message) => message.role === "user")
}
