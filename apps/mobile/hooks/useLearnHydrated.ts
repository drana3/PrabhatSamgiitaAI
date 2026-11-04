import { useEffect, useState } from "react"

import { useLearnStore } from "@/stores/learnStore"

/**
 * True once the saved Learn state has been read from the phone. The first time, the
 * prototype's sample library is put in (TODO(api): fixtures until real progress exists).
 */
export function useLearnHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useLearnStore.persist.hasHydrated())
  useEffect(() => {
    if (useLearnStore.persist.hasHydrated()) setHydrated(true)
    return useLearnStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])
  useEffect(() => {
    if (hydrated) useLearnStore.getState().seedDemo()
  }, [hydrated])
  return hydrated
}
