import { HUB_KINDS } from "@/lib/kirtan/hub"
import { visibleTop } from "@/lib/topPlayed/model"
import type { TopPage, TopPeriod, TopQuery } from "@/lib/topPlayed/types"

/**
 * The "Most played" card of the Kiirtan tab (Dada, 10 Nov 2026, board option B2; one card since 12 Nov 2026): a second door into the Top
 * Played screen. It shows this week's chart (7 days), counted over what the Kiirtan page holds (its six kinds; Prabhat Samgiita is not
 * on this page); the card names places 1, 2 and 3 only, and the screen it opens has the switch Week / Month / All time (the server
 * already answers 7d, 30d and all). A chart with fewer than five rows is not drawn at all (one person must not make a top alone). Pure.
 */

export type ChartId = "week"
export type ChartDef = { id: ChartId; period: TopPeriod }

/** The one chart of the card. */
export const CHART: ChartDef = { id: "week", period: "7d" }

/** A chart is drawn only with at least this many rows. */
export const CHART_MIN_ROWS = 5
/** The card names this many places. */
export const CHART_PLACES = 3

/** The server question behind a card: the page's kinds, the period, the first three places. */
export function chartQuery(period: TopPeriod): TopQuery {
  return { period, kinds: [...HUB_KINDS], limit: CHART_PLACES, offset: 0 }
}

export type ChartLine = { rank: number; title: string }

/** What a card shows: the page after the person's blocked authors are left out. `null` = hide the card. */
export function chartLines(page: Pick<TopPage, "items" | "total"> | null, blockedAuthorIds: readonly string[] = []): ChartLine[] | null {
  if (!page) return null
  const view = visibleTop(page, blockedAuthorIds)
  if (view.total < CHART_MIN_ROWS || view.items.length < CHART_PLACES) return null
  return view.items.slice(0, CHART_PLACES).map((i) => ({ rank: i.rank, title: i.title }))
}

/** The Top Played screen with the period set and the Kiirtan page's kinds as its scope. */
export function chartHref(period: TopPeriod): string {
  return `/top-played?period=${period}&scope=kiirtan`
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ""
}

/** The Top Played screen's link parameters: an unknown word means "no preset". */
export function parseTopParams(params: { period?: string | string[]; scope?: string | string[] }): { period: TopPeriod | undefined; scope: readonly string[] } {
  const period = first(params.period)
  return {
    period: period === "7d" || period === "30d" || period === "all" ? period : undefined,
    scope: first(params.scope) === "kiirtan" ? HUB_KINDS : [],
  }
}
