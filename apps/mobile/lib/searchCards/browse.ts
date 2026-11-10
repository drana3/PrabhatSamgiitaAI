/**
 * The pages behind the Search cards (app/search-browse.tsx): the choices of Mood, Kiirtan type and Festivals, built from the
 * data the app really holds and nothing else. A section with nothing to list comes back as empty lists; the page then says so
 * and links on (it is never a blank page). Pure: no React, no stores.
 */

/** One photo tile: where it opens, how many songs or recordings stand behind it. */
export type BrowseTile = {
  key: string
  label: string
  count: number
  /** what the number counts */
  unit: "songs" | "recordings"
  href: string
  /** shortlist number of the photo (lib/photos), or null to let the photo system pick one from the key */
  photo: number | null
}

/** The six lists of the Songs shelf (lib/songsV2/collections.ts SPECIAL_TILES, by browse id): a landscape each, no people. */
export const PS_MOOD_PHOTO: Readonly<Record<string, number>> = { devotional: 2, meditation: 26, morning: 14, evening: 15, nature: 27, children: 12 }

/** The moods a Kiirtan can carry (lib/kirtan/moods.ts). A mood nobody listed gets a photo picked by the photo system. */
export const KIIRTAN_MOOD_PHOTO: Readonly<Record<string, number>> = {
  joyful: 16,
  meditative: 11,
  longing: 18,
  energetic: 24,
  mix: 20,
  calm: 25,
  ecstatic: 15,
  devotion: 10,
  sad: 19,
}

/** Instruments and lamps for the four types of a Kiirtan (bnk, lila, festival, other). */
export const TYPE_PHOTO: Readonly<Record<string, number>> = { bnk: 31, lila: 28, festival: 2, other: 30 }

export type MoodGroups = { songs: BrowseTile[]; kiirtan: BrowseTile[] }

export type MoodInput = {
  /** the Prabhat Samgiita mood lists (collection entries of kind "mood") with where each opens */
  psMoods: readonly { id: string; label: string; count: number; href: string }[]
  /** the moods listeners confirmed on Kiirtans */
  kiirtanMoods: readonly { id: string; label: string; count: number; href: string }[]
}

/** Songs first (the six lists), then Kiirtans by confirmed mood, biggest first. A list with no songs is not a tile. */
export function moodGroups(input: MoodInput): MoodGroups {
  const songs = input.psMoods
    .filter((m) => m.count > 0)
    .map<BrowseTile>((m) => ({ key: `ps:${m.id}`, label: m.label, count: m.count, unit: "songs", href: m.href, photo: PS_MOOD_PHOTO[m.id] ?? null }))
  const kiirtan = input.kiirtanMoods
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map<BrowseTile>((m) => ({ key: `kiirtan:${m.id}`, label: m.label, count: m.count, unit: "recordings", href: m.href, photo: KIIRTAN_MOOD_PHOTO[m.id] ?? null }))
  return { songs, kiirtan }
}

/** Every mood a card can name as an example, Prabhat Samgiita first. */
export function moodNames(groups: MoodGroups): string[] {
  return [...groups.songs, ...groups.kiirtan].map((tile) => tile.label)
}

/** The Kiirtan types that have recordings, biggest first; each opens the list of its recordings (the shelf page). */
export function typeTiles(counts: Readonly<Record<string, number>> | undefined, labelOf: (id: string) => string): BrowseTile[] {
  return Object.entries(counts ?? {})
    .filter(([, count]) => count > 0)
    .map<BrowseTile>(([id, count]) => ({
      key: `type:${id}`,
      label: labelOf(id),
      count,
      unit: "recordings",
      href: `/browse-shelf?id=${encodeURIComponent(`kiirtan:type:${id}`)}`,
      photo: TYPE_PHOTO[id] ?? null,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export type FestivalRow = {
  key: string
  title: string
  /** the second line: a date and "in 5 days", or how many songs */
  line: string
  href: string
}

export type FestivalSections = {
  /** observances with a confirmed date, soonest first */
  coming: FestivalRow[]
  /** festival song lists (collections of the festival kind), biggest first */
  songs: FestivalRow[]
  /** event sets (retreats and festivals with several recordings): the shelf page, or null when there are none */
  sets: { count: number; href: string } | null
}

export type FestivalInput = {
  coming: readonly { id: string; title: string; line: string }[]
  collections: readonly { id: string; label: string; count: number; href: string; countLabel: string }[]
  setCount: number
}

export function festivalSections(input: FestivalInput): FestivalSections {
  return {
    coming: input.coming.map((f) => ({ key: `coming:${f.id}`, title: f.title, line: f.line, href: `/festival/${f.id}` })),
    songs: input.collections
      .filter((c) => c.count > 0)
      .map((c) => ({ key: `songs:${c.id}`, title: c.label, line: c.countLabel, href: c.href })),
    sets: input.setCount > 0 ? { count: input.setCount, href: `/browse-shelf?id=${encodeURIComponent("kiirtan:sets")}` } : null,
  }
}

/** Names a card can show as examples: the coming observances first, then the song lists. */
export function festivalNames(sections: FestivalSections): string[] {
  return [...sections.coming.map((r) => r.title), ...sections.songs.map((r) => r.title)]
}

export function festivalsEmpty(sections: FestivalSections): boolean {
  return !sections.coming.length && !sections.songs.length && !sections.sets
}
