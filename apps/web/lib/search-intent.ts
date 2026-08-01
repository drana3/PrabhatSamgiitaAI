export type SongSearchIntent = {
  number: number
  section?: "ask" | "lyrics" | "listen" | "notation"
}

const explanationTerms = /\b(?:about|explain|interpret|meaning|spiritual|tell\s+me|translate|why)\b/i

export function extractSongSearchIntent(value: string): SongSearchIntent | null {
  const query = value.normalize("NFKC").trim().replace(/\s+/g, " ")
  const exact = query.match(/^(?:(?:ps|prabhat samgiita|prabhat sangeet|song)\s*)?#?(\d{1,4})$/i)
  if (exact) return createIntent(Number(exact[1]), query)

  const numbers = Array.from(query.matchAll(/(?<!\d)(\d{1,4})(?!\d)/g), (match) => Number(match[1]))
  const inCatalog = [...new Set(numbers.filter((number) => number >= 1 && number <= 5018))]
  if (inCatalog.length !== 1) return null

  const number = inCatalog[0]
  const escapedNumber = String(number)
  const identifiesSong = [
    new RegExp(`\\b(?:ps|song)(?:\\s+(?:number|no\\.?))?\\s*#?\\s*${escapedNumber}\\b`, "i"),
    new RegExp(`\\bprabhat(?:\\s+[\\p{L}\\p{M}]+){0,3}\\s*#?\\s*${escapedNumber}\\b`, "iu"),
    new RegExp(`\\b${escapedNumber}\\s+(?:ps|song)\\b`, "i"),
  ].some((pattern) => pattern.test(query))
  const hasSongContext = /\b(?:prabhat|samgiita|sangeet|sagiat|song|ps)\b/i.test(query)

  if (!identifiesSong && !(hasSongContext && explanationTerms.test(query))) return null
  return createIntent(number, query)
}

export function songIntentPath(intent: SongSearchIntent) {
  return `/songs/${intent.number}${intent.section ? `#${intent.section}` : ""}`
}

function createIntent(number: number, query: string): SongSearchIntent | null {
  if (number < 1 || number > 5018) return null
  if (/\b(?:harmonium|notation|sargam|notes?)\b/i.test(query)) return { number, section: "notation" }
  if (/\b(?:audio|hear|listen|recording|video|watch)\b/i.test(query)) return { number, section: "listen" }
  if (/\b(?:lyrics?|words)\b/i.test(query)) return { number, section: "lyrics" }
  if (explanationTerms.test(query)) return { number, section: "ask" }
  return { number }
}
