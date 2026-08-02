import type { ConversationTurn } from "./explain"
import { type ChatLanguage, conversationLanguage, detectChatLanguage } from "./chat-language"

export type ChatMessage = {
  role: "assistant" | "user"
  text: string
  createdAt: number
}

export const conversationContextMs = 10 * 60 * 1000
export const maximumConversationTurns = 12

export function songChatStorageKey(songNumber: number, authenticated: boolean) {
  return `prabhat-song-chat-${authenticated ? "member" : "guest"}-${songNumber}`
}

export function legacySongChatStorageKey(songNumber: number) {
  return `prabhat-song-chat-${songNumber}`
}

export function clearSongChatStorage() {
  try {
    for (const key of Object.keys(window.sessionStorage)) {
      if (key.startsWith("prabhat-song-chat-")) {
        window.sessionStorage.removeItem(key)
      }
    }
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}

export function formatAssistantMessage(text: string): string {
  return text
    .replace(/\nSources:\n[\s\S]*$/i, "")
    .replace(/\nSources:\s[^\n]+/gi, "")
    .replace(/\s*\[\d+\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function hasUserMessages(messages: ChatMessage[]): boolean {
  return messages.some((message) => message.role === "user")
}

export function starterPrompts(language: ChatLanguage = "en"): string[] {
  if (language === "hi") {
    return [
      "Is gaane ka sar arth kya hai?",
      "Har line ka arth samjhaiye",
      "Is gaane ki ruhani bhavna kya hai?",
    ]
  }
  return [
    "What is this song about?",
    "Explain the meaning line by line",
    "Are there devotee stories connected to this song?",
  ]
}

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

type FollowUpOptions = {
  priorUserPrompts?: string[]
  priorAssistantText?: string
  language?: ChatLanguage
}

function alreadyAsked(prompts: string[], pattern: RegExp): boolean {
  return prompts.some((prompt) => pattern.test(prompt))
}

function assistantCovered(text: string, pattern: RegExp): boolean {
  return pattern.test(text.toLocaleLowerCase())
}

function pickUnique(candidates: string[], limit = 3): string[] {
  const seen = new Set<string>()
  const selected: string[] = []
  for (const candidate of candidates) {
    const key = candidate.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    selected.push(candidate)
    if (selected.length >= limit) break
  }
  return selected
}

export function followUpQuestions(
  prompt: string,
  options: FollowUpOptions = {},
): string[] {
  const normalized = prompt.toLocaleLowerCase()
  const prior = (options.priorUserPrompts ?? []).map((entry) => entry.toLocaleLowerCase())
  const asked = [...prior, normalized]
  const language = options.language ?? detectChatLanguage(prompt)
  const assistantText = options.priorAssistantText ?? ""

  const english = {
    lineByLine: "Explain the meaning line by line",
    imagery: "Explain the imagery and spiritual feeling",
    meditation: "How can I reflect on this song in meditation?",
    related: "Recommend a related Prabhat Samgiita",
    pronunciation: "Help me pronounce the opening lines",
    overview: "What is this song about?",
    conversation: "Summarize what we have discussed so far",
  }

  const hindi = {
    lineByLine: "Har line ka arth aur bhav samjhaiye",
    imagery: "Is gaane ki imagery aur ruhani bhavna samjhaiye",
    meditation: "Is gaane par dhyan kaise karein?",
    related: "Is se juda koi aur Prabhat Samgiita suggest kijiye",
    pronunciation: "Shuru ki lines ka uchcharan batayiye",
    overview: "Is gaane ka sar arth kya hai?",
    conversation: "Ab tak ki baat-chit ka saar batayiye",
  }

  const copy = language === "hi" ? hindi : english
  const candidates: string[] = []

  if (/translat|hindi|bengali|magahi|maithili|urdu|language|भाषा|अनुवाद/.test(normalized)) {
    if (!alreadyAsked(asked, /spiritual meaning|ruhani|imagery|bhav/)) {
      candidates.push(copy.imagery)
    }
    if (!alreadyAsked(asked, /pronoun|uchcharan|pronunciation/)) {
      candidates.push(copy.pronunciation)
    }
    if (!alreadyAsked(asked, /related|recommend|suggest|jud/)) {
      candidates.push(copy.related)
    }
  } else if (/pronoun|sing|practi[cs]e|learn|uchcharan/.test(normalized)) {
    if (!alreadyAsked(asked, /line.?by.?line|har line/)) {
      candidates.push(copy.lineByLine)
    }
    if (!alreadyAsked(asked, /meditation|dhyan/)) {
      candidates.push(copy.meditation)
    }
    if (!alreadyAsked(asked, /related|recommend|suggest|jud/)) {
      candidates.push(copy.related)
    }
  } else if (/line.?by.?line|har line|imagery|imagery/.test(normalized)) {
    if (!alreadyAsked(asked, /meditation|dhyan/)) {
      candidates.push(copy.meditation)
    }
    if (!alreadyAsked(asked, /spiritual feeling|ruhani|bhavna/)) {
      candidates.push(copy.imagery)
    }
    if (!alreadyAsked(asked, /related|recommend|suggest|jud/)) {
      candidates.push(copy.related)
    }
  } else if (/meaning|spiritual|explain|understand|arth|matlab|about/.test(normalized)) {
    if (!alreadyAsked(asked, /line.?by.?line|har line/) && !assistantCovered(assistantText, /line.?by.?line|lyric:/)) {
      candidates.push(copy.lineByLine)
    }
    if (!alreadyAsked(asked, /meditation|dhyan/) && !assistantCovered(assistantText, /meditation|reflect|dhyan/)) {
      candidates.push(copy.meditation)
    }
    if (!alreadyAsked(asked, /related|recommend|suggest|jud/) && !assistantCovered(assistantText, /related|song \d+/)) {
      candidates.push(copy.related)
    }
  } else if (/last|previous|conversation|chat|summar|recap|pichhla/.test(normalized)) {
    if (!alreadyAsked(asked, /summar|recap|saar/)) {
      candidates.push(copy.conversation)
    }
    if (!alreadyAsked(asked, /meaning|about|arth|overview/)) {
      candidates.push(copy.overview)
    }
    if (!alreadyAsked(asked, /related|recommend|suggest|jud/)) {
      candidates.push(copy.related)
    }
  } else {
    if (!alreadyAsked(asked, /meaning|about|arth|overview/)) {
      candidates.push(copy.overview)
    }
    if (!alreadyAsked(asked, /line.?by.?line|har line/)) {
      candidates.push(copy.lineByLine)
    }
    if (!alreadyAsked(asked, /spiritual feeling|ruhani|imagery|bhavna/)) {
      candidates.push(copy.imagery)
    }
  }

  return pickUnique(candidates)
}

export function followUpsFromMessages(messages: ChatMessage[]): string[] {
  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.text)
  if (!userMessages.length) return []
  const latest = userMessages.at(-1) ?? ""
  const assistantText = messages
    .filter((message) => message.role === "assistant")
    .map((message) => formatAssistantMessage(message.text))
    .join("\n")
  return followUpQuestions(latest, {
    priorUserPrompts: userMessages.slice(0, -1),
    priorAssistantText: assistantText,
    language: conversationLanguage(userMessages),
  })
}
