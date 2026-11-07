import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"

/**
 * Old (v1) URLs and where they go now. The v1 app is gone: every old link, shared card, push
 * notification and bookmark must land in the redesigned screens. Pure logic (no React), so it runs both
 * in the OS deep-link rewrite (lib/nativeIntent.ts) and in the not-found screen (app/+not-found.tsx),
 * which covers the web and any in-app link that still names an old route.
 *
 * Returns null when the path is not an old route (the caller keeps it as it is).
 */

function splitPath(raw: string): { segments: string[]; query: URLSearchParams } {
  const [pathPart, ...rest] = raw.trim().split("?")
  const search = rest.join("?").split("#")[0] ?? ""
  const path = (pathPart ?? "").split("#")[0] ?? ""
  const segments = path
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment && !/^\(.*\)$/.test(segment))
  return { segments, query: new URLSearchParams(search) }
}

/** Parameters the router adds by itself while it works out a redirect; they never belong in the address the user lands on. */
const ROUTER_PARAMS = ["not-found"] as const

function withQuery(path: string, query: URLSearchParams, drop: readonly string[] = []): string {
  const copy = new URLSearchParams()
  query.forEach((value, key) => {
    if (!drop.includes(key) && !(ROUTER_PARAMS as readonly string[]).includes(key)) copy.append(key, value)
  })
  const text = copy.toString()
  return text ? `${path}?${text}` : path
}

function songId(value: string): string {
  return /^\d+$/.test(value) ? `ps-${value}` : value
}

export function legacyRouteTarget(raw: string): string | null {
  const { segments, query } = splitPath(raw)
  const [first, second] = segments
  // "/SONGS" and "/Songs/12" are the same old page: the first segment is matched without regard to case
  // (the id after it is left exactly as written)
  const head = first?.toLowerCase()
  const hadGroup = /\(tabs\)/i.test(raw)

  // The old tab group: "/(tabs)", "/(tabs)/index" and the four other tabs.
  if (hadGroup && (!head || head === "index")) return NAV_V2_HOME_ROUTE
  switch (head) {
    case "songs":
      if (second && segments.length === 2) return withQuery(`/song-v2/${songId(second)}`, query)
      return segments.length === 1 ? "/v2/songs" : null
    case "ai":
      return segments.length === 1 ? withQuery("/assistant", query) : null
    case "saved":
      return segments.length === 1 ? "/library-v2" : null
    case "profile":
      return segments.length === 1 ? NAV_V2_HOME_ROUTE : null
    case "song":
      return second && segments.length === 2 ? withQuery(`/song-v2/${songId(second)}`, query, ["from"]) : null
    case "search": {
      if (segments.length !== 1) return null
      const category = query.get("category")
      if (category) return `/songs-v2-collection?id=${encodeURIComponent(category)}&title=${encodeURIComponent(category)}`
      return withQuery("/search-v2", query)
    }
    case "collections":
      return segments.length === 1 ? "/collections-v2" : null
    case "playlist":
      if (second === "add") {
        const song = query.get("song")
        return song && /^\d+$/.test(song) ? `/song-v2/ps-${song}` : "/library-v2"
      }
      return second && segments.length === 2 ? `/playlist-v2/${second}` : null
    case "player":
      return segments.length === 1 ? "/player-v2" : null
    // "/drive" is not here on purpose: the Radio screen still lives at /drive (app/drive), so the address stays as it is
    default:
      return null
  }
}
