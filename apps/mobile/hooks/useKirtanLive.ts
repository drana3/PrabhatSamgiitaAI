import { useEffect, useMemo, useState } from "react"

import { liveFixtures } from "@/lib/fixtures/kirtanLive"
import { liveNow, visibleLive, type LiveItem } from "@/lib/kirtan/live"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * The live broadcasts to show: not ended, live first. The clock ticks every 30 seconds so a card turns
 * LIVE or disappears by itself.
 * TODO(api): outside the preview there is no schedule yet, so the list is empty.
 */
export function useKirtanLive() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  // the sample list is built once, around the first clock reading, so it stays put while the clock runs
  const [base] = useState(() => (MOCKUP_DATA ? liveFixtures(Date.now()) : []))
  return useMemo(() => {
    const all: LiveItem[] = base
    return { now, all, items: visibleLive(all, now), current: liveNow(all, now), byId: new Map(all.map((i) => [i.id, i])) }
  }, [base, now])
}
