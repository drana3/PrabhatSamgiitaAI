import { pianoBackend } from "./backend"

/**
 * The ids of the recordings that have live piano notes, for the shelf "Kiirtan for piano". One small list from
 * `GET /piano-notes/recordings`, read at most every two minutes and shared by every screen that builds the shelf.
 */
const FRESH_MS = 2 * 60 * 1000

let ids: ReadonlySet<string> = new Set()
let at = 0
let inflight: Promise<ReadonlySet<string>> | null = null
const listeners = new Set<(next: ReadonlySet<string>) => void>()

export function pianoRecordingIds(): ReadonlySet<string> {
  return ids
}

export function subscribePianoRecordingIds(fn: (next: ReadonlySet<string>) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Load (or reuse) the ids. Never throws: offline the shelf simply keeps what it had. */
export function loadPianoRecordingIds(force = false): Promise<ReadonlySet<string>> {
  if (!force && Date.now() - at < FRESH_MS) return Promise.resolve(ids)
  inflight ??= pianoBackend()
    .recordingIds()
    .then(
      (list) => {
        ids = new Set(list)
        at = Date.now()
        listeners.forEach((fn) => fn(ids))
        return ids
      },
      () => ids,
    )
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Forget what was read, so the next load asks the server (after somebody offered or removed notes). */
export function forgetPianoRecordingIds(): void {
  at = 0
}
