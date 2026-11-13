import { moodBackend } from "./backend"

/**
 * The confirmed moods of the whole library, for the Search menu's mood chips and shelves: one small public list from
 * `GET /recording-moods/confirmed`, read at most every five minutes and shared by every screen that builds the menu.
 */
const FRESH_MS = 5 * 60 * 1000

let known: Readonly<Record<string, readonly string[]>> = {}
let at = 0
let inflight: Promise<Readonly<Record<string, readonly string[]>>> | null = null
const listeners = new Set<(next: Readonly<Record<string, readonly string[]>>) => void>()

export function confirmedMoods(): Readonly<Record<string, readonly string[]>> {
  return known
}

export function subscribeConfirmedMoods(fn: (next: Readonly<Record<string, readonly string[]>>) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Load (or reuse) the list. Never throws: offline the menu keeps what it had. */
export function loadConfirmedMoods(force = false): Promise<Readonly<Record<string, readonly string[]>>> {
  if (!force && Date.now() - at < FRESH_MS) return Promise.resolve(known)
  inflight ??= moodBackend()
    .confirmed()
    .then(
      (list) => {
        known = list
        at = Date.now()
        listeners.forEach((fn) => fn(known))
        return known
      },
      () => known,
    )
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Forget what was read, so the next load asks the server (after a vote may have confirmed a mood). */
export function forgetConfirmedMoods(): void {
  at = 0
}
