import { useEffect, useState } from "react"

import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useLearnStore } from "@/stores/learnStore"

/**
 * True once the saved Learn state has been read from the phone. In the preview
 * (EXPO_PUBLIC_MOCKUP_DATA=1) the prototype's sample library is put in the first time.
 */
export function useLearnHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useLearnStore.persist.hasHydrated())
  useEffect(() => {
    if (useLearnStore.persist.hasHydrated()) setHydrated(true)
    return useLearnStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])
  useEffect(() => {
    if (hydrated && MOCKUP_DATA) useLearnStore.getState().seedDemo()
  }, [hydrated])
  return hydrated
}
