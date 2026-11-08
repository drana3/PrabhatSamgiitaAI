import { useCallback, useEffect, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"

import { chordFailure, chordsBackend } from "@/lib/songChords/backend"
import type { ChordFailure, ChordProposal, ChordReportReason } from "@/lib/songChords/types"

export type CommunityChords = {
  status: "loading" | "ready" | "error"
  items: ChordProposal[]
  reload: () => void
  /** the author takes their own chart back; resolves with a failure, or null when it worked */
  remove: (id: string) => Promise<ChordFailure | null>
  report: (id: string, reason: ChordReportReason) => Promise<"received" | "already_reported" | ChordFailure>
}

/**
 * The charts members offered for a song: the published ones, plus the signed-in viewer's own waiting ones (the server
 * decides what each viewer sees). A phone that is offline or a server that is down only means "no community charts
 * to show here": the song page, and its own chords, keep working.
 */
export function useCommunityChords(songNumber: number | null): CommunityChords {
  const [state, setState] = useState<{ status: CommunityChords["status"]; items: ChordProposal[] }>({ status: "loading", items: [] })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (songNumber === null) {
      setState({ status: "ready", items: [] })
      return
    }
    let active = true
    setState((s) => ({ status: "loading", items: s.items }))
    chordsBackend()
      .listForSong(songNumber)
      .then((items) => {
        if (active) setState({ status: "ready", items })
      })
      .catch(() => {
        if (active) setState({ status: "error", items: [] })
      })
    return () => {
      active = false
    }
  }, [songNumber, tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  // coming back to the song page (from the chord editor, after a chart was sent, replaced or taken back) shows what
  // changed meanwhile; the first look is the load above
  const seenOnce = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (seenOnce.current) setTick((n) => n + 1)
      seenOnce.current = true
    }, []),
  )

  const remove = useCallback(async (id: string) => {
    try {
      await chordsBackend().remove(id)
      setState((s) => ({ ...s, items: s.items.filter((p) => p.id !== id) }))
      return null
    } catch (error) {
      return chordFailure(error)
    }
  }, [])

  const report = useCallback(async (id: string, reason: ChordReportReason) => {
    try {
      return (await chordsBackend().report(id, reason)).status
    } catch (error) {
      return chordFailure(error)
    }
  }, [])

  return { status: state.status, items: state.items, reload, remove, report }
}
