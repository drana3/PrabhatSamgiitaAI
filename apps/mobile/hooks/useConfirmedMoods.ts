import { useEffect, useState } from "react"

import { confirmedMoods, loadConfirmedMoods, subscribeConfirmedMoods } from "@/lib/recordingMoods/confirmed"

/** The confirmed moods of the library (loaded once, shared, refreshed every five minutes at most). */
export function useConfirmedMoods(): Readonly<Record<string, readonly string[]>> {
  const [known, setKnown] = useState(confirmedMoods)
  useEffect(() => {
    const off = subscribeConfirmedMoods(setKnown)
    void loadConfirmedMoods()
    return off
  }, [])
  return known
}
