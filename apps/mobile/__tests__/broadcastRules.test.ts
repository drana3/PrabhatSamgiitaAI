import { describe, expect, it } from "vitest"

import { createBroadcastsMock, broadcastMockFailure } from "@/lib/broadcasts/mock"
import { addressToOpen, cleanBroadcastText, cleanBroadcastTitle, parseBroadcastLink, phaseNow, playsInApp, resolveStart, shelfOrder } from "@/lib/broadcasts/rules"
import { broadcastFailureFromError, broadcastFromWire, type WireBroadcast } from "@/lib/broadcasts/remote"
import type { Broadcast } from "@/lib/broadcasts/types"
import { RemoteError } from "@/lib/kirtan/remote"
import { videoEmbed } from "@/lib/recordingVideos/embed"

const ok = (raw: string) => {
  const got = parseBroadcastLink(raw)
  if (!got.ok) throw new Error(`${raw}: ${got.failure}`)
  return got
}
const failure = (raw: string) => {
  const got = parseBroadcastLink(raw)
  return got.ok ? "ok" : got.failure
}

describe("broadcast links: the same rules as the server", () => {
  it("knows Zoom by its real domain, with the subdomains, and nothing that only looks like it", () => {
    expect(ok("https://us02web.zoom.us/j/81234567890?pwd=AbC#frag")).toMatchObject({ provider: "zoom", host: "us02web.zoom.us", url: "https://us02web.zoom.us/j/81234567890?pwd=AbC" })
    expect(ok("zoom.us/j/123").provider).toBe("zoom")
    expect(ok("https://example.zoomgov.com/j/1").provider).toBe("zoom")
    for (const lookalike of ["https://zoom.us.evil.com/j/1", "https://evilzoom.us/j/1", "https://zoom.us.evil.com/j/1?x=zoom.us"]) expect(ok(lookalike).provider).toBe("other")
    expect(failure("https://zoom.us@evil.com/j/1")).toBe("badLink")
  })

  it("knows Facebook and Instagram by exact host", () => {
    expect(ok("https://www.facebook.com/events/1/").provider).toBe("facebook")
    expect(ok("https://fb.watch/abc/").provider).toBe("facebook")
    expect(ok("https://www.instagram.com/someone/live/").provider).toBe("instagram")
    expect(ok("https://facebook.com.evil.org/x").provider).toBe("other")
  })

  it("rebuilds a YouTube link from the video id and refuses a channel", () => {
    const live = ok("https://www.youtube.com/live/dQw4w9WgXcQ?si=track&t=5")
    expect(live).toMatchObject({ provider: "youtube", host: "youtube.com", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })
    expect(ok("https://youtu.be/dQw4w9WgXcQ").url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    expect(failure("https://www.youtube.com/@somechannel")).toBe("channel")
    expect(failure("https://www.youtube.com/")).toBe("channel")
    expect(ok("https://youtube.com.evil.org/watch?v=dQw4w9WgXcQ").provider).toBe("other")
  })

  it("refuses anything that is not a public https address", () => {
    expect(failure("http://zoom.us/j/1")).toBe("notHttps")
    expect(failure("javascript:alert(1)")).toBe("notHttps")
    expect(failure("ftp://zoom.us/j/1")).toBe("notHttps")
    expect(failure("")).toBe("empty")
    expect(failure("https://zoom.us:8443/j/1")).toBe("badLink")
    expect(failure("https://user:pw@zoom.us/j/1")).toBe("badLink")
    expect(failure("https://zoom.us/j/1 and more")).toBe("badLink")
    for (const host of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "0x7f.1", "2130706433", "[::1]", "localhost", "printer.local", "intranet", "router.lan", "метка.рф"]) expect(failure(`https://${host}/live`), host).toBe("notPublic")
    expect(failure("https://example.org")).toBe("bareSite")
    expect(failure(`https://example.org/${"a".repeat(600)}`)).toBe("tooLong")
  })

  it("opens a stored address outside the app only when it parses back unchanged", () => {
    expect(addressToOpen("https://us02web.zoom.us/j/1?pwd=A")).toBe("https://us02web.zoom.us/j/1?pwd=A")
    expect(addressToOpen("javascript:alert(1)")).toBeNull()
    expect(addressToOpen("http://zoom.us/j/1")).toBeNull()
    expect(addressToOpen("https://zoom.us/j/1#fragment")).toBeNull()
    expect(addressToOpen("https://127.0.0.1/j/1")).toBeNull()
  })

  it("plays only YouTube inside the app, through the existing embed", () => {
    expect(playsInApp("youtube")).toBe(true)
    for (const provider of ["zoom", "facebook", "instagram", "other"] as const) expect(playsInApp(provider)).toBe(false)
    const embed = videoEmbed({ provider: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", linkStatus: "ok" })
    expect(embed?.src.startsWith("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(true)
    expect(videoEmbed({ provider: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", linkStatus: "no_embed" })).toBeNull()
  })
})

describe("broadcast texts", () => {
  it("wants a Latin title of 3 to 120 characters without a link", () => {
    expect(cleanBroadcastTitle("  Evening   Kiirtan  ")).toEqual({ ok: true, title: "Evening Kiirtan" })
    expect(cleanBroadcastTitle("ab")).toEqual({ ok: false, failure: "titleShort" })
    expect(cleanBroadcastTitle("x".repeat(121))).toEqual({ ok: false, failure: "titleLong" })
    expect(cleanBroadcastTitle("Вечерний киртан")).toEqual({ ok: false, failure: "titleLatin" })
    expect(cleanBroadcastTitle("Kiirtan, see https://zoom.us/j/123")).toEqual({ ok: false, failure: "titleLink" })
    expect(cleanBroadcastTitle("Satsang with Dada 2026").ok).toBe(true)
  })

  it("keeps a description or an organizer in any language but without a link", () => {
    expect(cleanBroadcastText("   ", 100)).toEqual({ ok: true, text: null })
    expect(cleanBroadcastText("Вечер с  друзьями", 100)).toEqual({ ok: true, text: "Вечер с друзьями" })
    expect(cleanBroadcastText("write to https://evil.example", 100)).toEqual({ ok: false, failure: "textLink" })
    expect(cleanBroadcastText("a".repeat(101), 100)).toEqual({ ok: false, failure: "tooLong" })
  })
})

describe("the start", () => {
  const now = new Date(2026, 10, 9, 12, 0).getTime()
  const zone = "Europe/Berlin"
  it("is optional", () => {
    expect(resolveStart({ date: "", time: "" }, { now, zone })).toEqual({ ok: true, startsAt: null, timezone: null })
  })
  it("is a local date and time with the zone's name", () => {
    expect(resolveStart({ date: "2026-11-10", time: "18:30" }, { now, zone })).toEqual({ ok: true, startsAt: "2026-11-10T18:30", timezone: zone })
    expect(resolveStart({ date: "2026-11-9", time: "13:05" }, { now, zone })).toEqual({ ok: true, startsAt: "2026-11-09T13:05", timezone: zone })
  })
  it("refuses half of it, nonsense, a day that does not exist, the far past and the far future", () => {
    for (const [date, time] of [["2026-11-10", ""], ["", "18:30"], ["10.11.2026", "18:30"], ["2026-02-31", "10:00"], ["2026-11-10", "25:00"], ["2026-11-10", "1830"], ["2026-11-10", "18:3"]]) {
      expect(resolveStart({ date, time }, { now, zone }), `${date} ${time}`).toEqual({ ok: false, failure: "startBad" })
    }
    expect(resolveStart({ date: "2026-11-08", time: "12:00" }, { now, zone })).toEqual({ ok: false, failure: "startPast" })
    expect(resolveStart({ date: "2026-11-09", time: "07:00" }, { now, zone }).ok).toBe(true) // five hours ago: posted a little late
    expect(resolveStart({ date: "2028-01-01", time: "12:00" }, { now, zone })).toEqual({ ok: false, failure: "startFar" })
  })
  it("needs a zone", () => {
    expect(resolveStart({ date: "2026-11-10", time: "10:00" }, { now, zone: null })).toEqual({ ok: false, failure: "startBad" })
  })
})

function sample(over: Partial<Broadcast>): Broadcast {
  return { id: "b", provider: "zoom", url: "https://zoom.us/j/1", host: "zoom.us", title: "T", description: null, organizer: null, startsAt: null, timezone: null, endsAt: "2026-11-09T20:00:00Z", endsDeclared: false, liveSource: "clock", phase: "now", archived: false, thumbnailUrl: null, linkStatus: "unknown", status: "published", mine: false, canEnd: false, canRemove: false, createdAt: "2026-11-09T10:00:00Z", reportsCount: null, hidden: null, recordings: [], recordingAction: null, ...over }
}

describe("phase and the shelf", () => {
  const at = Date.parse("2026-11-09T12:00:00Z")
  it("works the phase out from the times, not from the server's old word", () => {
    expect(phaseNow(sample({ startsAt: "2026-11-09T13:00:00Z" }), at)).toBe("upcoming")
    expect(phaseNow(sample({ startsAt: "2026-11-09T11:00:00Z" }), at)).toBe("now")
    expect(phaseNow(sample({}), at)).toBe("now") // no start: live from the moment it was posted
    expect(phaseNow(sample({ endsAt: "2026-11-09T11:59:59Z" }), at)).toBe("ended")
  })
  it("lists live ones first, then the soonest upcoming, and drops ended and removed", () => {
    const list = [
      sample({ id: "later", startsAt: "2026-11-10T09:00:00Z", endsAt: "2026-11-10T15:00:00Z" }),
      sample({ id: "ended", endsAt: "2026-11-09T09:00:00Z" }),
      sample({ id: "soon", startsAt: "2026-11-09T14:00:00Z", endsAt: "2026-11-09T20:00:00Z" }),
      sample({ id: "live", startsAt: "2026-11-09T11:00:00Z" }),
      sample({ id: "gone", status: "removed" }),
    ]
    expect(shelfOrder(list, at).map((b) => b.id)).toEqual(["live", "soon", "later"])
    expect(shelfOrder([], at)).toEqual([])
  })
})

describe("the server's answers", () => {
  const wire: WireBroadcast = { id: "1", provider: "teams" as never, url: "https://x.example/a", host: "x.example", title: "T", description: null, organizer: null, starts_at: null, timezone: null, ends_at: "2026-11-09T20:00:00Z", phase: "weird" as never, archived: false, thumbnail_url: null, link_status: "odd" as never, status: "published", mine: true, can_end: true, can_remove: false, created_at: "2026-11-09T10:00:00Z" }
  it("reads an unknown provider as other, a phase it does not know as ended, a status as unknown", () => {
    expect(broadcastFromWire(wire)).toMatchObject({ provider: "other", phase: "ended", linkStatus: "unknown", reportsCount: null, mine: true })
  })
  it("turns the error codes into failures with a sentence", () => {
    const err = (status: number, code: string | null) => new RemoteError(status, "x", { code })
    expect(broadcastFailureFromError(err(422, "broadcast_bad_link"))).toBe("badLink")
    expect(broadcastFailureFromError(err(429, "broadcast_daily_limit"))).toBe("dailyLimit")
    expect(broadcastFailureFromError(err(429, "broadcast_live_limit"))).toBe("liveLimit")
    expect(broadcastFailureFromError(err(409, "broadcast_duplicate"))).toBe("duplicate")
    expect(broadcastFailureFromError(err(401, null))).toBe("signin")
    expect(broadcastFailureFromError(err(404, null))).toBe("gone")
    expect(broadcastFailureFromError(err(429, null))).toBe("slowDown")
    expect(broadcastFailureFromError(err(422, null))).toBe("refused")
    expect(broadcastFailureFromError(err(500, null))).toBe("server")
  })
})

describe("the preview backend follows the rules", () => {
  it("refuses what the real one refuses and keeps what is allowed", async () => {
    const backend = createBroadcastsMock({ now: () => Date.parse("2026-11-09T12:00:00Z") })
    const draft = { url: "https://us05web.zoom.us/j/99?pwd=x", title: "Friday satsang", description: null, organizer: null, startsAt: null, endsAt: null, timezone: null }
    await expect(backend.create({ ...draft, url: "http://zoom.us/j/1" })).rejects.toSatisfy((e) => broadcastMockFailure(e) === "notHttps")
    const made = await backend.create(draft)
    expect(made).toMatchObject({ provider: "zoom", mine: true, phase: "now" })
    await expect(backend.create(draft)).rejects.toSatisfy((e) => broadcastMockFailure(e) === "duplicate")
    expect((await backend.mine()).items.map((b) => b.id)).toEqual([made.id])
    await backend.end(made.id)
    expect((await backend.get(made.id)).phase).toBe("ended")
    expect((await backend.list("shelf")).items.some((b) => b.id === made.id)).toBe(false)
    expect((await backend.list("recent")).items.some((b) => b.id === made.id)).toBe(true)
  })
})
