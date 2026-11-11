import { useEffect, useMemo, useState } from "react"

import { CHARTS, chartLines, chartQuery, type ChartDef, type ChartLine } from "@/lib/kirtan/charts"
import { topPlayedApi } from "@/lib/topPlayed/api"
import type { TopPage, TopPlayedApi } from "@/lib/topPlayed/types"
import { useKirtanStore } from "@/stores/kirtanStore"

export type ChartCardData = { chart: ChartDef; lines: ChartLine[] }

/**
 * The cards of "Charts" on the Kiirtan tab: asks the server for the first three places of each chart once; a failed or thin
 * chart gives no card (nothing to show, so nothing is drawn).
 */
export function useKiirtanCharts(api: TopPlayedApi = topPlayedApi()): ChartCardData[] {
  const [pages, setPages] = useState<Record<string, TopPage | null>>({})
  const blocked = useKirtanStore((s) => s.blockedAuthorIds)

  useEffect(() => {
    const controller = new AbortController()
    CHARTS.forEach((chart) => {
      api
        .fetch(chartQuery(chart.period), controller.signal)
        .then((page) => setPages((prev) => ({ ...prev, [chart.id]: page })))
        .catch(() => undefined)
    })
    return () => controller.abort()
  }, [api])

  return useMemo(
    () =>
      CHARTS.flatMap((chart) => {
        const lines = chartLines(pages[chart.id] ?? null, blocked)
        return lines ? [{ chart, lines }] : []
      }),
    [pages, blocked],
  )
}
