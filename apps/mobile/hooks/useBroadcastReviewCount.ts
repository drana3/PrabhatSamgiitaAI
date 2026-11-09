import { useEffect, useState } from "react"

import { broadcastReviewBackend } from "@/lib/broadcastReview/backend"

/**
 * How many broadcasts wait on the team's desk (reports not yet judged) plus recordings suggested for ended broadcasts.
 * Asked once when `enabled` (the member is on the team); a refusal or an offline phone gives zero. Nothing is stored.
 */
export function useBroadcastReviewCount(enabled: boolean, refreshKey = 0): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    let active = true
    const backend = broadcastReviewBackend()
    void Promise.all([backend.queue("queue"), backend.suggestions()])
      .then(([queue, recordings]) => {
        if (active) setCount(queue.total + recordings.total)
      })
      .catch(() => {
        if (active) setCount(0)
      })
    return () => {
      active = false
    }
  }, [enabled, refreshKey])
  return count
}
