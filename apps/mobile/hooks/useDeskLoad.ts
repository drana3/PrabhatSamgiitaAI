import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react"

import { deskFailure } from "@/lib/teamDesks/backend"

export type DeskLoadStatus = "loading" | "ready" | "error" | "offline" | "denied"

/**
 * Loads one list of a team desk. `loading` while it asks (the old list stays on screen, so a tab change does not flash),
 * `denied` when the server says the member is not the team, `offline` without a connection, `error` otherwise. `reload`
 * asks again; `setData` lets a card drop itself from the list once the team decided it. A late answer of an old request
 * is ignored.
 */
export function useDeskLoad<T>(load: () => Promise<T>, empty: T, deps: readonly unknown[]): {
  status: DeskLoadStatus
  data: T
  reload: () => void
  setData: Dispatch<SetStateAction<T>>
} {
  const [state, setState] = useState<{ status: DeskLoadStatus; data: T }>({ status: "loading", data: empty })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let active = true
    setState((s0) => ({ status: "loading", data: s0.data }))
    load()
      .then((data) => {
        if (active) setState({ status: "ready", data })
      })
      .catch((error: unknown) => {
        if (!active) return
        const failure = deskFailure(error)
        setState({ status: failure === "denied" ? "denied" : failure === "network" ? "offline" : "error", data: empty })
      })
    return () => {
      active = false
    }
    // `load` and `empty` are rebuilt every render; the caller names what really changes in `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  const reload = useCallback(() => setTick((n) => n + 1), [])
  const setData: Dispatch<SetStateAction<T>> = useCallback((next) => {
    setState((s0) => ({ ...s0, data: typeof next === "function" ? (next as (prev: T) => T)(s0.data) : next }))
  }, [])
  return { status: state.status, data: state.data, reload, setData }
}
