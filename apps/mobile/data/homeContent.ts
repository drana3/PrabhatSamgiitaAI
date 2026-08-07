import type { ReflectionQuote } from "@prabhat/core"
import { reflectionBookCitation as coreReflectionBookCitation, todayReflectionFallback } from "@prabhat/core"

/**
 * Fallback until GET /reflections/today loads.
 * Rotates daily from the curated seed quotes in data/seed/reflection_quotes.json.
 */
export function fallbackReflection(reference = new Date()): ReflectionQuote {
  return todayReflectionFallback(reference)
}

/** Exact book locator: title · year/chapter/sútra when present. */
export function reflectionBookCitation(reflection: ReflectionQuote) {
  return coreReflectionBookCitation(reflection)
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
