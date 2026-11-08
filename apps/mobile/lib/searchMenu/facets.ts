import type { MenuRecording } from "@/lib/searchMenu/types"

/**
 * Category discovery: reads the recordings the library holds and lists every value a recording carries, per facet
 * (Kiirtan style, mood, dance, and any extra tag such as tempo, solo or group, occasion, event name). It decides nothing
 * about what is shown: the thresholds and caps are the rules' business (rules.ts, docs/search-menu.md section 10). Nothing
 * is hard-coded here except how to read a field. A value nobody uploaded is not in the result; a value somebody uploaded
 * is, so a new value (a style typed as "other", a new tag) reaches a shelf by itself once enough recordings carry it.
 * Pure: no React, no stores, no network.
 */

/** Words of a value as they are compared: case, spacing and punctuation never make another value. */
export function wordsOf(raw: string): string {
  return raw
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

/** The key of a value in ids and counts ("Baul  Kiirtan!" -> "baul-kiirtan"). Empty when nothing readable is left. */
export function slugOf(raw: string | null | undefined): string {
  return wordsOf(raw ?? "").replace(/ /g, "-")
}

/** The automatic title of a value nobody named: "baul-kiirtan" -> "Baul Kiirtan". The same words give the same title everywhere. */
export function titleCase(raw: string): string {
  return wordsOf(raw.replace(/-/g, " "))
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/** Style id of a custom style: `other:<slug>`. The plain `other` is a Kiirtan style someone picked without naming it. */
export const CUSTOM_STYLE_PREFIX = "other:"

export type FacetCounts = Record<string, number>

export type DiscoveredFacets = {
  /** Kiirtan style id -> recordings. Listed ids as they are; "other:<slug>" for a typed name; "other" for unnamed. */
  styles: FacetCounts
  /** mood id -> recordings that carry it (each recording counts once per mood) */
  moods: FacetCounts
  /** facet id -> value -> recordings. `dance` (Dance music) and every key of a recording's `tags` except `mood`. */
  facets: Record<string, FacetCounts>
}

function bump(map: FacetCounts, key: string) {
  map[key] = (map[key] ?? 0) + 1
}

/** The distinct, readable values of a field (a recording counts once per value). */
function uniqueSlugs(values: readonly string[] | null | undefined): string[] {
  return [...new Set((values ?? []).map((v) => slugOf(v)).filter(Boolean))]
}

/** Scan the library. `kindOf` maps a stored kind to the kind the menu knows (the removed fourth kind reads as a Bhajan). */
export function discoverFacets(recordings: readonly MenuRecording[], kindOf: (kind: string) => string = (k) => k): DiscoveredFacets {
  const out: DiscoveredFacets = { styles: {}, moods: {}, facets: {} }
  for (const r of recordings) {
    const kind = kindOf(r.kind)
    if (kind === "kiirtan" && r.style) {
      if (r.style === "other") {
        const slug = slugOf(r.styleOther)
        bump(out.styles, slug ? `${CUSTOM_STYLE_PREFIX}${slug}` : "other")
      } else bump(out.styles, r.style)
    }
    for (const mood of uniqueSlugs(r.moods)) bump(out.moods, mood)
    if (kind === "dance_song" && r.dance) {
      const dance = slugOf(r.dance)
      if (dance) bump((out.facets.dance ??= {}), dance)
    }
    for (const [facet, values] of Object.entries(r.tags ?? {})) {
      const f = slugOf(facet)
      if (!f) continue
      if (f === "mood") {
        for (const mood of uniqueSlugs(values)) bump(out.moods, mood)
        continue
      }
      for (const v of uniqueSlugs(values)) bump((out.facets[f] ??= {}), v)
    }
  }
  return out
}
