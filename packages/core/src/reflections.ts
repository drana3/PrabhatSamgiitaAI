import seedQuotes from "../../../data/seed/reflection_quotes.json"

import type { ReflectionQuote } from "./api"

export type SeedReflectionQuote = {
  quote_text: string
  attribution: string
  source_title: string
  source_url: string
  source_date: string | null
  themes: { values: string[] }
  observances: { values: string[] }
  verification_status: string
  is_active: boolean
}

const BOOK_SOURCE_MARKERS = [
  "ananda sutram",
  "ananda vacanamrtam",
  "ananda vachanamritam",
  "caryacarya",
  "prout in a nutshell",
] as const

const FIXED_CONTEXTS: Record<string, [string, string]> = {
  "1-1": ["new-year", "New Year"],
  "5-1": ["labour-day", "Labour Day"],
  "8-15": ["independence-day-india", "India Independence Day"],
  "9-21": ["international-day-of-peace", "International Day of Peace"],
  "12-10": ["human-rights-day", "Human Rights Day"],
}

const REVIEWED_FESTIVAL_DATES_2026: Record<string, string> = {
  "1-25": "R.U. Day",
  "2-12": "Niilakanth'a Divasa",
  "3-4": "Vasantotsava",
  "3-5": "Dadhicii Divas",
  "4-14": "Navavarsa",
  "5-1": "Ánanda Purnimá",
  "6-5": "PROUT Day",
  "8-28": "Shrávanii Purnimá",
  "9-6": "Kaoshiki Divas",
  "9-14": "Prabháta Saḿgiita Divasa",
  "10-1": "Sharadotsava",
  "10-2": "Public Day",
  "10-3": "Fine Arts Day",
  "10-4": "Music Day",
  "10-5": "Vijayotsava",
  "10-8": "Kiirtana Divas",
  "10-25": "Navánna",
  "11-8": "Diipavalii",
  "11-11": "Bhrátrdvitiiyá",
}

const INDIA_OBSERVANCES: Record<string, string> = {
  "1-12": "National Youth Day",
  "1-26": "Republic Day of India",
  "8-15": "Independence Day of India",
  "10-2": "Gandhi Jayanti",
  "10-31": "National Unity Day",
  "11-26": "Constitution Day of India",
}

export const reflectionSeedQuotes = seedQuotes as SeedReflectionQuote[]

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function sha256Hex(input: string): string {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const bitLength = data.length * 8
  const withOne = new Uint8Array(((data.length + 9 + 63) >> 6) << 6)
  withOne.set(data)
  withOne[data.length] = 0x80
  const view = new DataView(withOne.buffer)
  view.setUint32(withOne.length - 4, bitLength, false)

  for (let offset = 0; offset < withOne.length; offset += 64) {
    const w = new Uint32Array(64)
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false)
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i += 1) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0
      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }
    H[0] = (H[0] + a) >>> 0
    H[1] = (H[1] + b) >>> 0
    H[2] = (H[2] + c) >>> 0
    H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0
    H[5] = (H[5] + f) >>> 0
    H[6] = (H[6] + g) >>> 0
    H[7] = (H[7] + h) >>> 0
  }

  return H.map((value) => value.toString(16).padStart(8, "0")).join("")
}

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount))
}

export function hasBookProvenance(sourceTitle: string): boolean {
  const plain = sourceTitle
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
  return BOOK_SOURCE_MARKERS.some((marker) => plain.includes(marker))
}

function monthDayKey(month: number, day: number): string {
  return `${month}-${day}`
}

function fixedReviewedFestival(month: number, day: number, year: number): string | null {
  if (month === 5 && day === 21) return "Bábá Birthday"
  if (year === 2026) return REVIEWED_FESTIVAL_DATES_2026[monthDayKey(month, day)] ?? null
  return null
}

export function reflectionContext(
  day: Date,
  requestedTheme?: string,
): [string, string] {
  if (requestedTheme) return [slug(requestedTheme), requestedTheme]

  const festival = fixedReviewedFestival(day.getMonth() + 1, day.getDate(), day.getFullYear())
  if (festival) {
    const festivalSlug = slug(festival)
    if (festivalSlug.includes("birthday") || festivalSlug.includes("ananda")) {
      return ["ananda-purnima", festival]
    }
    return [festivalSlug, festival]
  }

  const fixed = FIXED_CONTEXTS[monthDayKey(day.getMonth() + 1, day.getDate())]
  if (fixed) return fixed

  const observance = INDIA_OBSERVANCES[monthDayKey(day.getMonth() + 1, day.getDate())]
  if (observance) return [slug(observance), observance]

  return ["daily-practice", "Daily spiritual reflection"]
}

function toIsoDate(day: Date): string {
  const year = day.getFullYear()
  const month = String(day.getMonth() + 1).padStart(2, "0")
  const date = String(day.getDate()).padStart(2, "0")
  return `${year}-${month}-${date}`
}

export function selectReflectionForDay(
  quotes: SeedReflectionQuote[],
  day: Date,
  requestedTheme?: string,
): ReflectionQuote | null {
  const [contextSlug, contextLabel] = reflectionContext(day, requestedTheme)
  const eligible = quotes.filter(
    (quote) =>
      quote.is_active
      && quote.verification_status === "source_verified"
      && hasBookProvenance(quote.source_title),
  )
  if (!eligible.length) return null

  const isoDay = toIsoDate(day)

  function score(quote: SeedReflectionQuote): [number, string] {
    const observances = new Set((quote.observances?.values ?? []).map(String))
    const themes = new Set((quote.themes?.values ?? []).map(String))
    const exactObservance = observances.has(contextSlug) ? 100 : 0
    const themeMatch = [...themes].some((theme) => slug(theme) === contextSlug) ? 30 : 0
    const stableKey = sha256Hex(`${isoDay}:${quote.source_url}`)
    return [exactObservance + themeMatch, stableKey]
  }

  const ranked = [...eligible].sort((left, right) => {
    const [leftScore, leftKey] = score(left)
    const [rightScore, rightKey] = score(right)
    if (leftScore !== rightScore) return rightScore - leftScore
    return rightKey.localeCompare(leftKey)
  })

  const highest = score(ranked[0])[0]
  const finalists = highest ? ranked.filter((quote) => score(quote)[0] === highest) : ranked
  const index = Number.parseInt(sha256Hex(isoDay).slice(0, 8), 16) % finalists.length
  const selected = finalists[index]

  return {
    quote_text: selected.quote_text,
    attribution: selected.attribution,
    source_title: selected.source_title,
    source_url: selected.source_url,
    source_date: selected.source_date,
    context_label: contextLabel,
    verification_status: selected.verification_status,
  }
}

export function kolkataDateParts(reference = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference)

  const year = Number(parts.find((part) => part.type === "year")?.value)
  const month = Number(parts.find((part) => part.type === "month")?.value)
  const day = Number(parts.find((part) => part.type === "day")?.value)
  return { year, month, day }
}

export function todayInKolkata(reference = new Date()): Date {
  const { year, month, day } = kolkataDateParts(reference)
  return new Date(year, month - 1, day)
}

export function todayReflectionFallback(reference = new Date()): ReflectionQuote {
  return (
    selectReflectionForDay(reflectionSeedQuotes, todayInKolkata(reference))
    ?? {
      quote_text: "Infinite happiness is ánanda (bliss).",
      attribution: "Shrii Shrii Anandamurti ji",
      source_title: "Ánanda Sútram",
      source_url: "https://www.sarkarverse.org/wiki/Ananda_Sutram",
      source_date: "1961 · Chapter 2, Sútra 3",
      context_label: "Daily spiritual reflection",
      verification_status: "source_verified",
    }
  )
}

export function reflectionBookCitation(reflection: Pick<ReflectionQuote, "source_title" | "source_date">) {
  const title = reflection.source_title.trim()
  const locator = reflection.source_date?.trim()
  return locator ? `${title} · ${locator}` : title
}
