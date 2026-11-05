import type { Kirtan } from "@/lib/kirtan/types"

/**
 * Mixes: ordered lists that combine Prabhat Samgiita songs and Kiirtans. A mix plays as ONE queue
 * in the one player (lib/kirtan/mixPlayback.ts), so there is no hand-over between players. Pure, no React.
 */

export type MixItem = { kind: "ps"; number: number } | { kind: "kirtan"; id: string }

export type Mix = {
  id: string
  title: string
  /** one line under the title in the list */
  blurb: string
  /** label strip colour of the card (Home's StripTone) */
  tone: "orange" | "sage" | "gold" | "forest"
  /** cover picture id of Home (lib/homeShelves HomeCoverId) */
  cover: "lake" | "garland" | "portrait" | "lotus" | "seated" | "guitar"
  items: readonly MixItem[]
}

export function itemKey(item: MixItem): string {
  return item.kind === "ps" ? `ps-${item.number}` : `k-${item.id}`
}

/** `3 songs + 2 kiirtans`, `4 kiirtans`, `1 song`. */
export function mixCaption(items: readonly MixItem[]): string {
  const songs = items.filter((i) => i.kind === "ps").length
  const kirtans = items.length - songs
  const parts: string[] = []
  if (songs) parts.push(`${songs} ${songs === 1 ? "song" : "songs"}`)
  if (kirtans) parts.push(`${kirtans} ${kirtans === 1 ? "kiirtan" : "kiirtans"}`)
  return parts.length ? parts.join(" + ") : "Empty"
}

/**
 * Drops Kiirtans that are not published or no longer exist, keeping the order of everything else.
 * (A mix must never play a Kiirtan that review turned down.)
 */
export function playableItems(items: readonly MixItem[], kirtans: ReadonlyMap<string, Pick<Kirtan, "status">>): MixItem[] {
  return items.filter((item) => item.kind === "ps" || kirtans.get(item.id)?.status === "published")
}

/** The Mixes shelf of Today and the mix page. */
export function mixesWithCaption(mixes: readonly Mix[]): (Mix & { caption: string })[] {
  return mixes.map((m) => ({ ...m, caption: mixCaption(m.items) }))
}
