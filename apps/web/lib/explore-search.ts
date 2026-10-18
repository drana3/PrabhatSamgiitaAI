import type { ExploreSearchKind } from "@/lib/special-collections"
import { exploreSearchKind } from "@/lib/special-collections"
import { isCompleteSargamQuery } from "@/lib/complete-sargam"

export function explorePrefetchEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.E2E_DISABLE_SEARCH_PREFETCH !== "true"
}

export function shouldPrefetchExploreSearch(
  query: string,
  kind: ExploreSearchKind,
  env: NodeJS.ProcessEnv = process.env,
) {
  const trimmed = query.trim()
  if (isCompleteSargamQuery(trimmed)) return false
  return explorePrefetchEnabled(env) && Boolean(trimmed) && kind === "catalog"
}

export function resolveExploreSearchKind(query: string, explicitKind?: string | null) {
  return exploreSearchKind(query, explicitKind)
}
