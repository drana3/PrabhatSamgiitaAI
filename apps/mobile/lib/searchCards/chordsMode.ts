import { wantsChords } from "@/lib/songsV2/chordsFirst"

/**
 * "Songs with chords first" in Search (Dada, 10 Nov 2026): the switch turns itself on when the query asks for chords
 * (guitar, chords, capo, ukulele, гитара, аккорды, guitarra, acordes) and one tap turns it off. A person can also turn
 * it on by hand for any query. Pure rules; the server side (`GET /song-chords/with-chords`) is read by hooks/useSongsWithChords.ts.
 */

export type ChordsMode = {
  on: boolean
  /** switched on by the words of the query (not by a tap): it may switch itself off again when the words go */
  auto: boolean
}

export function initialChordsMode(query: string): ChordsMode {
  const asked = wantsChords(query)
  return { on: asked, auto: asked }
}

/**
 * The mode after the query changed. A guitar-ish word appearing turns it on (also after the person turned it off for an
 * earlier query); the word going away turns it off again only when the words had turned it on.
 */
export function chordsModeAfterQuery(prev: ChordsMode, before: string, after: string): ChordsMode {
  const had = wantsChords(before)
  const has = wantsChords(after)
  if (!had && has) return { on: true, auto: true }
  if (had && !has && prev.auto) return { on: false, auto: false }
  return prev
}

/** One tap on the switch. A tap always becomes the person's own choice. */
export function toggleChordsMode(prev: ChordsMode): ChordsMode {
  return { on: !prev.on, auto: false }
}

export type ChordSplit<T> = {
  withChords: T[]
  rest: T[]
}

/**
 * The songs with chords as their own block, the others after them; the order inside both is kept.
 * `hasChords` is null while the server's list is not known (loading, offline): then nothing is split.
 */
export function splitByChords<T>(items: readonly T[], numberOf: (item: T) => number, hasChords: ReadonlySet<number> | null): ChordSplit<T> {
  if (!hasChords) return { withChords: [], rest: [...items] }
  const withChords: T[] = []
  const rest: T[] = []
  for (const item of items) (hasChords.has(numberOf(item)) ? withChords : rest).push(item)
  return { withChords, rest }
}
