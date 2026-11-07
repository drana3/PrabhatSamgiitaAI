import { NetworkError, RemoteError, type RemoteConfig, type RemoteRecording } from "@/lib/kirtan/remote"
import type { TopItem, TopPage, TopPeriod, TopPlayedApi, TopQuery } from "@/lib/topPlayed/types"

/**
 * The phone's side of `GET /api/v1/top-played` (public, cached for five minutes by the server). Plain `fetch`; the base
 * URL and `fetch` come in through the config, so tests use a fake server. The real wiring is lib/topPlayed/api.ts.
 */

type WireItem = {
  rank: number
  ref: "ps" | "rec"
  id: string
  kind: string
  title: string
  author: string
  plays: number
  song_number?: number | null
  recording?: RemoteRecording | null
}

type WirePage = {
  period: TopPeriod
  kinds: string[]
  items: WireItem[]
  total: number
  has_more: boolean
  since: string | null
  min_plays: number
}

export function topPlayedUrl(baseUrl: string, query: TopQuery): string {
  const params: string[] = [`period=${encodeURIComponent(query.period)}`]
  for (const kind of query.kinds) params.push(`kind=${encodeURIComponent(kind)}`)
  params.push(`limit=${query.limit}`, `offset=${query.offset}`)
  return `${baseUrl.replace(/\/+$/, "")}/api/v1/top-played?${params.join("&")}`
}

function fromWire(page: WirePage): TopPage {
  const items: TopItem[] = (page.items ?? []).map((i) => ({
    rank: i.rank,
    ref: i.ref,
    id: String(i.id),
    kind: i.kind,
    title: i.title,
    author: i.author ?? "",
    plays: i.plays,
    songNumber: i.song_number ?? null,
    recording: i.recording ?? null,
  }))
  return {
    period: page.period,
    kinds: page.kinds ?? [],
    items,
    total: page.total ?? items.length,
    hasMore: Boolean(page.has_more),
    since: page.since ?? null,
    minPlays: page.min_plays ?? 0,
  }
}

export function createTopPlayedApi(cfg: RemoteConfig): TopPlayedApi {
  return {
    async fetch(query, signal) {
      let response: Response
      try {
        response = await (cfg.fetch ?? fetch)(topPlayedUrl(cfg.baseUrl, query), {
          method: "GET",
          headers: { Accept: "application/json" },
          signal,
        })
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error
        throw new NetworkError(error instanceof Error ? error.message : undefined)
      }
      if (!response.ok) {
        throw new RemoteError(response.status, `Request failed (${response.status})`, {
          code: response.status === 429 ? "rate_limited" : null,
        })
      }
      return fromWire((await response.json()) as WirePage)
    },
  }
}
