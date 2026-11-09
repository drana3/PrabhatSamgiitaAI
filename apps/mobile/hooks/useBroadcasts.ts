import { useCallback, useEffect, useState } from "react"

import { broadcastFailure, broadcastsBackend } from "@/lib/broadcasts/backend"
import type { Broadcast, BroadcastFailure, BroadcastWhich } from "@/lib/broadcasts/types"

/** The broadcasts of one list (`shelf`, `recent`, or the member's own `mine`) with its loading state; `reload` asks again. */
export function useBroadcasts(which: BroadcastWhich | "mine", enabled = true) {
  const [items, setItems] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(enabled)
  const [failure, setFailure] = useState<BroadcastFailure | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setItems([])
      setLoading(false)
      return
    }
    let live = true
    setLoading(true)
    const backend = broadcastsBackend()
    const asked = which === "mine" ? backend.mine() : backend.list(which)
    asked.then(
      (page) => {
        if (!live) return
        setItems(page.items)
        setFailure(null)
        setLoading(false)
      },
      (error: unknown) => {
        if (!live) return
        setItems([])
        setFailure(broadcastFailure(error))
        setLoading(false)
      },
    )
    return () => {
      live = false
    }
  }, [which, enabled, tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { items, loading, failure, reload }
}
