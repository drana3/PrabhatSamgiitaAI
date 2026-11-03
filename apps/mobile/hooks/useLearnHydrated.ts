import { useEffect, useState } from "react"

import { useLearnStore } from "@/stores/learnStore"

/** True once the saved Learn state has been read from the phone. */
export function useLearnHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useLearnStore.persist.hasHydrated())
  useEffect(() => {
    if (useLearnStore.persist.hasHydrated()) setHydrated(true)
    return useLearnStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])
  return hydrated
}
