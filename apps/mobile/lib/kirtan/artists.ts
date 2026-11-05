import type { Kirtan } from "@/lib/kirtan/types"

/**
 * Artists: the groups and singers behind the Kiirtans. A Kiirtan belongs to an artist when its
 * `author` is the artist's name (ignoring case and extra spaces). No money features anywhere: an
 * artist is a name, a short text and a list. Pure, no React, no stores.
 * TODO(api): artists come from the backend; today they are the preview fixtures.
 */
export type Artist = {
  id: string
  name: string
  kind: "singer" | "group"
  about: string
  /** photo; null shows the gradient with initials */
  photoUrl: string | null
}

/** Case and spacing do not make a different artist. */
export function artistKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

export function artistById(artists: readonly Artist[], id: string | null | undefined): Artist | null {
  return artists.find((a) => a.id === id) ?? null
}

/**
 * The names inside an `author` field: "Priya Devi & Arun Deva" gives both. Splits on commas, "&", "+",
 * semicolons, " and ", " with ", " feat. " and " ft. ". One name stays one name.
 */
export function splitAuthors(author: string | null | undefined): string[] {
  return (author ?? "")
    .split(/\s*(?:,|;|&|\+|\band\b|\bwith\b|\bfeat\.?|\bft\.?)\s*/i)
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter(Boolean)
}

/** The artist whose name is the Kiirtan's author, if any (the first matching name of a joint author). */
export function artistForAuthor(artists: readonly Artist[], author: string | null | undefined): Artist | null {
  const whole = artistKey(author ?? "")
  if (!whole) return null
  const exact = artists.find((a) => artistKey(a.name) === whole)
  if (exact) return exact
  for (const name of splitAuthors(author)) {
    const hit = artists.find((a) => artistKey(a.name) === artistKey(name))
    if (hit) return hit
  }
  return null
}

/** All Kiirtans of an artist, in the given order. A joint author ("A & B") counts for both. */
export function kirtansOfArtist<T extends Pick<Kirtan, "author">>(artist: Pick<Artist, "name">, list: readonly T[]): T[] {
  const key = artistKey(artist.name)
  return list.filter((k) => artistKey(k.author) === key || splitAuthors(k.author).some((name) => artistKey(name) === key))
}

/** "Popular": most played first, newest first on a tie, at most `limit`. */
export function popularOf<T extends Pick<Kirtan, "plays" | "addedAt">>(list: readonly T[], limit = 5): T[] {
  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (b.item.plays ?? 0) - (a.item.plays ?? 0) || b.item.addedAt - a.item.addedAt || a.index - b.index)
    .slice(0, limit)
    .map((x) => x.item)
}

/** Artists that have at least one Kiirtan in `list`, most Kiirtans first, then by name. */
export function artistsWithKirtans<T extends Pick<Kirtan, "author">>(artists: readonly Artist[], list: readonly T[]): (Artist & { count: number })[] {
  return artists
    .map((a) => ({ ...a, count: kirtansOfArtist(a, list).length }))
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** `1 kiirtan`, `5 kiirtans`. */
export function artistCountLabel(count: number): string {
  return `${count} ${count === 1 ? "kiirtan" : "kiirtans"}`
}

/** Up to two capital letters for the gradient avatar: "Priya Devi" gives PD, "Festival Voices" gives FV. */
export function artistInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return "·"
  const letters = words.length === 1 ? [words[0][0]] : [words[0][0], words[1][0]]
  return letters.join("").toUpperCase()
}

/** A steady gradient index (0 to 3) for an artist id. */
export function artistToneIndex(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % 4
}

/** `Kiirtan · Priya Devi`: the player's subtitle when the artist is known, `Kiirtan · added by X` otherwise. */
export function kiirtanSubtitle(author: string | null | undefined, addedBy: string | null | undefined, artists: readonly Artist[]): string {
  const artist = artistForAuthor(artists, author)
  if (artist) return `Kiirtan · ${artist.name}`
  const who = (addedBy ?? "").trim()
  return who ? `Kiirtan · added by ${who}` : "Kiirtan"
}

/** The name after "Playing from" for an artist's queue. */
export function artistSourceName(name: string): string {
  return name.trim() || "Artist"
}
