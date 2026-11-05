import { useEffect, useMemo } from "react"

import { sampleKirtans } from "@/lib/fixtures/kirtanGate"
import { approvedOnly, newestFirst } from "@/lib/kirtan/list"
import type { Kirtan } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * The kirtans the app can play: the sample catalog plus the person's own approved submissions.
 * `byId` also holds their pending and rejected ones so the "Your submissions" list can find them.
 * TODO(api): the catalog comes from the backend.
 */
export function useKirtans() {
  const submissions = useKirtanStore((s) => s.submissions)

  // The preview starts with one submission waiting for review. Wait for the stored state first.
  useEffect(() => {
    if (!MOCKUP_DATA) return
    const seed = () => useKirtanStore.getState().seedDemo()
    if (useKirtanStore.persist.hasHydrated()) seed()
    return useKirtanStore.persist.onFinishHydration(seed)
  }, [])

  return useMemo(() => {
    const all = [...sampleKirtans(), ...submissions]
    const playable = newestFirst(approvedOnly(all))
    const byId = new Map<string, Kirtan>(all.map((k) => [k.id, k]))
    return { playable, byId, submissions }
  }, [submissions])
}
