export type ChatLanguage = "en" | "hi" | "other"

const INDIC_SCRIPT =
  /[\u0900-\u097F\u0980-\u09FF\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0A00-\u0A7F]/

const ROMANIZED_HINDI =
  /\b(?:gaane|gaana|gana|arth|matlab|batao|bataiye|samjha|samjhaiye|kya|hai|mera|tum|aap|pyar|prem|bhakti|shanti|prashn|pichhla|hindi|hindustani|sandarbh|bhav|ruhani|adhyatmik)\b/i

export function detectChatLanguage(text: string): ChatLanguage {
  const trimmed = text.trim()
  if (!trimmed) return "en"
  if (/[\u0900-\u097F]/.test(trimmed)) return "hi"
  if (INDIC_SCRIPT.test(trimmed)) return "other"
  if (ROMANIZED_HINDI.test(trimmed)) return "hi"
  return "en"
}

export function conversationLanguage(userMessages: string[]): ChatLanguage {
  for (let index = userMessages.length - 1; index >= 0; index -= 1) {
    const language = detectChatLanguage(userMessages[index])
    if (language !== "en") return language
  }
  return "en"
}
