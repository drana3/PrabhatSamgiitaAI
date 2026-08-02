export type ChatLanguage = "en" | "hi" | "other"

const INDIC_SCRIPT =
  /[\u0900-\u097F\u0980-\u09FF\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0A00-\u0A7F]/

const ROMANIZED_HINDI =
  /\b(?:gaane|gaana|gana|arth|matlab|batao|bataiye|samjha|samjhaiye|kya|hai|mera|tum|aap|pyar|prem|bhakti|shanti|prashn|pichhla|hindi|hindustani|sandarbh|bhav|ruhani|adhyatmik|dhyan|uchcharan|anuvad|bhasha)\b/i

const EXPLICIT_HINDI =
  /\b(?:in|into|to)\s+hindi\b|\bhindi\s+me(?:in|ṃ|in)?\b|\btranslate(?:d)?\s+(?:to|in)\s+hindi\b|[\u0900-\u097F]|हिन्दी|हिंदी/i

const EXPLICIT_ENGLISH =
  /\b(?:in|into|to)\s+english\b|\benglish\s+(?:me(?:in|ṃ|in)?|language|version)\b/i

const LANGUAGE_ONLY =
  /^(?:(?:in|into|to)\s+(?:hindi|english|bengali|urdu)|(?:hindi|english|bengali|urdu)\s+me(?:in|ṃ|in)?|(?:hindi|english)\s+me(?:in|ṃ|in)?\s+batao|translate(?:d)?\s+(?:to|in)\s+(?:hindi|english))\s*[?.!]*$/i

const AMBIGUOUS_FOLLOW_UP = /^(?:yes|no|ok|okay|more|continue|why|thanks|thank you|sure|please)\s*[?.!]*$/i

export function explicitResponseLanguage(text: string): ChatLanguage | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (EXPLICIT_ENGLISH.test(trimmed)) return "en"
  if (EXPLICIT_HINDI.test(trimmed)) return "hi"
  return null
}

function detectTextLanguage(text: string): ChatLanguage {
  const trimmed = text.trim()
  if (!trimmed) return "en"
  if (/[\u0900-\u097F]/.test(trimmed)) return "hi"
  if (INDIC_SCRIPT.test(trimmed)) return "other"
  if (ROMANIZED_HINDI.test(trimmed)) return "hi"
  return "en"
}

function inheritsLanguageFromHistory(query: string): boolean {
  const cleaned = query.trim()
  if (!cleaned) return false
  if (LANGUAGE_ONLY.test(cleaned)) return true
  if (detectTextLanguage(cleaned) !== "en") return false
  if (/^\d{1,4}$/.test(cleaned)) return false
  return AMBIGUOUS_FOLLOW_UP.test(cleaned)
}

export function detectChatLanguage(text: string): ChatLanguage {
  const explicit = explicitResponseLanguage(text)
  if (explicit) return explicit
  return detectTextLanguage(text)
}

export function conversationLanguage(userMessages: string[]): ChatLanguage {
  if (!userMessages.length) return "en"
  const latest = userMessages[userMessages.length - 1]?.trim() ?? ""
  if (!latest) return "en"
  const explicit = explicitResponseLanguage(latest)
  if (explicit) return explicit
  const current = detectTextLanguage(latest)
  if (current !== "en" || !inheritsLanguageFromHistory(latest)) return current
  for (let index = userMessages.length - 2; index >= 0; index -= 1) {
    const language = detectTextLanguage(userMessages[index] ?? "")
    if (language !== "en") return language
  }
  return "en"
}
