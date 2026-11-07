import { RemoteError } from "@/lib/kirtan/remote"
import type { PlayBatchResult, PlayEventOut } from "@/lib/authors/types"

/**
 * Sends the waiting listening events. Injected pieces (the queue, the sender) keep it testable. One batch per call.
 *
 * What a failure means: no network, a 5xx or a 429 (try later) keep the batch in the line; any other 4xx means the
 * server will never take these events, so they are dropped and the line cannot get stuck.
 */
export type FlushDeps = {
  next: () => PlayEventOut[]
  done: (sent: number) => void
  send: (events: PlayEventOut[]) => Promise<PlayBatchResult>
}

export type FlushResult = "empty" | "sent" | "kept" | "dropped"

export async function flushPlays(deps: FlushDeps): Promise<FlushResult> {
  const batch = deps.next()
  if (!batch.length) return "empty"
  try {
    await deps.send(batch)
    deps.done(batch.length)
    return "sent"
  } catch (error) {
    if (error instanceof RemoteError && error.status >= 400 && error.status < 500 && error.status !== 429 && error.status !== 408) {
      deps.done(batch.length)
      return "dropped"
    }
    return "kept"
  }
}
