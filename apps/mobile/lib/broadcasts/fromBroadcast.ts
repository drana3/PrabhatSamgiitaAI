import { remoteConfig } from "@/lib/kirtan/api"
import { callFor } from "@/lib/recordingExtras/http"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * "From a live broadcast: <title>, <date>" on the page of a recording that was made from one (docs/broadcasts.md). The API
 * puts it on the answer of ONE recording (`from_broadcast`); the phone asks for it when the page opens and shows nothing
 * on any failure: the mark is an extra, never a reason for the page not to open.
 */
export type FromBroadcast = { id: string; title: string; date: string }

const call = callFor("/api/v1/recordings")

/** A broadcast id goes into a route, so only an id of the expected shape is accepted (the preview's are "mock-broadcast-3"). */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

export function fromBroadcastOf(wire: unknown): FromBroadcast | null {
  const mark = (wire as { from_broadcast?: { id?: unknown; title?: unknown; date?: unknown } | null } | null)?.from_broadcast
  if (!mark || typeof mark.id !== "string" || !SAFE_ID.test(mark.id) || typeof mark.title !== "string" || !mark.title.trim() || typeof mark.date !== "string") return null
  return { id: mark.id, title: mark.title.trim(), date: mark.date }
}

/** Preview only: a sample recording that came from the sample broadcast "Sunday satsang, last week" (ended two days ago). */
export const MOCK_FROM_BROADCAST: Record<string, FromBroadcast> = {
  "k-bnk-evening": { id: "mock-broadcast-2", title: "Sunday satsang, last week", date: new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10) },
}

export async function fetchFromBroadcast(recordingId: string): Promise<FromBroadcast | null> {
  if (MOCKUP_DATA) return MOCK_FROM_BROADCAST[recordingId] ?? null
  try {
    return fromBroadcastOf(await call<unknown>(remoteConfig(), "GET", `/${encodeURIComponent(recordingId)}`))
  } catch {
    return null
  }
}
