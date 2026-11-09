import { useEffect, useState } from "react"

import { claimsDesk } from "@/lib/authors/deskApi"

/**
 * How many author claims wait on the team's desk. Asked once when `enabled` (the member is on the team); a refusal or an
 * offline phone gives zero. Nothing is stored on the device.
 */
export function useClaimsDeskCount(enabled: boolean, refreshKey = 0): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    let active = true
    void claimsDesk()
      .summary()
      .then((summary) => {
        if (active) setCount(summary.pending)
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
