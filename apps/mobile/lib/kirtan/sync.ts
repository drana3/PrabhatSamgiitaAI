import { canUseServer, remoteConfig } from "@/lib/kirtan/api"
import { fetchMine, fetchPublished } from "@/lib/kirtan/remote"
import { syncBlockedAuthors } from "@/lib/kirtan/safety"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * Pulls what the server knows into the store: the published recordings of everyone (the catalogue), the person's own
 * uploads (so a removal shows with its reason) and the authors they blocked. Never throws: offline simply keeps
 * what the phone has. Not run in the demo preview.
 */
export async function refreshKirtans(): Promise<void> {
  if (MOCKUP_DATA) return
  const cfg = remoteConfig()
  const store = useKirtanStore.getState()
  try {
    store.setCatalog(await fetchPublished(cfg))
  } catch {
    /* offline: keep the last catalogue the phone has */
  }
  if (!canUseServer()) return
  try {
    store.applyMine(await fetchMine(cfg))
  } catch {
    /* offline */
  }
  try {
    await syncBlockedAuthors()
  } catch {
    /* offline */
  }
}
