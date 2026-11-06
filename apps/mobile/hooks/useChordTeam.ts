import { useEffect, useState } from "react"

import { chordsBackend } from "@/lib/songChords/backend"

/**
 * Is the signed-in member on the team, and how many charts wait for a look? The server decides (the same rule as the
 * Kiirtan uploads); the app only asks the review queue once and treats a refusal, an offline phone or a signed-out
 * visitor as "not the team". Nothing about the team is stored on the device.
 */
export type ChordTeam = { team: boolean; waiting: number }

export function useChordTeam(enabled: boolean, refreshKey = 0): ChordTeam {
  const [state, setState] = useState<ChordTeam>({ team: false, waiting: 0 })
  useEffect(() => {
    if (!enabled) {
      setState({ team: false, waiting: 0 })
      return
    }
    let active = true
    void chordsBackend()
      .reviewQueue("pending")
      .then((queue) => {
        if (active) setState({ team: true, waiting: queue.total })
      })
      .catch(() => {
        if (active) setState({ team: false, waiting: 0 })
      })
    return () => {
      active = false
    }
  }, [enabled, refreshKey])
  return state
}
