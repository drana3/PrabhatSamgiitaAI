import { allKirtans } from "@/lib/kirtan/catalog"
import { remoteConfig } from "@/lib/kirtan/api"
import { cleanMantra, groupLocalMantras, localVersions, lookupLocalMantra, suggestLocalMantras, summaryFromRemote, type MantraSummary } from "@/lib/kirtan/mantras"
import { fetchMantras, fetchMantraVersions, lookupMantra, suggestMantras, type RemoteConfig } from "@/lib/kirtan/remote"
import { fromRemote } from "@/lib/kirtan/submissions"
import type { Kirtan, RecordingKind } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * Where the mantra screens get their data. In the demo preview (MOCKUP_DATA) there is no server: the mantras are
 * those of the sample list and of the person's own uploads, grouped on the phone by the same rule as the server.
 * In a real build the public mantra endpoints answer (no sign-in needed), and when they cannot be reached the call
 * throws, so the screen can say so honestly instead of showing an empty list as if it were true.
 * `cfg` is only for tests; the default is the real wiring.
 */

export async function suggestMantraTitles(query: string, kind: RecordingKind, cfg?: RemoteConfig): Promise<MantraSummary[]> {
  if (MOCKUP_DATA) return suggestLocalMantras(allKirtans(), query, kind)
  return (await suggestMantras(cfg ?? remoteConfig(), query, kind)).map(summaryFromRemote)
}

/** How many versions of this mantra exist already; 0 when the title is new or empty. */
export async function versionsOfMantra(title: string, kind: RecordingKind, cfg?: RemoteConfig): Promise<{ mantra: MantraSummary | null; versions: number }> {
  if (!cleanMantra(title)) return { mantra: null, versions: 0 }
  if (MOCKUP_DATA) return lookupLocalMantra(allKirtans(), title, kind)
  const found = await lookupMantra(cfg ?? remoteConfig(), cleanMantra(title), kind)
  return { mantra: found.mantra ? summaryFromRemote(found.mantra) : null, versions: found.versions }
}

export async function loadMantras(kind?: RecordingKind, cfg?: RemoteConfig): Promise<MantraSummary[]> {
  if (MOCKUP_DATA) return groupLocalMantras(allKirtans(), kind)
  return (await fetchMantras(cfg ?? remoteConfig(), { kind })).map(summaryFromRemote)
}

/** The versions of one mantra as playable recordings. Server ones are added to the catalogue so the player can queue them. */
export async function loadMantraVersions(id: string, sort: "newest" | "plays", cfg?: RemoteConfig): Promise<{ mantra: MantraSummary | null; items: Kirtan[] }> {
  if (MOCKUP_DATA) return localVersions(allKirtans(), id, sort)
  const found = await fetchMantraVersions(cfg ?? remoteConfig(), id, sort)
  useKirtanStore.getState().addToCatalog(found.items)
  const blocked = new Set(useKirtanStore.getState().blockedAuthorIds)
  const items = found.items.map((r) => fromRemote(r)).filter((k) => !(k.authorId && blocked.has(k.authorId)))
  return { mantra: summaryFromRemote(found.mantra), items }
}
