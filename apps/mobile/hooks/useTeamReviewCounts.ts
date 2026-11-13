import { useEffect, useState } from "react"

import { teamReviewBackend } from "@/lib/teamReview/backend"
import type { Counts } from "@/lib/teamReview/types"

const NONE: Counts = { sheets: 0, comments: 0, videos: 0 }

/**
 * How many items wait on the team's review desk, per tab. Asked once when `enabled` (the member is on the team); a
 * refusal or an offline phone gives zeros. Nothing is stored on the device.
 */
export function useTeamReviewCounts(enabled: boolean, refreshKey = 0): Counts {
  const [counts, setCounts] = useState<Counts>(NONE)
  useEffect(() => {
    if (!enabled) {
      setCounts(NONE)
      return
    }
    let active = true
    void teamReviewBackend()
      .counts()
      .then((next) => {
        if (active) setCounts(next)
      })
      .catch(() => {
        if (active) setCounts(NONE)
      })
    return () => {
      active = false
    }
  }, [enabled, refreshKey])
  return counts
}
