import {
  feelingBrowseId,
  isCatalogNumberQuery,
  isNaturalLanguageSearch,
  planSearch,
  searchNetworkMode,
  type SearchAuth,
} from "@prabhat/core"

const LYRIC_DEBOUNCE_MS = 40
const SEMANTIC_DEBOUNCE_MS = 400

const DEFAULT_AUTH: SearchAuth = { signedIn: false, feelingSearchEnabled: false }

export { feelingBrowseId, isNaturalLanguageSearch }

export function searchDebounceMs(query: string, auth: SearchAuth = DEFAULT_AUTH) {
  if (isCatalogNumberQuery(query)) return 0
  return planSearch(query, auth).layer === "semantic" ? SEMANTIC_DEBOUNCE_MS : LYRIC_DEBOUNCE_MS
}

/** Same planner as the website — embeddings only when Feeling search is on. */
export function resolveSearchMode(query: string, auth: SearchAuth = DEFAULT_AUTH): "catalog" | "semantic" {
  return searchNetworkMode(query, auth)
}

/** Explore result list: words need 2+ chars; song numbers (including 1–9) still show. */
export function exploreShowsResultList(query: string, hasCategory = false) {
  return hasCategory || query.trim().length >= 2 || isCatalogNumberQuery(query)
}

/** Quiet search header — count only, no “searching catalog / semantic” copy. */
export function searchResultsTitle(categoryLabel: string | null, resultCount: number) {
  if (categoryLabel) {
    return resultCount > 0 ? `${categoryLabel} · ${resultCount}` : categoryLabel
  }
  return resultCount > 0 ? `Songs · ${resultCount}` : "Songs"
}
