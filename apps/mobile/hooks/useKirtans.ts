import { useEffect, useMemo } from "react"

import { sampleKirtans } from "@/lib/fixtures/kirtanGate"
import { mergeCatalog, publishedOnly, newestFirst } from "@/lib/kirtan/list"
import { refreshKirtans } from "@/lib/kirtan/sync"
import type { Kirtan } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * The kirtans the app can play: the person's own published uploads, what the server publishes for everyone (minus the
 * authors they blocked) and the demo samples (preview only). `byId` also holds the person's uploading, failed and
 * removed ones so "My uploads" can find them.
 */
export function useKirtans() {
  const submissions = useKirtanStore((s) => s.submissions)
  const catalog = useKirtanStore((s) => s.catalog)
  const blockedAuthorIds = useKirtanStore((s) => s.blockedAuthorIds)

  // The preview starts with the person's two demo uploads. Wait for the stored state first.
  useEffect(() => {
    if (!MOCKUP_DATA) return
    const seed = () => useKirtanStore.getState().seedDemo()
    if (useKirtanStore.persist.hasHydrated()) seed()
    return useKirtanStore.persist.onFinishHydration(seed)
  }, [])

  // A real build asks the server once per visit (offline keeps what the phone has).
  useEffect(() => {
    void refreshKirtans()
  }, [])

  return useMemo(() => {
    const all = mergeCatalog(submissions, catalog, sampleKirtans(), blockedAuthorIds)
    const playable = newestFirst(publishedOnly(all))
    const byId = new Map<string, Kirtan>(all.map((k) => [k.id, k]))
    return { playable, byId, submissions }
  }, [submissions, catalog, blockedAuthorIds])
}
