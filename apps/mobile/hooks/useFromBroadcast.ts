import { useEffect, useState } from "react"

import { fetchFromBroadcast, type FromBroadcast } from "@/lib/broadcasts/fromBroadcast"

/** The live broadcast a recording was made from, or null (none, or not known yet). */
export function useFromBroadcast(recordingId: string): FromBroadcast | null {
  const [mark, setMark] = useState<FromBroadcast | null>(null)
  useEffect(() => {
    let live = true
    void fetchFromBroadcast(recordingId).then((found) => {
      if (live) setMark(found)
    })
    return () => {
      live = false
    }
  }, [recordingId])
  return mark
}
