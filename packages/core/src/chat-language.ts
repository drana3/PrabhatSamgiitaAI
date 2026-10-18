export type ChatLanguage = "en" | "hi" | "other"

const INDIC_SCRIPT =
  /[\u0900-\u097F\u0980-\u09FF\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0A00-\u0A7F]/

const ROMANIZED_HINDI =
  /\b(?:gaane|gaana|gana|arth|matlab|batao|bataiye|bataiy|samjha|samjhaiye|samjh|kya|hai|mera|tum|aap|pyar|prem|bhakti|shanti|prashn|pichhla|pichle|hindi|hindustani|sandarbh|bhav|ruhani|adhyatmik|dhyan|uchcharan|anuvad|bhasha|bhaasha)\b/i

const EXPLICIT_HINDI =
  /\b(?:in|into|to)\s+hindi\b|\bhindi\s+me(?:in|ṃ|in)?\b|\bhindi\s+(?:language|version|me)\b|\btranslate(?:d)?\s+(?:to|in)\s+hindi\b|[\u0900-\u097F]|हिन्दी|हिंदी/i

const EXPLICIT_ENGLISH =
  /\b(?:in|into|to)\s+english\b|\benglish\s+(?:me(?:in|ṃ|in)?|language|version)\b/i

const REGIONAL_LANGUAGE_NAMES = [
  "magahi",
  "maithili",
  "bengali",
  "bangla",
  "urdu",
  "tamil",
  "telugu",
  "marathi",
  "punjabi",
  "gujarati",
  "odia",
  "oriya",
  "assamese",
  "nepali",
  "sanskrit",
  "kannada",
  "malayalam",
] as const

const LANGUAGE_ONLY =
  /^(?:(?:in|into|to)\s+(?:hindi|english|bengali|urdu|magahi|maithili|tamil|telugu|marathi|punjabi|gujarati|nepali|odia|assamese|sanskrit|kannada|malayalam)|(?:hindi|english|bengali|urdu|magahi|maithili)\s+me(?:in|ṃ|in)?|(?:hindi|english)\s+me(?:in|ṃ|in)?\s+batao|translate(?:d)?\s+(?:to|in)\s+(?:hindi|english|magahi|maithili|bengali|urdu))\s*[?.!]*$/i

export const DEFAULT_PREFERRED_LANGUAGE = "english"

export function normalizePreferredLanguage(value?: string | null): ChatLanguage | null {
  const cleaned = (value ?? "").trim().toLowerCase()
  if (!cleaned) return null
  if (cleaned === "en" || cleaned === "english") return "en"
  if (cleaned === "hi" || cleaned === "hindi" || cleaned === "hin" || cleaned === "devanagari") return "hi"
  if (REGIONAL_LANGUAGE_NAMES.some((name) => cleaned === name || cleaned.startsWith(`${name}-`))) return "other"
  return null
}

export function explicitResponseLanguage(text: string): ChatLanguage | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (EXPLICIT_ENGLISH.test(trimmed)) return "en"
  if (EXPLICIT_HINDI.test(trimmed)) return "hi"
  if (explicitTargetLanguageLabel(trimmed)) return "other"
  return null
}

export function explicitTargetLanguageLabel(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const inMatch = trimmed.match(
    new RegExp(`\\b(?:in|into|to)\\s+(${REGIONAL_LANGUAGE_NAMES.join("|")})\\b`, "i"),
  )
  if (inMatch?.[1]) return inMatch[1].charAt(0).toUpperCase() + inMatch[1].slice(1).toLowerCase()
  const meMatch = trimmed.match(
    new RegExp(`\\b(${REGIONAL_LANGUAGE_NAMES.join("|")})\\s+me(?:in|ṃ|in)?\\b`, "i"),
  )
  if (meMatch?.[1]) return meMatch[1].charAt(0).toUpperCase() + meMatch[1].slice(1).toLowerCase()
  return null
}

export function isLanguageRephrase(query: string): boolean {
  return LANGUAGE_ONLY.test(query.trim())
}

export function isOneShotLanguageRequest(query: string): boolean {
  const cleaned = query.trim()
  if (!cleaned || isLanguageRephrase(cleaned)) return false
  return explicitResponseLanguage(cleaned) !== null
}

export function resolvePreferredLanguage(value?: string | null): ChatLanguage {
  return normalizePreferredLanguage(value) ?? "en"
}

function detectTextLanguage(text: string): ChatLanguage {
  const trimmed = text.trim()
  if (!trimmed) return "en"
  if (/[\u0900-\u097F]/.test(trimmed)) return "hi"
  if (INDIC_SCRIPT.test(trimmed)) return "other"
  if (ROMANIZED_HINDI.test(trimmed)) return "hi"
  return "en"
}

function establishedLanguageFromHistory(history: Array<[string, string]>): ChatLanguage | null {
  let established: ChatLanguage | null = null
  for (const [role, content] of history) {
    if (role !== "user") continue
    if (isOneShotLanguageRequest(content)) continue
    if (isLanguageRephrase(content)) {
      const explicit = explicitResponseLanguage(content)
      if (explicit) established = explicit
      continue
    }
    const language = detectTextLanguage(content)
    if (language !== "en") {
      established = language
    } else if (established === null && !/^\d{1,4}$/.test(content.trim())) {
      established = "en"
    }
  }
  return established
}

export function sessionLanguage(
  history: Array<[string, string]> = [],
  preferredLanguage?: string | null,
): ChatLanguage {
  const established = establishedLanguageFromHistory(history)
  if (established) return established
  return resolvePreferredLanguage(preferredLanguage)
}

export function detectResponseLanguage(
  query: string,
  history: Array<[string, string]> = [],
  preferredLanguage?: string | null,
): ChatLanguage {
  const cleaned = query.trim()
  const explicit = explicitResponseLanguage(cleaned)
  if (explicit && isOneShotLanguageRequest(cleaned)) return explicit
  if (isLanguageRephrase(cleaned) && explicit) return explicit

  const current = detectTextLanguage(cleaned)
  if (current !== "en") return current

  return sessionLanguage(history, preferredLanguage)
}

export function conversationLanguage(
  userMessages: string[],
  preferredLanguage?: string | null,
): ChatLanguage {
  if (!userMessages.length) return resolvePreferredLanguage(preferredLanguage)
  const latest = userMessages[userMessages.length - 1]?.trim() ?? ""
  const history = userMessages.slice(0, -1).map((message) => ["user", message] as [string, string])
  if (isOneShotLanguageRequest(latest)) {
    return sessionLanguage(history, preferredLanguage)
  }
  return detectResponseLanguage(latest, history, preferredLanguage)
}

/** @deprecated Use detectResponseLanguage for parity with the API. */
export function detectChatLanguage(text: string): ChatLanguage {
  return detectResponseLanguage(text)
}

export function languageCompanionHint(language: ChatLanguage): string {
  if (language === "hi") return "Replying in Hindi · say “in English” to switch"
  if (language === "other") return "Replying in your chosen language · say “in English” to switch"
  return "Replying in English · say “in Hindi” to switch"
}

export function languageSwitchAcknowledgment(
  prior: ChatLanguage | null,
  target: ChatLanguage,
  targetLabel?: string | null,
): string {
  if (prior === target) {
    if (target === "hi") {
      return "हम पहले से हिंदी में बात कर रहे हैं। इस गीत के बारे में आप क्या जानना चाहेंगे?"
    }
    if (target === "en") {
      return "We're already chatting in English. What would you like to explore about this song?"
    }
    return "I'll keep replying in your chosen language. What would you like to ask about this song?"
  }
  if (target === "hi") {
    return "ठीक है — अब मैं हिंदी में उत्तर दूँगा। इस गीत के बारे में आप क्या जानना चाहेंगे?"
  }
  if (target === "en") {
    return "Sure — I'll continue in English. What would you like to explore about this song?"
  }
  const label = targetLabel ?? "your chosen language"
  return `Sure — I'll continue in ${label}. What would you like to explore about this song?`
}
