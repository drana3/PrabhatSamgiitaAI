import type { ReflectionQuote } from "@prabhat/core"

/**
 * Fallback only until GET /reflections/today loads.
 * Must stay a book citation from Shrii Shrii Anandamurti ji (not a web article).
 */
export const fallbackReflection: ReflectionQuote = {
  quote_text: "Infinite happiness is ánanda (bliss).",
  attribution: "Shrii Shrii Anandamurti ji",
  source_title: "Ánanda Sútram",
  source_url: "https://www.sarkarverse.org/wiki/Ananda_Sutram",
  source_date: "1961 · Chapter 2, Sútra 3",
  context_label: "Daily spiritual reflection",
  verification_status: "source_verified",
}

/** Exact book locator: title · year/chapter/sútra when present. */
export function reflectionBookCitation(reflection: ReflectionQuote) {
  const title = reflection.source_title.trim()
  const locator = reflection.source_date?.trim()
  return locator ? `${title} · ${locator}` : title
}

export function reflectionSourceLabel(reflection: ReflectionQuote) {
  return `Source: ${reflectionBookCitation(reflection)}`
}

export const communityVoices = [
  {
    id: "1",
    quote: "The morning song recommendations feel like a gentle companion for meditation.",
    name: "Ananda",
  },
  {
    id: "2",
    quote: "Finding festival collections made our collective programme preparation simple.",
    name: "Devaki",
  },
  {
    id: "3",
    quote: "AI explanations helped me understand lyrics I have sung for years.",
    name: "Ravi",
  },
]
