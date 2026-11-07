import { useCallback, useEffect, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"

import { chordsBackend } from "@/lib/songChords/backend"
import { ingestMine } from "@/lib/songChords/noticeSync"
import type { ChordProposal } from "@/lib/songChords/types"

/**
 * The signed-in member's own chord charts. Loading them is also what tells the member how their charts were decided:
 * every list that arrives is handed to the notification centre (lib/songChords/noticeSync.ts), which adds a notice
 * for a chart that was published or not accepted since the last look.
 */
export type MyChords = {
  status: "idle" | "loading" | "ready" | "error"
  items: ChordProposal[]
  reload: () => void
  /** forget a chart that was just deleted, without waiting for a new load */
  drop: (id: string) => void
}

export function useMyChords(enabled: boolean, refreshKey = 0): MyChords {
  const [state, setState] = useState<{ status: MyChords["status"]; items: ChordProposal[] }>({ status: enabled ? "loading" : "idle", items: [] })
  const [again, setAgain] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle", items: [] })
      return undefined
    }
    let active = true
    setState((was) => ({ status: was.items.length ? "ready" : "loading", items: was.items }))
    chordsBackend()
      .mine()
      .then((items) => {
        if (!active) return
        setState({ status: "ready", items })
        ingestMine(items)
      })
      .catch(() => {
        if (active) setState((was) => ({ status: "error", items: was.items }))
      })
    return () => {
      active = false
    }
  }, [enabled, refreshKey, again])

  const reload = useCallback(() => setAgain((n) => n + 1), [])
  // coming back to the screen (from the editor, from a song page) shows what changed meanwhile; the first look is the load above
  const seenOnce = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (seenOnce.current) setAgain((n) => n + 1)
      seenOnce.current = true
    }, []),
  )
  const drop = useCallback((id: string) => setState((was) => ({ ...was, items: was.items.filter((p) => p.id !== id) })), [])
  return { status: state.status, items: state.items, reload, drop }
}
