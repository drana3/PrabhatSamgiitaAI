import { kindMeta } from "@/lib/notifications/kinds"

/**
 * Where a tap on a notification goes, and what happens when that place is gone.
 *
 * A notification can outlive what it points at: a song taken out of the library, a festival that is no
 * longer in the calendar, a link from a newer app version, an item that was edited. `resolveTarget`
 * checks the target before the app navigates and, when it is gone, returns the kind's fallback screen
 * (lib/notifications/kinds.ts) and the reason, so the person lands somewhere real and is told why.
 * It never throws and never returns an empty route.
 */

export type TargetContext = {
  /** the song numbers the phone knows (its saved catalogue); null/empty when it has none yet: then no song is called missing */
  songNumbers?: ReadonlySet<number> | null
  /** the festival ids of the calendar */
  festivalIds?: ReadonlySet<string> | null
}

export type GoneReason = "song" | "festival" | "route" | "kind"

export type ResolvedTarget =
  | { missing: false; route: string }
  | { missing: true; route: string; reason: GoneReason; /** the route that was asked for */ asked: string }

/** An extra check for one family of routes: return false when the thing the route names no longer exists. */
type TargetCheck = (route: string, context: TargetContext) => boolean
const checks: { prefix: string; reason: GoneReason; check: TargetCheck }[] = []

/**
 * Add a check for a family of routes (`/chords-review`): `check` gets the route and returns false when it is
 * gone. Registered once, at module load, by the feature that owns the route. A throwing check counts as "exists".
 */
export function registerTargetCheck(prefix: string, check: TargetCheck, reason: GoneReason = "route"): void {
  if (!checks.some((c) => c.prefix === prefix)) checks.push({ prefix, reason, check })
}

function safeRoute(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const route = raw.trim()
  // an app route only: starts with one slash, no scheme, no protocol-relative address
  if (!route.startsWith("/") || route.startsWith("//") || /^\/[^?#]*:\/\//.test(route)) return null
  return route
}

export function resolveTarget(item: { kind: string; target: unknown }, context: TargetContext = {}): ResolvedTarget {
  const fallback = kindMeta(item.kind).fallback
  const route = safeRoute(item.target)
  if (!route) return { missing: true, route: fallback, reason: "kind", asked: String(item.target ?? "") }

  const song = /^\/song-v2\/(?:ps-)?(\d+)(?:[/?#]|$)/.exec(route)
  if (song) {
    const number = Number(song[1])
    const known = context.songNumbers
    if (number < 1 || (known && known.size > 0 && !known.has(number))) {
      return { missing: true, route: "/v2/songs", reason: "song", asked: route }
    }
    return { missing: false, route }
  }

  const festival = /^\/festival\/([^/?#]+)/.exec(route)
  if (festival) {
    const id = decodeURIComponent(festival[1] ?? "")
    const known = context.festivalIds
    if (known && known.size > 0 && !known.has(id)) return { missing: true, route: "/festivals", reason: "festival", asked: route }
    return { missing: false, route }
  }

  for (const c of checks) {
    if (!route.startsWith(c.prefix)) continue
    let exists = true
    try {
      exists = c.check(route, context)
    } catch {
      exists = true
    }
    if (!exists) return { missing: true, route: fallback, reason: c.reason, asked: route }
  }
  return { missing: false, route }
}
