import type { PhotoMood } from "@/lib/photos/catalog"
import { inSection, PS_SECTION_ORDER, type PsCollection, type PsSectionId } from "@/lib/psCollections/parse"

/**
 * The Collections page as sections (Dada, 11 Nov 2026): the new Prabhat Samgiita collections by feeling, time of day,
 * season, theme, language, tala and raga; then "From the site" (the collections the site already had, nothing removed,
 * also those with the same name as a new one: Morning, Evening, Nature); then "Songs of the heart" (the songs with no
 * more specific theme, with its honest count) as the last section. A section with nothing to show is not in the list.
 */
export type SectionId = Exclude<PsSectionId, "heart"> | "site" | "heart"

/** What the page needs of an old (site) collection; lib/songsV2/collectionsIndex CollectionEntry fits. */
export type SiteEntry = { id: string; label: string; kind: string; count: number; countLabel: string }

export type CollectionTileData = {
  /** unique inside the page */
  key: string
  label: string
  count: number
  countLabel: string
  href: string
  /** the photo system's seed: the same tile always gets the same picture */
  photoSeed: string
  photoMood?: PhotoMood
  /** the old kind of a site collection ("festival", "theme"...), for the "From the site" filter */
  siteKind?: string
}

export type CollectionSection = { id: SectionId; title: string; tiles: CollectionTileData[] }

export function psHref(key: string, title: string): string {
  return `/songs-v2-collection?id=${encodeURIComponent(key)}&title=${encodeURIComponent(title)}`
}

export function moodOf(label: string): PhotoMood | undefined {
  const t = label.toLowerCase()
  if (/\b(night|moon)\b/.test(t)) return "night"
  if (/\b(morning|dawn|sunrise)\b/.test(t)) return "morning"
  if (/\bevening\b/.test(t)) return "evening"
  if (/\b(festival|dipavali|diipavalii)\b/.test(t)) return "festival"
  return undefined
}

export function psTile(c: PsCollection, countLabel: (n: number) => string): CollectionTileData {
  return {
    key: c.key,
    label: c.title,
    count: c.songs.length,
    countLabel: countLabel(c.songs.length),
    href: psHref(c.key, c.title),
    photoSeed: c.key,
    photoMood: moodOf(c.title),
  }
}

export function buildSections(args: {
  ps: readonly PsCollection[]
  site: readonly SiteEntry[]
  siteHref: (entry: SiteEntry) => string
  titleOf: (id: SectionId) => string
  countLabel: (n: number) => string
}): CollectionSection[] {
  const { ps, site, siteHref, titleOf, countLabel } = args
  const sections: CollectionSection[] = []
  const add = (id: SectionId, tiles: CollectionTileData[]) => {
    if (tiles.length > 0) sections.push({ id, title: titleOf(id), tiles })
  }
  for (const id of PS_SECTION_ORDER) {
    if (id === "heart") continue
    add(id, inSection(ps, id).map((c) => psTile(c, countLabel)))
  }
  add(
    "site",
    site.map((e) => ({
      key: `site:${e.kind}:${e.id}`,
      label: e.label,
      count: e.count,
      countLabel: e.countLabel,
      href: siteHref(e),
      photoSeed: `site:${e.id}`,
      photoMood: moodOf(e.label),
      siteKind: e.kind,
    })),
  )
  add("heart", inSection(ps, "heart").map((c) => psTile(c, countLabel)))
  return sections
}

/** Tiles whose name has every word of the query; sections left empty drop out. */
export function filterSections(
  sections: readonly CollectionSection[],
  query: string,
  normalize: (text: string) => string,
  only: SectionId | "all" = "all",
  siteKind: string = "all",
): CollectionSection[] {
  const words = normalize(query).split(" ").filter(Boolean)
  const out: CollectionSection[] = []
  for (const s of sections) {
    if (only !== "all" && s.id !== only) continue
    const tiles = s.tiles.filter((tile) => {
      if (s.id === "site" && siteKind !== "all" && tile.siteKind !== siteKind) return false
      if (!words.length) return true
      const name = normalize(tile.label)
      return words.every((w) => name.includes(w))
    })
    if (tiles.length) out.push({ ...s, tiles })
  }
  return out
}
