import assignment from "@/data/psCollections/assignment.json"
import languages from "@/data/psCollections/languages.json"
import raga from "@/data/psCollections/raga.json"
import tala from "@/data/psCollections/tala.json"
import { parsePsCollections, songsForKey, type PsCollection } from "@/lib/psCollections/parse"

/**
 * Every Prabhat Samgiita collection the four data files carry (hidden ones included, with their reason).
 * The files are refreshed by `node scripts/syncPsCollections.mjs`; nothing here is typed in by hand.
 */
export const PS_ALL: readonly PsCollection[] = [
  ...parsePsCollections("assignment", assignment),
  ...parsePsCollections("languages", languages),
  ...parsePsCollections("tala", tala),
  ...parsePsCollections("raga", raga),
]

/** Song numbers of the collection a route key names (songs-v2-collection?id=ps:assignment:morning), or null. */
export function psSongNumbers(key: string): number[] | null {
  return songsForKey(PS_ALL, key)
}
