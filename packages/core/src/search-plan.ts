import { isCatalogNumberQuery } from "./lyric-search"

/** Persist on web (localStorage) and iOS (preferences store). */
export const FEELING_SEARCH_STORAGE_KEY = "prabhat-feeling-search"

/** Same prompt on Home and Explore, web and iOS. */
export const SEARCH_PLACEHOLDER = "Song number, lyrics, or a feeling..."

/** Toggle / account copy — Feeling search stays off until the member turns it on. */
export const FEELING_SEARCH_HINT_SIGNED_IN =
  "Off by default. Enable it in Profile to search by mood or meaning. Lyric suggestions stay off while it is on."

export const FEELING_SEARCH_HINT_GUEST =
  "Off by default. Sign in, then enable Feeling search in Profile when a normal search finds nothing."

export const FEELING_SEARCH_EMPTY_TITLE = "No songs matched — try Feeling search"

export const FEELING_SEARCH_EMPTY_BODY_SIGNED_IN =
  "Normal search looks up numbers and lyrics. Feeling search finds songs by mood or meaning across all 5,018 songs. Enable it in Profile, then search again."

export const FEELING_SEARCH_EMPTY_BODY_GUEST =
  "Normal search looks up numbers and lyrics. Sign in, then enable Feeling search in Profile to find songs by mood or meaning across all 5,018 songs."

export const FEELING_SEARCH_EMPTY_NO_MATCH =
  "Feeling search found no matches. Try a clearer feeling (peace, devotion, joy), or turn it off and search by song number or opening words."

/** Home hero example chips — same on web and iOS. */
export const HOME_SEARCH_EXAMPLES = [
  {
    label: "By number",
    query: "111",
    description: "Open a song directly",
    mode: "catalog" as const,
  },
  {
    label: "By words",
    query: "bandhu he niye calo",
    description: "Search remembered lyrics",
    mode: "catalog" as const,
  },
  {
    label: "By feeling",
    query: "peaceful devotion",
    description: "Find songs by mood with Feeling search",
    mode: "feeling" as const,
  },
] as const

export const FEELING_ENABLE_IN_PROFILE_TITLE = "Enable Feeling search in Profile"

export const FEELING_ENABLE_IN_PROFILE_BODY =
  "Feeling search stays off by default. Open Profile to turn it on, then search by mood or meaning."

export type FeelingMoodId = "peace" | "meditation" | "guru" | "devotional"

export type SearchAuth = {
  signedIn: boolean
  feelingSearchEnabled: boolean
}

export type SearchLayer = "empty" | "number" | "collection" | "catalog" | "mood" | "semantic"

export type SearchPlan = {
  layer: SearchLayer
  moodId?: FeelingMoodId
  networkMode: "catalog" | "semantic" | null
}

const DEFAULT_AUTH: SearchAuth = { signedIn: false, feelingSearchEnabled: false }

export function feelingSearchAllowed(auth: SearchAuth = DEFAULT_AUTH) {
  return auth.signedIn && auth.feelingSearchEnabled
}

/** A sentence about feelings or a question — not a catalog chip or lyric line. */
export function isNaturalLanguageSearch(query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false
  if (/\?/.test(trimmed)) return true
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length < 3) return false
  return /\b(?:i(?:'m| am)|we are|feel(?:ing)?|help me|recommend|suggest|what|why|how|should i|can you|please|of mind|stress(?:ful|ed)?|anxious|anxiety|tense|worried|overwhelm(?:ed)?)\b/i.test(
    trimmed,
  )
}

export function feelingBrowseId(query: string): FeelingMoodId | null {
  if (!isNaturalLanguageSearch(query)) return null
  const trimmed = query.toLowerCase()
  if (/\b(?:guru|baba|sadguru)\b/.test(trimmed)) return "guru"
  if (/\b(?:meditat|quiet mind)\b/.test(trimmed)) return "meditation"
  if (/\b(?:devotion|bhakti|prayer|worship)\b/.test(trimmed)) return "devotional"
  return "peace"
}

/**
 * One search stack for web and iOS.
 * Numbers / collections stay local. When Feeling search is on, free text skips
 * suggestion lists and hits embeddings. Otherwise lyrics stay local and feeling
 * sentences use a local mood list.
 */
export function planSearch(query: string, auth: SearchAuth = DEFAULT_AUTH): SearchPlan {
  const trimmed = query.trim()
  if (!trimmed) return { layer: "empty", networkMode: null }
  if (isCatalogNumberQuery(trimmed)) return { layer: "number", networkMode: null }
  if (/^search prabhat samgiita for\s+/i.test(trimmed)) {
    return { layer: "collection", networkMode: null }
  }
  if (feelingSearchAllowed(auth)) {
    return { layer: "semantic", networkMode: "semantic" }
  }
  if (isNaturalLanguageSearch(trimmed)) {
    return {
      layer: "mood",
      moodId: feelingBrowseId(trimmed) ?? "peace",
      networkMode: null,
    }
  }
  return { layer: "catalog", networkMode: null }
}

export function searchNetworkMode(
  query: string,
  auth: SearchAuth = DEFAULT_AUTH,
): "catalog" | "semantic" {
  return planSearch(query, auth).networkMode === "semantic" ? "semantic" : "catalog"
}
