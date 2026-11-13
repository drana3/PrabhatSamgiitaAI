import { useEffect, useState } from "react"

import type { RemoteConfig } from "@/lib/kirtan/remote"
import { callFor } from "@/lib/recordingExtras/http"

/**
 * "Your recording is now on an author page" for the person who added the recording (docs/author-profiles.md, "The
 * uploader is told"). The server lists, for the member's own recordings, the published author pages of other people that
 * show them (`GET /recordings/mine/author-pages`); "My uploads" draws one quiet line under such a recording. Asked at
 * most once in a while and shared by every row; a failure or an offline phone means "no line", never an error.
 */
export type ShownPage = { id: string; slug: string; name: string }
export type ShownOnPages = { recording_id: string; pages: ShownPage[] }

const call = callFor("/api/v1/recordings/mine")

export async function fetchShownOnPages(cfg: RemoteConfig): Promise<ShownOnPages[]> {
  const result = await call<{ items: ShownOnPages[] }>(cfg, "GET", "/author-pages")
  return Array.isArray(result.items) ? result.items : []
}

/** The pages of one recording out of the list (pure). */
export function pagesOf(items: readonly ShownOnPages[], recordingId: string | undefined): ShownPage[] {
  if (!recordingId) return []
  return items.find((i) => i.recording_id === recordingId)?.pages ?? []
}

const TTL_MS = 60_000
let cache: { at: number; items: ShownOnPages[] } | null = null
let inflight: Promise<ShownOnPages[]> | null = null
const listeners = new Set<() => void>()

/** Preview and tests: the answer to give instead of asking a server. */
let stand: (() => ShownOnPages[]) | null = null
export function setShownOnPagesStandIn(fn: (() => ShownOnPages[]) | null): void {
  stand = fn
  cache = null
}

async function load(): Promise<ShownOnPages[]> {
  if (stand) return stand()
  if (cache && Date.now() - cache.at < TTL_MS) return cache.items
  // loaded only when needed: the server address and the member's headers pull in the app's client
  inflight ??= import("@/lib/kirtan/api")
    .then((wiring) => (wiring.canUseServer() ? fetchShownOnPages(wiring.remoteConfig()) : []))
    .then((items) => {
      cache = { at: Date.now(), items }
      return items
    })
    .catch(() => cache?.items ?? [])
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Forget the answer (after sign-out or a decision) so the next row asks again. */
export function forgetShownOnPages(): void {
  cache = null
  for (const l of listeners) l()
}

/** The author pages that show this recording of the member's own; empty until known and when there are none. */
export function useShownOnPages(recordingId: string | undefined): ShownPage[] {
  const [pages, setPages] = useState<ShownPage[]>([])
  useEffect(() => {
    if (!recordingId) {
      setPages([])
      return
    }
    let active = true
    const run = () => {
      void load().then((items) => {
        if (active) setPages(pagesOf(items, recordingId))
      })
    }
    run()
    listeners.add(run)
    return () => {
      active = false
      listeners.delete(run)
    }
  }, [recordingId])
  return pages
}
