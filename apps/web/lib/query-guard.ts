export const queryGuidance =
  "Please ask something specific about Prabhat Samgiita, such as “Explain this song”, “What does this line mean?”, or “Recommend a song for meditation.”"
export const unrelatedGuidance =
  "I can help with Prabhat Samgiita songs — meaning, lyrics, meditation, and language. Please ask something specific about the song you are exploring."
export const songRangeGuidance = "Prabhat Samgiita song numbers run from 1 to 5,018. Please enter a number within that range."

const injectionPatterns = [
  /https?:\/\//i,
  /<\s*script/i,
  /\bignore\s+(?:all\s+)?previous\b/i,
  /\bdisregard\s+(?:all\s+)?(?:prior|previous|above)\b/i,
  /\bforget\s+(?:everything|all|your)\b/i,
  /\bsystem\s+prompt\b/i,
  /\b(?:reveal|show|print|repeat|dump)\s+(?:your|the)\s+(?:system|hidden|developer|secret)\s+(?:prompt|instructions)\b/i,
  /\b(?:act|behave|pretend|roleplay)\s+(?:as|like)\b/i,
  /\bdo anything now\b/i,
  /\bDAN\b/,
  /\bjailbreak\b/i,
  /\boverride\s+(?:your|the)\s+(?:rules|instructions|guidelines|policy)\b/i,
  /\bnew instructions?\b/i,
  /\byou are now\b/i,
  /\bbypass\s+(?:the\s+)?(?:filter|safety|guard|rules)\b/i,
  /\b(?:execute|run)\s+(?:this\s+)?(?:python|code|script|command)\b/i,
  /\b(?:import\s+os|import\s+subprocess|subprocess\.|eval\s*\(|exec\s*\()/i,
  /```(?:python|javascript|js|bash|sh)\b/i,
  /\bdrop\s+table\b/i,
  /\bunion\s+select\b/i,
  /\brm\s+-rf\b/i,
  /\bbase64\s+decode\b/i,
]

const unrelatedPatterns = [
  /\b(?:weather|forecast|temperature)\b/i,
  /\b(?:stock|crypto|bitcoin|ethereum)\s+(?:price|market|trading)\b/i,
  /\b(?:write|generate|create|build)\s+(?:a\s+)?(?:python|javascript|java|c\+\+)\s+(?:program|code|script|app)\b/i,
  /\b(?:homework|assignment|essay)\s+(?:for|about)\b/i,
  /\btell me a joke\b/i,
  /\bwho is (?:the\s+)?(?:president|prime minister|ceo of)\b/i,
  /\brecipe for\b/i,
  /\btranslate this email\b/i,
  /\b(?:solve|calculate)\s+(?:this|the)\s+(?:equation|math|problem)\b/i,
]

const codeRequestPatterns = [
  /\b(?:python|javascript|java|c\+\+)\s+(?:program|code|script)\b/i,
  /\bwrite(?: me)?(?: a)? code\b/i,
]

const songContextPattern =
  /\b(?:song|ps|prabhat|samgiita|sangeet|compare|meaning|mean|lyrics|notation|explain|about|understand|arth|matlab|batao|samjha|gaane|gaana|gana|dhyan|meditation|meditate|pronounc|related|story|stories|hindi|english|bengali|urdu|translate|imagery|spiritual|reflect|devotee|this|it|that|line|message|overview|summary|recap|longing|surrender|devotion|divine|light|peace|bliss|love|friend|bandhu|guru|krishna|shiva)\b/i

const lowValueWords = new Set(["fuck", "shit", "bitch", "idiot", "stupid", "testtest", "blah"])
const vagueFillers = new Set(["hi", "hey", "hello", "ok", "okay", "yes", "no", "why", "what", "help", "hmm", "thanks", "thank", "you"])
const followUpPhrases = new Set([
  "ok",
  "okay",
  "yes",
  "yeah",
  "yep",
  "continue",
  "go on",
  "more",
  "in hindi",
  "in english",
  "hindi mein",
  "english mein",
  "tell me more",
  "explain more",
  "say more",
])

const indicScript = /[\u0900-\u097F\u0980-\u09FF\u0B80-\u0BFF\u0C00-\u0C7F\u0600-\u06FF]/

type QueryGuardOptions = {
  companion?: boolean
  allowFollowUp?: boolean
}

function hasSongContext(normalized: string) {
  return songContextPattern.test(normalized)
}

function isFollowUpPhrase(normalized: string) {
  const cleaned = normalized.toLocaleLowerCase().trim()
  if (followUpPhrases.has(cleaned)) return true
  if (cleaned.startsWith("in ") && cleaned.split(/\s+/).length <= 4) return true
  return cleaned.endsWith(" mein") || cleaned.endsWith(" me")
}

export function queryIsUseful(value: string, maxLength = 600, options: QueryGuardOptions = {}) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ")
  const companion = options.companion ?? false
  const allowFollowUp = options.allowFollowUp ?? false
  if (!normalized || normalized.length > maxLength) return false
  if (injectionPatterns.some((pattern) => pattern.test(normalized))) return false
  if (unrelatedPatterns.some((pattern) => pattern.test(normalized))) return false
  if (codeRequestPatterns.some((pattern) => pattern.test(normalized))) return false
  if (normalized.toLocaleLowerCase().startsWith("search prabhat samgiita for ")) return true

  if (companion) {
    if (allowFollowUp && isFollowUpPhrase(normalized)) return true
    const words = normalized.toLocaleLowerCase().match(/[^\W\d_]+/gu) ?? []
    if (
      !allowFollowUp &&
      words.length <= 2 &&
      !hasSongContext(normalized) &&
      !indicScript.test(normalized) &&
      (words.length <= 1 || words.every((word) => vagueFillers.has(word)))
    ) {
      return false
    }
  }

  const explicitSongNumber = normalized.match(/\b(?:song|ps|prabhat\s+(?:samgiita|sangeet))\s*(?:number|no\.?|#)?\s*(\d{1,6})\b/i)
  if (explicitSongNumber && (Number(explicitSongNumber[1]) < 1 || Number(explicitSongNumber[1]) > 5018)) return false
  const numericParts = normalized.match(/\d+/g) ?? []
  if (!companion && !hasSongContext(normalized) && (numericParts.length > 1 || numericParts.some((part) => part.length > 4))) return false
  const compact = Array.from(normalized).filter((character) => /[\p{L}\p{M}\p{N}]/u.test(character)).join("")
  if (!compact) return false
  if (/^\d+$/.test(compact)) return Number(compact) >= 1 && Number(compact) <= 5018
  if (/(.)\1{4,}/iu.test(compact)) return false
  const words = normalized.toLocaleLowerCase().match(/[^\W\d_]+/gu) ?? []
  if (words.length && words.every((word) => lowValueWords.has(word))) return false
  const latinOnly = /^[a-z]+$/i.test(compact)
  if (latinOnly) {
    if (compact.length >= 7 && !/[aeiouy]/i.test(compact)) return false
    const vowelRatio = (compact.match(/[aeiouy]/gi)?.length ?? 0) / compact.length
    if (words.length === 1 && compact.length >= 12 && vowelRatio < 0.22) return false
  }
  if (/qwerty|asdf|zxcv|qazwsx|poiuy|lkjhg/i.test(compact)) return false
  return true
}

export function queryGuidanceFor(value: string, options: QueryGuardOptions = {}) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ")
  if (injectionPatterns.some((pattern) => pattern.test(normalized))) return queryGuidance
  if (unrelatedPatterns.some((pattern) => pattern.test(normalized)) || codeRequestPatterns.some((pattern) => pattern.test(normalized))) {
    return unrelatedGuidance
  }
  const explicitSongNumber = normalized.match(/\b(?:song|ps|prabhat\s+(?:samgiita|sangeet))\s*(?:number|no\.?|#)?\s*(\d{1,6})\b/i)
  if (explicitSongNumber && (Number(explicitSongNumber[1]) < 1 || Number(explicitSongNumber[1]) > 5018)) return songRangeGuidance
  if (/^\d{1,4}$/.test(normalized) && (Number(normalized) < 1 || Number(normalized) > 5018)) return songRangeGuidance
  if (options.companion && !options.allowFollowUp && !hasSongContext(normalized) && !indicScript.test(normalized)) {
    const words = normalized.toLocaleLowerCase().match(/[^\W\d_]+/gu) ?? []
    if (words.length <= 2 && (words.length <= 1 || words.every((word) => vagueFillers.has(word)))) return unrelatedGuidance
  }
  return queryGuidance
}
