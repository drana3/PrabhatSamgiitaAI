import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { CHART, CHART_MIN_ROWS, chartHref, chartLines, chartQuery, parseTopParams } from "@/lib/kirtan/charts"
import { HUB_KINDS } from "@/lib/kirtan/hub"
import { demoTopPage } from "@/lib/topPlayed/demo"
import { initialTopState, queryFor, topReducer } from "@/lib/topPlayed/model"
import { topPlayedUrl } from "@/lib/topPlayed/remote"
import { TOP_PERIODS } from "@/lib/topPlayed/types"
import type { TopItem } from "@/lib/topPlayed/types"
import { kiirtanHubEn, kiirtanHubEs, kiirtanHubRu } from "@/locales/kiirtanHub"

const root = join(__dirname, "..")
const read = (p: string) => readFileSync(join(root, p), "utf8")
const item = (rank: number, over: Partial<TopItem> = {}): TopItem => ({ rank, ref: "rec", id: String(rank), kind: "kiirtan", title: `Rec ${rank}`, author: "", plays: 50 - rank, songNumber: null, recording: null, ...over })

describe("Kiirtan charts cards", () => {
  it("one card, one chart: this week (7d); month and all time are the switch of the screen it opens", () => {
    expect(CHART.period).toBe("7d")
    expect(TOP_PERIODS).toEqual(["7d", "30d", "all"])
    expect(topPlayedUrl("https://x", { ...chartQuery("30d") })).toContain("period=30d")
  })

  it("ask the server for the page's six kinds (no Prabhat Samgiita) and three places", () => {
    const q = chartQuery("7d")
    expect(q).toEqual({ period: "7d", kinds: [...HUB_KINDS], limit: 3, offset: 0 })
    expect(q.kinds).not.toContain("prabhat_samgiita")
    const url = topPlayedUrl("https://x", q)
    expect(url).toContain("period=7d")
    expect(url.match(/kind=/g)).toHaveLength(6)
  })

  it("hides a chart with fewer than five rows, shows places 1 to 3 otherwise", () => {
    expect(CHART_MIN_ROWS).toBe(5)
    expect(chartLines({ items: [item(1), item(2), item(3)], total: 4 })).toBeNull()
    expect(chartLines(null)).toBeNull()
    expect(chartLines({ items: [item(1), item(2), item(3)], total: 5 })).toEqual([
      { rank: 1, title: "Rec 1" },
      { rank: 2, title: "Rec 2" },
      { rank: 3, title: "Rec 3" },
    ])
  })

  it("a card carries only place and name, never a play count", () => {
    const lines = chartLines({ items: [item(1), item(2), item(3)], total: 9 })
    expect(lines?.every((l) => Object.keys(l).sort().join() === "rank,title")).toBe(true)
  })

  it("a blocked author leaves the chart; too few left hides it", () => {
    const rec = (n: number, author: string) => item(n, { author, recording: { author_id: author } as TopItem["recording"] })
    const items = [rec(1, "a"), rec(2, "b"), rec(3, "b"), rec(4, "c")]
    expect(chartLines({ items, total: 5 }, ["a"])).toBeNull()
  })

  it("the demo answers the Kiirtan page's kinds without Prabhat Samgiita songs", () => {
    const page = demoTopPage(chartQuery("all"))
    expect(page.items).toHaveLength(3)
    expect(page.items.every((i) => i.kind !== "prabhat_samgiita")).toBe(true)
    expect(page.total).toBeGreaterThanOrEqual(CHART_MIN_ROWS)
  })

  it("the link opens Top Played with the period and the page's scope; unknown words give no preset", () => {
    expect(chartHref("7d")).toBe("/top-played?period=7d&scope=kiirtan")
    expect(parseTopParams({ period: "7d", scope: "kiirtan" })).toEqual({ period: "7d", scope: HUB_KINDS })
    expect(parseTopParams({ period: "x", scope: "y" })).toEqual({ period: undefined, scope: [] })
    expect(parseTopParams({})).toEqual({ period: undefined, scope: [] })
  })

  it("the Top Played model keeps the scope across choices and asks the server for it", () => {
    const s0 = initialTopState("7d", "all", HUB_KINDS)
    expect(queryFor(s0).kinds).toEqual([...HUB_KINDS])
    const s1 = topReducer(s0, { type: "choose", period: "all" })
    expect(s1.scope).toEqual(HUB_KINDS)
    expect(queryFor(s1).kinds).toEqual([...HUB_KINDS])
    expect(queryFor(initialTopState()).kinds).toEqual([])
  })

  it("source: the one card sits above the category tiles, under All only, with no numbers on it", () => {
    const tab = read("app/kiirtan.tsx")
    expect(tab.indexOf("<MostPlayedCard")).toBeGreaterThan(0)
    expect(tab.indexOf("<MostPlayedCard")).toBeLessThan(tab.indexOf("<KindCards"))
    expect(tab).toContain('kind === "all" && chartCard ?')
    expect(tab).not.toContain("<ChartCards")
    const card = read("components/kirtan/hub/MostPlayedCard.tsx")
    expect(card).not.toMatch(/\.plays|top\.plays|formatCount/)
  })

  it("the screen has the switch Week, Month, All time in that order, round, and is titled Most played when opened from the card", () => {
    const parts = read("components/topPlayed/TopPlayedParts.tsx")
    expect(parts).toContain('accessibilityRole="radiogroup"')
    expect(parts).toContain("TOP_PERIODS.map")
    const screen = read("app/top-played.tsx")
    expect(screen).toContain('scoped ? t("kh.chart.title") : t("top.title")')
    expect(kiirtanHubEn["kh.chart.title"]).toBe("Most played")
  })

  it("words in en, ru and es", () => {
    for (const key of ["kh.chart.title", "kh.chart.sub", "kh.chart.a11y", "kh.chart.scope", "kh.cat.title"] as const) {
      expect(kiirtanHubEn[key]).toBeTruthy()
      expect(kiirtanHubRu[key]).toBeTruthy()
      expect(kiirtanHubEs[key]).toBeTruthy()
    }
  })
})
