import { applyRemote, captureLocal, dirtyEntries, hasDirty, type LearnLists, type SyncMeta } from "@/lib/learn/syncMerge"
import { LearnSyncError, type LearnSyncTransport } from "@/lib/learn/syncApi"

/**
 * One round of Learn sync, with everything it touches passed in (docs/learn-sync.md):
 *
 *   notice local changes -> send what changed (or just read, when nothing changed) -> fold the answer in
 *
 * Offline-safe: a failed request changes nothing; what was waiting stays marked and goes out next time.
 * A server copy never replaces a newer local one (see syncMerge.ts). One round at a time; a request that
 * arrives while one is running makes it run once more when it ends.
 */
export type SyncDeps = {
  /** the account to sync, or null when there is nothing to do: guest, no member sync in this build, data not ready */
  owner: () => string | null
  /** changes when the person signs out or in, so an answer for the old account is dropped */
  epoch: () => number
  readLists: () => LearnLists
  writeLists: (lists: LearnLists) => void
  readMeta: (owner: string) => SyncMeta
  writeMeta: (owner: string, meta: SyncMeta) => void
  transport: LearnSyncTransport
  now: () => number
}

export type SyncOutcome =
  | { status: "ok"; /** something is still waiting to be sent */ pending: boolean }
  | { status: "skipped"; reason: "not-ready" | "backoff" | "changed-account" }
  | { status: "failed"; reason: "offline" | "unauthorized" | "too-large" | "server" }

/** Rounds that may follow the first one in the same call. */
const MAX_EXTRA_ROUNDS = 2

/** After a failure, automatic rounds wait this long (an explicit round does not). */
export const RETRY_AFTER_MS = 30_000

function failure(error: unknown): SyncOutcome {
  const status = error instanceof LearnSyncError ? error.status : 0
  if (status === 0) return { status: "failed", reason: "offline" }
  if (status === 401 || status === 403) return { status: "failed", reason: "unauthorized" }
  if (status === 413) return { status: "failed", reason: "too-large" }
  return { status: "failed", reason: "server" }
}

export function createLearnSyncEngine(deps: SyncDeps) {
  let running: Promise<SyncOutcome> | null = null
  let again = false
  let failedAt: number | null = null

  function capture(owner: string): SyncMeta {
    const before = deps.readMeta(owner)
    const after = captureLocal(before, deps.readLists(), deps.now())
    if (after !== before) deps.writeMeta(owner, after)
    return after
  }

  async function round(force: boolean): Promise<SyncOutcome> {
    const owner = deps.owner()
    if (!owner) return { status: "skipped", reason: "not-ready" }
    if (!force && failedAt !== null && deps.now() - failedAt < RETRY_AFTER_MS) {
      return { status: "skipped", reason: "backoff" }
    }
    const epoch = deps.epoch()
    const waiting = dirtyEntries(capture(owner))
    let remote
    try {
      remote = waiting.length > 0 ? await deps.transport.push(waiting) : await deps.transport.pull()
    } catch (error) {
      failedAt = deps.now()
      return failure(error)
    }
    failedAt = null
    if (deps.owner() !== owner || deps.epoch() !== epoch) return { status: "skipped", reason: "changed-account" }
    // changes made while the request was out are noticed first, so the answer cannot overwrite them
    const meta = capture(owner)
    const result = applyRemote(meta, deps.readLists(), remote, deps.now())
    if (result.meta !== meta) deps.writeMeta(owner, result.meta)
    if (result.listsChanged) deps.writeLists(result.lists)
    return { status: "ok", pending: hasDirty(result.meta) }
  }

  async function syncNow(options: { force?: boolean } = {}): Promise<SyncOutcome> {
    if (running) {
      again = true
      return running
    }
    const force = options.force === true
    running = (async () => {
      try {
        let outcome = await round(force)
        // Runs once more when a request came in during the round, or when the round left something to send
        // (for example the two phones' progress was just combined). A few times at most, never after a failure.
        for (let extra = 0; extra < MAX_EXTRA_ROUNDS && outcome.status === "ok" && (again || outcome.pending); extra++) {
          again = false
          outcome = await round(force)
        }
        return outcome
      } finally {
        again = false
        running = null
      }
    })()
    return running
  }

  return { syncNow }
}
