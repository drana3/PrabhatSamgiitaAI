import type { Kirtan } from "@/lib/kirtan/types"

/**
 * Mixes: ordered lists that combine Prabhat Samgiita songs and kirtans. Songs play in the song
 * player, kirtans in the YouTube player, so a mix hands over between the two. The hand-over is not
 * gapless: the other player has to open. Pure, no React.
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

/** `3 songs + 2 kirtans`, `4 kirtans`, `1 song`. */
export function mixCaption(items: readonly MixItem[]): string {
  const songs = items.filter((i) => i.kind === "ps").length
  const kirtans = items.length - songs
  const parts: string[] = []
  if (songs) parts.push(`${songs} ${songs === 1 ? "song" : "songs"}`)
  if (kirtans) parts.push(`${kirtans} ${kirtans === 1 ? "kirtan" : "kirtans"}`)
  return parts.length ? parts.join(" + ") : "Empty"
}

/**
 * Drops kirtans that are not approved or no longer exist, keeping the order of everything else.
 * (A mix must never open a video that review turned down.)
 */
export function playableItems(items: readonly MixItem[], kirtans: ReadonlyMap<string, Pick<Kirtan, "status">>): MixItem[] {
  return items.filter((item) => item.kind === "ps" || kirtans.get(item.id)?.status === "approved")
}

/** The run of items of one kind that starts at `index`: a song run goes to the song player as one queue. */
export function runFrom(items: readonly MixItem[], index: number): { kind: MixItem["kind"]; start: number; end: number; items: MixItem[] } | null {
  const first = items[index]
  if (!first) return null
  let end = index
  while (items[end + 1]?.kind === first.kind) end += 1
  return { kind: first.kind, start: index, end, items: items.slice(index, end + 1) }
}

export type Handoff =
  /** nothing follows: the mix is over */
  | { action: "done" }
  /** the next item plays in the same player */
  | { action: "continue"; index: number; item: MixItem }
  /** the next item needs the other player: show "Next: <title> (opens ...)" and open it */
  | { action: "switch"; index: number; item: MixItem; to: "song-player" | "kirtan-player" }

/** What follows item `index`. */
export function handoffAfter(items: readonly MixItem[], index: number): Handoff {
  const next = items[index + 1]
  const here = items[index]
  if (!next || !here) return { action: "done" }
  if (next.kind === here.kind) return { action: "continue", index: index + 1, item: next }
  return { action: "switch", index: index + 1, item: next, to: next.kind === "ps" ? "song-player" : "kirtan-player" }
}

/** Text of the prompt before the other player opens. */
export function handoffPrompt(title: string, to: "song-player" | "kirtan-player"): string {
  return `Next: ${title} (opens ${to === "kirtan-player" ? "kirtan player" : "song player"})`
}

/** The Mixes shelf of Songs and Home. */
export function mixesWithCaption(mixes: readonly Mix[]): (Mix & { caption: string })[] {
  return mixes.map((m) => ({ ...m, caption: mixCaption(m.items) }))
}
