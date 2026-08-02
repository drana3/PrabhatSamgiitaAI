export const queryGuidance =
  "Please ask something specific about Prabhat Samgiita, such as “Explain this song”, “What does this line mean?”, or “Recommend a song for meditation.”"

const blocked = [
  /https?:\/\//i,
  /<\s*script/i,
  /\bignore\s+(?:all\s+)?previous\b/i,
  /\bsystem\s+prompt\b/i,
  /\bjailbreak\b/i,
]

const lowValueWords = new Set(["fuck", "shit", "bitch", "idiot", "stupid", "testtest", "blah"])

export function queryIsUseful(value: string, maxLength = 600) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ")
  if (!normalized || normalized.length > maxLength || blocked.some((pattern) => pattern.test(normalized))) {
    return false
  }
  const explicitSongNumber = normalized.match(
    /\b(?:song|ps|prabhat\s+(?:samgiita|sangeet))\s*(?:number|no\.?|#)?\s*(\d{1,6})\b/i,
  )
  if (explicitSongNumber && (Number(explicitSongNumber[1]) < 1 || Number(explicitSongNumber[1]) > 5018)) {
    return false
  }
  const numericParts = normalized.match(/\d+/g) ?? []
  const hasSongContext = /\b(?:song|ps|prabhat|samgiita|sangeet|compare|meaning|lyrics|notation)\b/i.test(
    normalized,
  )
  if (!hasSongContext && (numericParts.length > 1 || numericParts.some((part) => part.length > 4))) {
    return false
  }
  const compact = Array.from(normalized)
    .filter((character) => /[\p{L}\p{M}\p{N}]/u.test(character))
    .join("")
  if (!compact) return false
  if (/^\d+$/.test(compact)) return Number(compact) >= 1 && Number(compact) <= 5018
  if (/(.)\1{4,}/iu.test(compact)) return false
  const words = normalized.toLocaleLowerCase().match(/[^\W\d_]+/gu) ?? []
  if (words.length && words.every((word) => lowValueWords.has(word))) return false
  return true
}

export function queryGuidanceFor(value: string) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ")
  if (/^\d+$/.test(normalized)) {
    const number = Number(normalized)
    if (number < 1 || number > 5018) {
      return "Prabhat Samgiita song numbers run from 1 to 5,018."
    }
  }
  return queryGuidance
}
