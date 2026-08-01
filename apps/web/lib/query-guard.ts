export const queryGuidance =
  "Please ask something specific, such as “Song 1”, “songs for morning meditation”, or “What does this song mean?”"

const blocked = [
  /https?:\/\//i,
  /<\s*script/i,
  /\bignore\s+(?:all\s+)?previous\b/i,
  /\bsystem\s+prompt\b/i,
  /\bjailbreak\b/i,
]

export function queryIsUseful(value: string, maxLength = 600) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ")
  if (!normalized || normalized.length > maxLength || blocked.some((pattern) => pattern.test(normalized))) return false
  const compact = Array.from(normalized).filter((character) => /[\p{L}\p{M}\p{N}]/u.test(character)).join("")
  if (!compact) return false
  if (/^\d+$/.test(compact)) return Number(compact) >= 1 && Number(compact) <= 5018
  if (/(.)\1{4,}/iu.test(compact)) return false
  const latinOnly = /^[a-z]+$/i.test(compact)
  if (latinOnly && compact.length >= 7 && !/[aeiouy]/i.test(compact)) return false
  if (/qwerty|asdf|zxcv|qazwsx|poiuy|lkjhg/i.test(compact)) return false
  return true
}
