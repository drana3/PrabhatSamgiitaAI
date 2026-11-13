import { isEventName, sanitizeProps, type EventName, type EventProps } from "@/lib/analytics/events"

/**
 * The analytics client with everything injected (network, timer, settings), so tests run it with
 * fakes. It never throws and never blocks the app: a failed send drops the batch after one retry.
 *
 * Modes (the person's choice, Profile, Usage data; default "anonymous"):
 *   anonymous  events carry no install id; the server cannot tell two launches apart
 *   shared     events also carry a random install id (stored on the server only as a short hash)
 *   off        nothing is queued, nothing is sent
 * Without an endpoint (no API address, a preview build) the client does nothing at all.
 */
export type AnalyticsMode = "anonymous" | "shared" | "off"

export type AnalyticsDeps = {
  /** Full URL of POST /api/v1/events; empty or undefined = a no-op client */
  endpoint: string | undefined
  fetch: typeof fetch
  mode: () => AnalyticsMode
  /** resolves the random install id (only asked in "shared" mode) */
  installId: () => Promise<string>
  sessionId: string
  appVersion: string | undefined
  platform: string | undefined
  language: () => string
  /** schedule a callback after ms; returns a cancel function */
  later?: (fn: () => void, ms: number) => () => void
  flushAfterMs?: number
  maxQueue?: number
  batchSize?: number
}

export type Analytics = {
  track: (name: EventName, props?: EventProps) => void
  flush: () => Promise<void>
  /** how many events wait to be sent (for tests and the debug screen) */
  pending: () => number
}

type Queued = { name: EventName; props: Record<string, string | number | boolean> }

const defaultLater = (fn: () => void, ms: number) => {
  const handle = setTimeout(fn, ms)
  return () => clearTimeout(handle)
}

export function createAnalytics(deps: AnalyticsDeps): Analytics {
  const later = deps.later ?? defaultLater
  const flushAfter = deps.flushAfterMs ?? 20_000
  const maxQueue = deps.maxQueue ?? 100
  const batchSize = deps.batchSize ?? 50
  let queue: Queued[] = []
  let cancel: (() => void) | null = null
  let sending = false

  async function send(batch: Queued[]): Promise<boolean> {
    const mode = deps.mode()
    if (mode === "off" || !deps.endpoint) return true
    const body: Record<string, unknown> = {
      mode,
      session_id: deps.sessionId,
      app_version: deps.appVersion,
      platform: deps.platform,
      language: deps.language(),
      events: batch.map((e) => ({ name: e.name, props: e.props })),
    }
    if (mode === "shared") body.install_id = await deps.installId()
    try {
      const response = await deps.fetch(deps.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      // a 4xx will not get better by trying again; only a network failure or a 5xx is retried
      return response.status < 500
    } catch {
      return false
    }
  }

  async function flush(): Promise<void> {
    if (cancel) {
      cancel()
      cancel = null
    }
    if (sending || queue.length === 0) return
    sending = true
    try {
      while (queue.length > 0) {
        const batch = queue.slice(0, batchSize)
        let ok = await send(batch)
        if (!ok) ok = await send(batch)
        queue = queue.slice(batch.length) // delivered or given up: never loop on a dead network
        if (!ok) break
      }
    } finally {
      sending = false
    }
  }

  function track(name: EventName, props?: EventProps): void {
    try {
      if (!deps.endpoint || deps.mode() === "off" || !isEventName(name)) return
      queue.push({ name, props: sanitizeProps(name, props) })
      if (queue.length > maxQueue) queue = queue.slice(queue.length - maxQueue)
      if (queue.length >= batchSize) void flush()
      else if (!cancel) cancel = later(() => void flush(), flushAfter)
    } catch {
      // analytics must never break a screen
    }
  }

  return { track, flush, pending: () => queue.length }
}

/** A client that does nothing: used with no endpoint, in previews and in tests of screens. */
export const noopAnalytics: Analytics = {
  track: () => undefined,
  flush: async () => undefined,
  pending: () => 0,
}
