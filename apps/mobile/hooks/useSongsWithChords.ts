import { useEffect, useState } from "react"

import { remoteConfig } from "@/lib/kirtan/api"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { fetchSongsWithChords } from "@/lib/songChords/withChords"

/** One read for the whole app, kept for a few minutes; a failed read is tried again the next time somebody asks. */
const FRESH_MS = 5 * 60 * 1000
let cached: { set: Set<number>; at: number } | null = null
let inFlight: Promise<Set<number> | null> | null = null
const listeners = new Set<(set: Set<number> | null) => void>()

function load(): Promise<Set<number> | null> {
  if (cached && Date.now() - cached.at < FRESH_MS) return Promise.resolve(cached.set)
  inFlight ??= fetchSongsWithChords(remoteConfig())
    .then((set) => {
      cached = { set, at: Date.now() }
      listeners.forEach((listener) => listener(set))
      return set
    })
    .catch(() => cached?.set ?? null) // offline or the server is down: no ranking, never an error on the list
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/**
 * The numbers of the songs that have chords, or null while that is not known (loading, offline, the web preview).
 * Null means "do not rank", never "no song has chords".
 */
export function useSongsWithChords(): Set<number> | null {
  const [set, setSet] = useState<Set<number> | null>(cached?.set ?? null)
  useEffect(() => {
    if (MOCKUP_DATA) return
    let active = true
    const listener = (next: Set<number> | null) => active && setSet(next)
    listeners.add(listener)
    void load().then((next) => active && next && setSet(next))
    return () => {
      active = false
      listeners.delete(listener)
    }
  }, [])
  return set
}
