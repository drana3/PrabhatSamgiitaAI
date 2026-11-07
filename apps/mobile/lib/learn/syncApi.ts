import { EMPTY_PATH, type PathState } from "@/lib/learn/progress"
import type { SyncEntry } from "@/lib/learn/syncMerge"

/**
 * The two calls of Learn sync (docs/learn-sync.md): GET and PUT /api/v1/members/me/learn-progress.
 * Plain fetch with the member headers the app already builds; the base URL and headers are passed in so the
 * file has no app wiring and can be tested with a fake fetch.
 */

export type LearnSyncTransport = {
  /** the server's whole document */
  pull: () => Promise<SyncEntry[]>
  /** merge these entries on the server; resolves to the whole merged document */
  push: (entries: readonly SyncEntry[]) => Promise<SyncEntry[]>
}

/** A reply that is not a success. `status` 0 means the request never got an answer (offline, timeout). */
export class LearnSyncError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code = "") {
    super(status === 0 ? "Learn sync: no answer" : `Learn sync failed with status ${status}`)
    this.name = "LearnSyncError"
    this.status = status
    this.code = code
  }
}

type WireEntry = {
  song_id: string
  number: number
  title: string
  started_at: number
  removed: boolean
  path: PathState
  updated_at: number
}

export function entryToWire(entry: SyncEntry): WireEntry {
  return {
    song_id: entry.songId,
    number: entry.number,
    title: entry.title,
    started_at: entry.startedAt,
    removed: entry.removed,
    path: { ...entry.path },
    updated_at: entry.updatedAt,
  }
}

function bool(value: unknown): boolean {
  return value === true
}

/** One entry of the reply, or null when it is not a usable song (it is skipped, never trusted half-way). */
export function entryFromWire(raw: unknown): SyncEntry | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  const { song_id, number, title, started_at, updated_at } = item
  if (typeof song_id !== "string" || typeof number !== "number" || !Number.isInteger(number)) return null
  if (typeof title !== "string" || !title.trim()) return null
  if (typeof started_at !== "number" || typeof updated_at !== "number") return null
  if (!Number.isFinite(started_at) || !Number.isFinite(updated_at) || updated_at < 1) return null
  const path = (item.path && typeof item.path === "object" ? item.path : {}) as Record<string, unknown>
  return {
    songId: song_id,
    number,
    title,
    startedAt: started_at,
    removed: bool(item.removed),
    path: {
      ...EMPTY_PATH,
      listen: bool(path.listen),
      words: bool(path.words),
      meaning: bool(path.meaning),
      chords: bool(path.chords),
    },
    updatedAt: updated_at,
  }
}

export function entriesFromBody(body: unknown): SyncEntry[] {
  const songs = body && typeof body === "object" ? (body as { songs?: unknown }).songs : undefined
  if (!Array.isArray(songs)) throw new LearnSyncError(200, "bad_body")
  return songs.map(entryFromWire).filter((entry): entry is SyncEntry => entry !== null)
}

export function createLearnSyncTransport(options: {
  baseUrl: string
  headers: () => Record<string, string>
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): LearnSyncTransport {
  const base = options.baseUrl.replace(/\/$/, "")
  const url = `${base}/api/v1/members/me/learn-progress`
  const timeoutMs = options.timeoutMs ?? 15_000

  async function call(init: RequestInit): Promise<unknown> {
    const fetchImpl = options.fetchImpl ?? fetch
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(url, {
        ...init,
        signal: controller.signal,
        headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...options.headers() },
      })
      if (!response.ok) throw new LearnSyncError(response.status, response.headers?.get?.("x-error-code") ?? "")
      return await response.json()
    } catch (error) {
      if (error instanceof LearnSyncError) throw error
      throw new LearnSyncError(0)
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    pull: async () => entriesFromBody(await call({ method: "GET" })),
    push: async (entries) =>
      entriesFromBody(await call({ method: "PUT", body: JSON.stringify({ songs: entries.map(entryToWire) }) })),
  }
}
