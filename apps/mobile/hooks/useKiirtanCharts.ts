import { useEffect, useMemo, useState } from "react"

import { CHART, chartLines, chartQuery, type ChartDef, type ChartLine } from "@/lib/kirtan/charts"
import { topPlayedApi } from "@/lib/topPlayed/api"
import type { TopPage, TopPlayedApi } from "@/lib/topPlayed/types"
import { useKirtanStore } from "@/stores/kirtanStore"

export type ChartCardData = { chart: ChartDef; lines: ChartLine[] }

/**
 * The "Most played" card of the Kiirtan tab: asks the server for the first three places of this week's chart once; a failed or thin
 * chart gives no card (nothing to show, so nothing is drawn).
 */
export function useKiirtanCharts(api: TopPlayedApi = topPlayedApi()): ChartCardData | null {
  const [page, setPage] = useState<TopPage | null>(null)
  const blocked = useKirtanStore((s) => s.blockedAuthorIds)

  useEffect(() => {
    const controller = new AbortController()
    api
      .fetch(chartQuery(CHART.period), controller.signal)
      .then(setPage)
      .catch(() => undefined)
    return () => controller.abort()
  }, [api])

  return useMemo(() => {
    const lines = chartLines(page, blocked)
    return lines ? { chart: CHART, lines } : null
  }, [page, blocked])
}
