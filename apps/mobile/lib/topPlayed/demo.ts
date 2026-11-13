import { demoKirtanById } from "@/lib/fixtures/searchMenuDemo"
import { NetworkError } from "@/lib/kirtan/remote"
import type { TopItem, TopPage, TopPeriod, TopPlayedApi, TopQuery } from "@/lib/topPlayed/types"

/**
 * The web preview's Top Played: invented numbers that answer like the server (period, kind filter, paging, the minimum of
 * five plays). Sends nothing. The screenshot scripts can switch it with `globalThis.__topPlayedDemo.setMode(...)` or the
 * sessionStorage key "topPlayedDemo" ("ok" | "empty" | "error"), so a state survives a page load.
 */

type Row = { ref: "ps" | "rec"; id: string; kind: string; title: string; author: string; all: number; songNumber?: number }

const ROWS: readonly Row[] = [
  { ref: "ps", id: "1", songNumber: 1, kind: "prabhat_samgiita", title: "Bandhu He Niye Calo", author: "", all: 3120 },
  { ref: "rec", id: "k-bnk-morning", kind: "kiirtan", title: "Baba Nam Kevalam, morning", author: "Ananda Marga Kiirtan Group", all: 2890 },
  { ref: "ps", id: "2", songNumber: 2, kind: "prabhat_samgiita", title: "Prabhat Samgiita 2", author: "", all: 2410 },
  { ref: "rec", id: "ba-sample-1", kind: "baba_audio", title: "Baba's discourse, sample 1", author: "Shrii Shrii Anandamurti", all: 2205 },
  { ref: "rec", id: "b-sweetest-word", kind: "bhajan", title: "The sweetest word", author: "Dada Maetreya", all: 1980 },
  { ref: "ps", id: "7", songNumber: 7, kind: "prabhat_samgiita", title: "Prabhat Samgiita 7", author: "", all: 1760 },
  { ref: "rec", id: "k-bnk-night", kind: "kiirtan", title: "Baba Nam Kevalam, night", author: "Ananda Marga Kiirtan Group", all: 1544 },
  { ref: "ps", id: "12", songNumber: 12, kind: "prabhat_samgiita", title: "Prabhat Samgiita 12", author: "", all: 1390 },
  { ref: "rec", id: "k-lila-radha", kind: "kiirtan", title: "Lila kiirtan, Radha", author: "Ananda Marga Kiirtan Group", all: 1210 },
  { ref: "rec", id: "b-morning-harmonium", kind: "bhajan", title: "Morning bhajan with harmonium", author: "Dada Maetreya", all: 1105 },
  { ref: "ps", id: "25", songNumber: 25, kind: "prabhat_samgiita", title: "Prabhat Samgiita 25", author: "", all: 980 },
  { ref: "rec", id: "ba-sample-2", kind: "baba_audio", title: "Baba's discourse, sample 2", author: "Shrii Shrii Anandamurti", all: 910 },
  { ref: "rec", id: "k-bnk-evening", kind: "kiirtan", title: "Baba Nam Kevalam, evening", author: "Ananda Marga Kiirtan Group", all: 842 },
  { ref: "ps", id: "100", songNumber: 100, kind: "prabhat_samgiita", title: "Prabhat Samgiita 100", author: "", all: 770 },
  { ref: "rec", id: "b-evening-request", kind: "bhajan", title: "Evening bhajan, a request", author: "Dada Maetreya", all: 705 },
  { ref: "rec", id: "k-night-meditation", kind: "kiirtan", title: "Night kiirtan for meditation", author: "Ananda Marga Kiirtan Group", all: 640 },
  { ref: "ps", id: "300", songNumber: 300, kind: "prabhat_samgiita", title: "Prabhat Samgiita 300", author: "", all: 590 },
  { ref: "rec", id: "ba-sample-3", kind: "baba_audio", title: "Baba's discourse, sample 3", author: "Shrii Shrii Anandamurti", all: 515 },
  { ref: "rec", id: "k-dipavali", kind: "kiirtan", title: "Dipavali kiirtan", author: "Ananda Marga Kiirtan Group", all: 460 },
  { ref: "ps", id: "512", songNumber: 512, kind: "prabhat_samgiita", title: "Prabhat Samgiita 512", author: "", all: 402 },
  { ref: "rec", id: "b-festival-lamps", kind: "bhajan", title: "A bhajan for the festival of lamps", author: "Dada Maetreya", all: 351 },
  { ref: "ps", id: "1024", songNumber: 1024, kind: "prabhat_samgiita", title: "Prabhat Samgiita 1024", author: "", all: 297 },
  { ref: "rec", id: "k-purnima", kind: "kiirtan", title: "Buddha Purnima kiirtan", author: "Ananda Marga Kiirtan Group", all: 244 },
  { ref: "ps", id: "2048", songNumber: 2048, kind: "prabhat_samgiita", title: "Prabhat Samgiita 2048", author: "", all: 190 },
  { ref: "rec", id: "k-akhanda", kind: "kiirtan", title: "Akhanda kiirtan", author: "Ananda Marga Kiirtan Group", all: 143 },
  { ref: "ps", id: "3333", songNumber: 3333, kind: "prabhat_samgiita", title: "Prabhat Samgiita 3333", author: "", all: 96 },
  { ref: "rec", id: "k-bnk-sleep", kind: "kiirtan", title: "Baba Nam Kevalam for sleep", author: "Ananda Marga Kiirtan Group", all: 61 },
  { ref: "ps", id: "4500", songNumber: 4500, kind: "prabhat_samgiita", title: "Prabhat Samgiita 4500", author: "", all: 28 },
  { ref: "rec", id: "k-lila-shiva", kind: "kiirtan", title: "Lila kiirtan, Shiva", author: "Ananda Marga Kiirtan Group", all: 9 },
  { ref: "ps", id: "5000", songNumber: 5000, kind: "prabhat_samgiita", title: "Prabhat Samgiita 5000", author: "", all: 6 },
]

const MIN_PLAYS = 5
/** A share of the all-time count, by row, so the three periods rank differently (a song can rise lately). */
const SHARE_30 = [0.34, 0.12, 0.5, 0.2, 0.42, 0.08, 0.27]
const SHARE_7 = [0.09, 0.03, 0.15, 0.06, 0.12, 0.02, 0.07]

export type DemoMode = "ok" | "empty" | "error"

function playsIn(row: Row, index: number, period: TopPeriod): number {
  if (period === "all") return row.all
  const share = (period === "30d" ? SHARE_30 : SHARE_7)[index % SHARE_30.length]
  return Math.floor(row.all * share)
}

export function demoTopPage(query: TopQuery): TopPage {
  const kinds = query.kinds
  const rows = ROWS.map((row, index) => ({ row, plays: playsIn(row, index, query.period) }))
    .filter((r) => r.plays >= MIN_PLAYS && (!kinds.length || kinds.includes(r.row.kind)))
    .sort((a, b) => b.plays - a.plays || a.row.id.localeCompare(b.row.id))
  const page = rows.slice(query.offset, query.offset + query.limit)
  const items: TopItem[] = page.map(({ row, plays }, i) => {
    // a sample recording shows its own title and author, so the row matches what plays
    const sample = row.ref === "rec" ? demoKirtanById(row.id) : null
    return {
      rank: query.offset + i + 1,
      ref: row.ref,
      id: row.id,
      kind: sample?.kind ?? row.kind,
      title: sample?.title ?? row.title,
      author: sample?.author ?? row.author,
      plays,
      songNumber: row.songNumber ?? null,
      recording: null,
    }
  })
  return {
    period: query.period,
    kinds: [...kinds],
    items,
    total: rows.length,
    hasMore: query.offset + query.limit < rows.length,
    since: "2026-09-01",
    minPlays: MIN_PLAYS,
  }
}

export type DemoControl = { setMode: (mode: DemoMode) => void }

export function createDemoTopPlayedApi(): TopPlayedApi & { control: DemoControl } {
  let mode: DemoMode = "ok"
  try {
    const saved = (globalThis as { sessionStorage?: Storage }).sessionStorage?.getItem("topPlayedDemo")
    if (saved === "empty" || saved === "error" || saved === "ok") mode = saved
  } catch {
    // a broken script state must never stop the preview
  }
  return {
    control: { setMode: (next) => void (mode = next) },
    async fetch(query) {
      await new Promise((resolve) => setTimeout(resolve, 220))
      if (mode === "error") throw new NetworkError("demo offline")
      if (mode === "empty") {
        return { period: query.period, kinds: [...query.kinds], items: [], total: 0, hasMore: false, since: "2026-09-01", minPlays: MIN_PLAYS }
      }
      return demoTopPage(query)
    },
  }
}
