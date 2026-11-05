import type { MockSong } from "@/data/mock"
import { approvedKirtans, ensureKirtansRegistered, kiirtanSongByNumber } from "@/lib/kirtan/catalog"
import type { Mix } from "@/lib/kirtan/mix"
import {
  SOURCE_EVERYTHING,
  everythingQueue,
  kiirtanListSourceName,
  kiirtanQueue,
  mixItemNumber,
  shuffled,
  mixQueue,
  mixSourceName,
  startOf,
} from "@/lib/kirtan/queueBuild"
import { artistSourceName } from "@/lib/kirtan/artists"
import { listKindOf } from "@/lib/kirtan/kind"
import { isKiirtanNumber } from "@/lib/kirtan/track"
import type { Kirtan } from "@/lib/kirtan/types"
import { hasPlayableAudio, playableNumbersList } from "@/lib/playableAudio"
import { starterSongForNumber } from "@/lib/playPlaylist"
import { startNumber } from "@/lib/playerV2/sources"
import { usePlayerStore } from "@/stores/playerStore"
import { usePlayerV2Store } from "@/stores/playerV2Store"

/**
 * Starting playback of lists that mix Prabhat Samgiita songs and Kiirtans. Everything goes into the
 * ONE queue of the ONE player (a saved-list session named after the source), so a mix plays through
 * song, Kiirtan, song with no hand-off and no second player. Returns a message when nothing can play.
 */

/** The track record for any queue number: a Kiirtan's own, or the catalog song's starter record. */
export function trackForNumber(n: number): MockSong {
  if (isKiirtanNumber(n)) return kiirtanSongByNumber(n) ?? starterSongForNumber(n)
  return starterSongForNumber(n)
}

/**
 * Loads `numbers` as the queue, named `name` in "Playing from", and starts at `wanted` (or the first
 * track that can play). `original` is the unshuffled order, kept so the Shuffle button can undo a shuffle.
 */
export function playQueue(
  numbers: readonly number[],
  source: { id: string; name: string },
  wanted?: number | null,
  original: number[] | null = null,
): string | null {
  ensureKirtansRegistered()
  const first = startNumber(numbers, startOf(numbers, wanted), hasPlayableAudio)
  if (first == null) return "Nothing to play yet."
  usePlayerV2Store.getState().setShuffleOriginal(original)
  usePlayerStore.setState({ activePlaylist: { id: source.id, name: source.name } })
  usePlayerStore.getState().loadSong(trackForNumber(first), [...numbers], "playlist")
  return null
}

/** Play a mix: all its items, PS and Kiirtan, in order, from `index`. */
export function playMix(mix: Pick<Mix, "id" | "title" | "items">, index = 0, kirtans: readonly Kirtan[] = approvedKirtans()): string | null {
  const byId = new Map(kirtans.map((k) => [k.id, k]))
  const numbers = mixQueue(mix.items, byId)
  const item = mix.items[index]
  const wanted = item && (item.kind === "ps" || byId.get(item.id)?.status === "approved") ? mixItemNumber(item) : null
  return playQueue(numbers, { id: `mix:${mix.id}`, name: mixSourceName(mix.title) }, wanted)
}

/** Play a list of Kiirtans (the Kiirtan tab), starting at `startId`. `label` is the type filter's name. */
export function playKiirtans(list: readonly Kirtan[], startId?: string | null, label?: string | null): string | null {
  const numbers = kiirtanQueue(list)
  ensureKirtansRegistered()
  const target = startId ? list.find((k) => k.id === startId) : null
  const wanted = target ? kiirtanQueue([target])[0] : null
  const name = kiirtanListSourceName(label, listKindOf(list))
  return playQueue(numbers, { id: `kiirtans:${name}`, name }, wanted)
}

/** "Shuffle everything": every Prabhat Samgiita song with audio and every approved Kiirtan, shuffled into one queue. */
export function playEverything(rng: () => number = Math.random): string | null {
  const kirtans = approvedKirtans()
  ensureKirtansRegistered()
  const ps = [...playableNumbersList()]
  const queue = everythingQueue(ps, kirtans, rng)
  const ordered = [...ps, ...kiirtanQueue(kirtans)]
  return playQueue(queue, { id: "everything", name: SOURCE_EVERYTHING }, queue[0] ?? null, ordered)
}

/**
 * Play an artist's Kiirtans as one queue named after the artist. With `shuffle` the order is mixed and
 * the plain order is kept so the Shuffle button in the player can undo it.
 */
export function playArtist(artist: { id: string; name: string }, list: readonly Kirtan[], opts: { shuffle?: boolean; startId?: string | null; rng?: () => number } = {}): string | null {
  const ordered = kiirtanQueue(list)
  ensureKirtansRegistered()
  if (!ordered.length) return "Nothing to play yet."
  const queue = opts.shuffle ? shuffled(ordered, opts.rng) : ordered
  const target = opts.startId ? list.find((k) => k.id === opts.startId) : null
  const wanted = target ? kiirtanQueue([target])[0] : opts.shuffle ? (queue[0] ?? null) : null
  return playQueue(queue, { id: `artist:${artist.id}`, name: artistSourceName(artist.name) }, wanted, opts.shuffle ? ordered : null)
}
