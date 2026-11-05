import { artistKey, kirtansOfArtist, splitAuthors, type Artist } from "@/lib/kirtan/artists"
import { filterByKind } from "@/lib/kirtan/kind"
import { kirtanTypeLabel, type Kirtan, type RecordingKind } from "@/lib/kirtan/types"

/**
 * Search over Kiirtans, Bhajans and artists, and the result chips of the search screen. Pure, no React.
 * A recording matches when every word of the query is found in its title, author(s) or type name (case,
 * accents and extra spaces do not matter; a word of three letters or more matches inside a word, one or
 * two letters only the start of a word). Who uploaded it counts only when no recording matches otherwise. The
 * kind is a word too: "bhajan" keeps only Bhajans, "kiirtan" only Kiirtans, alone or with other words ("bhajan
 * morning"). Author matches come first, then title, then type.
 * TODO(api): the server searches the real catalog; this searches the list the app already holds.
 */

export const SEARCH_SCOPES = [
  { id: "all", label: "All" },
  { id: "songs", label: "Songs" },
  { id: "kiirtan", label: "Kiirtans & Bhajans" },
  { id: "stories", label: "Stories" },
] as const
export type SearchScope = (typeof SEARCH_SCOPES)[number]["id"]

export function parseSearchScope(value: string | string[] | undefined): SearchScope {
  const raw = Array.isArray(value) ? value[0] : value
  const hit = SEARCH_SCOPES.find((s) => s.id === raw || (raw === "kiirtans" && s.id === "kiirtan"))
  return hit?.id ?? "all"
}

/** Lower case, no accents or diacritics (Śiva, Ánanda, Dhyána), single spaces. */
export function foldText(text: string): string {
  return artistKey(text.normalize("NFD").replace(/[̀-ͯ]/g, ""))
}

const KIIRTAN_WORDS = new Set(["kiirtan", "kiirtans", "kirtan", "kirtans"])
const BHAJAN_WORDS = new Set(["bhajan", "bhajans"])

/** The words of a query that carry meaning: folded, without the kind words ("kiirtan", "bhajan"). */
export function queryWords(query: string): string[] {
  return foldText(query)
    .split(" ")
    .filter((w) => w && !KIIRTAN_WORDS.has(w) && !BHAJAN_WORDS.has(w))
}

/** The kind the query asks for: "bhajan" gives Bhajans, "kiirtan" Kiirtans, both words or none give null (both kinds). */
export function queryKind(query: string): RecordingKind | null {
  const tokens = foldText(query).split(" ")
  const kiirtan = tokens.some((w) => KIIRTAN_WORDS.has(w))
  const bhajan = tokens.some((w) => BHAJAN_WORDS.has(w))
  return kiirtan === bhajan ? null : bhajan ? "bhajan" : "kiirtan"
}

function hasWord(hay: string, word: string): boolean {
  if (word.length >= 3) return hay.includes(word)
  return hay.split(" ").some((token) => token.startsWith(word))
}

function hasAll(hay: string, words: readonly string[]): boolean {
  return words.every((w) => hasWord(hay, w))
}

/** Matching Kiirtans and Bhajans, best match first (author, title, type, uploader), then in the given order. */
export function searchKirtans<T extends Pick<Kirtan, "title" | "author" | "type" | "addedBy"> & { kind?: RecordingKind }>(source: readonly T[], query: string, limit = 50): T[] {
  if (!foldText(query)) return []
  const list = filterByKind(source, queryKind(query) ?? "all")
  const words = queryWords(query)
  if (!words.length) return list.slice(0, limit)
  const ranked: { item: T; tier: number; index: number }[] = []
  list.forEach((k, index) => {
    const author = foldText(splitAuthors(k.author).join(" ") || k.author)
    const title = foldText(k.title)
    const type = foldText(kirtanTypeLabel(k.type, k.kind))
    let tier = -1
    if (hasAll(author, words)) tier = 0
    else if (hasAll(title, words)) tier = 1
    else if (hasAll(type, words)) tier = 2
    else if (hasAll(`${author} ${title} ${type}`, words)) tier = 3
    else if (hasAll(`${author} ${title} ${type} ${foldText(k.addedBy)}`, words)) tier = 4
    if (tier >= 0) ranked.push({ item: k, tier, index })
  })
  // "added by Priya" is a weak signal: it only fills in when nothing matched by author, title or type.
  const strong = ranked.some((r) => r.tier < 4)
  return ranked
    .filter((r) => !strong || r.tier < 4)
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .slice(0, limit)
    .map((r) => r.item)
}

export type ArtistHit = Artist & { count: number }

/**
 * Artists whose name matches every word of the query and who have at least one Kiirtan in `list`.
 * Names that start with the query come first, then the artist with most Kiirtans. "kiirtan" alone
 * matches no artist (it would list everybody).
 */
export function searchArtists<T extends Pick<Kirtan, "author">>(artists: readonly Artist[], list: readonly T[], query: string, limit = 5): ArtistHit[] {
  const words = queryWords(query)
  if (!words.length) return []
  const lead = words.join(" ")
  return artists
    .filter((a) => hasAll(foldText(a.name), words))
    .map((a) => ({ ...a, count: kirtansOfArtist(a, list).length }))
    .filter((a) => a.count > 0)
    .sort((a, b) => Number(foldText(b.name).startsWith(lead)) - Number(foldText(a.name).startsWith(lead)) || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

/** What the screen shows for a scope: songs, Kiirtans, stories (a pointer, not a list). */
export function scopeShows(scope: SearchScope): { songs: boolean; kiirtans: boolean; stories: boolean } {
  return { songs: scope === "all" || scope === "songs", kiirtans: scope === "all" || scope === "kiirtan", stories: scope === "stories" }
}
