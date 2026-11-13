import { useCallback, useEffect, useRef, useState } from "react"

import { errorKeyOf } from "@/stores/authorStore"

/**
 * Runs one request when the screen opens and again when `deps` change; gives back the data, a loading flag and the i18n
 * key of the error sentence. A late answer of an old request is ignored (the person typed again or left).
 */
export function useAuthorRequest<T>(run: () => Promise<T>, deps: readonly unknown[], enabled = true) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(enabled)
  const ticket = useRef(0)
  const latest = useRef(run)
  latest.current = run

  const load = useCallback(() => {
    const mine = ++ticket.current
    setLoading(true)
    setError(null)
    latest.current().then(
      (value) => {
        if (mine !== ticket.current) return
        setData(value)
        setLoading(false)
      },
      (failure: unknown) => {
        if (mine !== ticket.current) return
        setError(errorKeyOf(failure))
        setLoading(false)
      },
    )
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return undefined
    }
    load()
    return () => {
      ticket.current += 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  return { data, error, loading, reload: load, setData }
}
