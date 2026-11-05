import { describe, expect, it } from "vitest"

import { liveFixtures } from "@/lib/fixtures/kirtanLive"
import {
  clockLabel,
  hostLine,
  liveBadge,
  liveNow,
  liveShareMessage,
  liveStatus,
  visibleLive,
  whenLabel,
  youtubeEmbedUrl,
  youtubeWatchUrl,
  type LiveItem,
} from "@/lib/kirtan/live"

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime() // 2026-11-d, local
const item = (over: Partial<LiveItem> & { id: string }): LiveItem => ({
  title: "T",
  host: "Delhi group",
  platform: "youtube",
  startsAt: at(5, 18, 30),
  durationMin: 90,
  status: "upcoming",
  ...over,
})

describe("liveStatus", () => {
  const i = item({ id: "a" })
  it("is upcoming before the start", () => expect(liveStatus(i, at(5, 18, 29))).toBe("upcoming"))
  it("is live from the start until start + duration", () => {
    expect(liveStatus(i, at(5, 18, 30))).toBe("live")
    expect(liveStatus(i, at(5, 20, 0) - 1)).toBe("live")
  })
  it("is ended after the duration", () => expect(liveStatus(i, at(5, 20, 0))).toBe("ended"))
  it("keeps a server-closed broadcast ended", () => expect(liveStatus({ ...i, status: "ended" }, at(5, 18, 40))).toBe("ended"))
})

describe("ordering", () => {
  const now = at(5, 19, 0)
  const list = [
    item({ id: "later", startsAt: at(6, 6, 0) }),
    item({ id: "soon", startsAt: at(5, 21, 0) }),
    item({ id: "done", startsAt: at(5, 10, 0) }),
    item({ id: "on", startsAt: at(5, 18, 30) }),
  ]
  it("drops ended and puts live first, then by start", () => expect(visibleLive(list, now).map((x) => x.id)).toEqual(["on", "soon", "later"]))
  it("finds the live one", () => expect(liveNow(list, now)?.id).toBe("on"))
  it("finds none when nothing is live", () => expect(liveNow(list, at(5, 12, 0))).toBeNull())
})

describe("labels", () => {
  const now = at(5, 9, 0) // 2026-11-05 is a Thursday
  it("clock has no zero before the hour", () => expect(clockLabel(at(5, 6, 0))).toBe("6:00"))
  it("Today", () => expect(whenLabel(at(5, 18, 30), now)).toBe("Today 18:30"))
  it("Tomorrow", () => expect(whenLabel(at(6, 6, 0), now)).toBe("Tomorrow 6:00"))
  it("weekday within a week", () => expect(whenLabel(at(7, 6, 0), now)).toBe("Sat 6:00"))
  it("date after a week", () => expect(whenLabel(at(14, 18, 30), now)).toBe("14 Nov 18:30"))
  it("badge is LIVE or the time", () => {
    const i = item({ id: "a" })
    expect(liveBadge(i, at(5, 18, 40))).toBe("LIVE")
    expect(liveBadge(i, now)).toBe("Today 18:30")
  })
  it("host line", () => {
    expect(hostLine({ host: "Delhi group", platform: "youtube" })).toBe("Delhi group · YouTube")
    expect(hostLine({ host: "Group D", platform: "zoom" })).toBe("Group D · Zoom")
    expect(hostLine({ host: " ", platform: "zoom" })).toBe("Zoom")
  })
})

describe("urls and share", () => {
  it("uses the official embed", () => expect(youtubeEmbedUrl("abc123")).toBe("https://www.youtube.com/embed/abc123?playsinline=1&rel=0"))
  it("has a watch link", () => expect(youtubeWatchUrl("abc123")).toBe("https://www.youtube.com/watch?v=abc123"))
  it("share text names the title, the time and the host", () => {
    const text = liveShareMessage(item({ id: "a", title: "Evening" }), at(5, 9, 0), "https://x.test")
    expect(text).toContain("Evening")
    expect(text).toContain("Today 18:30")
    expect(text).toContain("Delhi group · YouTube")
    expect(text.endsWith("https://x.test")).toBe(true)
  })
})

describe("fixtures", () => {
  it("give one live now and three upcoming", () => {
    const now = at(5, 12, 0)
    const shown = visibleLive(liveFixtures(now), now)
    expect(shown.filter((x) => liveStatus(x, now) === "live")).toHaveLength(1)
    expect(shown.filter((x) => liveStatus(x, now) === "upcoming")).toHaveLength(3)
    expect(shown[0] && liveStatus(shown[0], now)).toBe("live")
  })
  it("have an embed id or a Zoom room for each", () => {
    for (const x of liveFixtures(Date.now())) expect(x.platform === "youtube" ? Boolean(x.youtubeId) : Boolean(x.zoom)).toBe(true)
  })
})
