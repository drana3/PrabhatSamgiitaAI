import { artistKey } from "@/lib/kirtan/artists"
import { KIRTAN_TYPES, type Kirtan } from "@/lib/kirtan/types"

/**
 * Search over Kiirtans, and the result chips of the search screen. Pure, no React.
 * A Kiirtan matches when every word of the query is found in its title, performer, type name or who
 * added it (case, accents and extra spaces do not matter). The word "kiirtan" alone matches all.
 * TODO(api): the server searches the real catalog; this searches the list the app already holds.
 */

export const SEARCH_SCOPES = [
  { id: "all", label: "All" },
  { id: "songs", label: "Songs" },
  { id: "kiirtan", label: "Kiirtans" },
  { id: "stories", label: "Stories" },
] as const
export type SearchScope = (typeof SEARCH_SCOPES)[number]["id"]

export function parseSearchScope(value: string | string[] | undefined): SearchScope {
  const raw = Array.isArray(value) ? value[0] : value
  const hit = SEARCH_SCOPES.find((s) => s.id === raw || (raw === "kiirtans" && s.id === "kiirtan"))
  return hit?.id ?? "all"
}

function fold(text: string): string {
  return artistKey(text).normalize("NFD").replace(/[̀-ͯ]/g, "")
}

/** Matching Kiirtans in the given order. An empty query matches nothing. */
export function searchKirtans<T extends Pick<Kirtan, "title" | "author" | "type" | "addedBy">>(list: readonly T[], query: string, limit = 50): T[] {
  const words = fold(query).split(" ").filter(Boolean).filter((w) => w !== "kiirtan" && w !== "kiirtans" && w !== "kirtan")
  if (!fold(query)) return []
  const typeName = (id: string) => KIRTAN_TYPES.find((t) => t.id === id)?.label ?? id
  return list
    .filter((k) => {
      if (!words.length) return true
      const hay = fold(`${k.title} ${k.author} ${typeName(k.type)} ${k.addedBy}`)
      return words.every((w) => hay.includes(w))
    })
    .slice(0, limit)
}

/** What the screen shows for a scope: songs, Kiirtans, stories (a pointer, not a list). */
export function scopeShows(scope: SearchScope): { songs: boolean; kiirtans: boolean; stories: boolean } {
  return { songs: scope === "all" || scope === "songs", kiirtans: scope === "all" || scope === "kiirtan", stories: scope === "stories" }
}
