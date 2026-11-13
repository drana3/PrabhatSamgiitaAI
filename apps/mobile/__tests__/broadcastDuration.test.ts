import { describe, expect, it } from "vitest"

import { createBroadcastsMock, broadcastMockFailure } from "@/lib/broadcasts/mock"
import { ARCHIVE_AFTER_DAYS, MAX_SPAN_DAYS, archiveAt, liveDay, parseRecordingLink, phaseNow, resolveEnd, resolveStart } from "@/lib/broadcasts/rules"
import { broadcastFromWire, recordingFromWire, type WireBroadcast } from "@/lib/broadcasts/remote"
import type { Broadcast } from "@/lib/broadcasts/types"
import { whenLine } from "@/lib/broadcasts/when"

/**
 * Broadcasts last for days (docs/broadcasts.md): an optional end, the 14-day limit with no end, the Live mark that shows the
 * whole span, and the archive counted from the real end. The same rules as apps/api services/broadcasts.py.
 */
const DAY = 86_400_000
const now = new Date(2026, 10, 9, 12, 0).getTime() // Monday 9 Nov 2026, noon, in whatever zone the test runs in
const zone = "Europe/Berlin"

function sample(over: Partial<Broadcast>): Broadcast {
  return {
    id: "b",
    provider: "zoom",
    url: "https://zoom.us/j/1",
    host: "zoom.us",
    title: "T",
    description: null,
    organizer: null,
    startsAt: null,
    timezone: null,
    endsAt: new Date(now + MAX_SPAN_DAYS * DAY).toISOString(),
    endsDeclared: false,
    liveSource: "clock",
    phase: "now",
    archived: false,
    thumbnailUrl: null,
    linkStatus: "unknown",
    status: "published",
    mine: false,
    canEnd: false,
    canRemove: false,
    createdAt: new Date(now).toISOString(),
    reportsCount: null,
    hidden: null,
    recordings: [],
    recordingAction: null,
    ...over,
  }
}

describe("the optional end of a broadcast", () => {
  it("is none when nothing is typed: the broadcast stays on until it is marked over", () => {
    expect(resolveEnd({ date: "", time: "" }, { now, zone })).toEqual({ ok: true, endsAt: null, timezone: null })
  })

  it("takes a date and a time in the phone's zone, up to 14 days after the start", () => {
    expect(resolveEnd({ date: "2026-11-18", time: "20:00" }, { now, zone, startsAt: "2026-11-10T18:30" })).toEqual({ ok: true, endsAt: "2026-11-18T20:00", timezone: zone })
    // exactly 14 days after the start is allowed, a minute more is not
    expect(resolveEnd({ date: "2026-11-24", time: "18:30" }, { now, zone, startsAt: "2026-11-10T18:30" }).ok).toBe(true)
    expect(resolveEnd({ date: "2026-11-24", time: "18:31" }, { now, zone, startsAt: "2026-11-10T18:30" })).toEqual({ ok: false, failure: "endFar" })
  })

  it("counts the 14 days from now when there is no start", () => {
    expect(resolveEnd({ date: "2026-11-23", time: "12:00" }, { now, zone }).ok).toBe(true)
    expect(resolveEnd({ date: "2026-11-24", time: "12:00" }, { now, zone })).toEqual({ ok: false, failure: "endFar" })
  })

  it("refuses half of it, nonsense, an end before the start and an end in the past", () => {
    for (const [date, time] of [["2026-11-18", ""], ["", "18:30"], ["18.11.2026", "18:30"], ["2026-02-31", "10:00"], ["2026-11-18", "25:00"]]) {
      expect(resolveEnd({ date, time }, { now, zone }), `${date} ${time}`).toEqual({ ok: false, failure: "endBad" })
    }
    expect(resolveEnd({ date: "2026-11-10", time: "18:30" }, { now, zone, startsAt: "2026-11-10T18:30" })).toEqual({ ok: false, failure: "endBeforeStart" })
    expect(resolveEnd({ date: "2026-11-09", time: "11:00" }, { now, zone })).toEqual({ ok: false, failure: "endPast" })
  })

  it("needs a zone, like the start", () => {
    expect(resolveEnd({ date: "2026-11-12", time: "10:00" }, { now, zone: null })).toEqual({ ok: false, failure: "endBad" })
  })

  it("leaves the start rules as they were", () => {
    expect(resolveStart({ date: "2026-11-10", time: "18:30" }, { now, zone })).toEqual({ ok: true, startsAt: "2026-11-10T18:30", timezone: zone })
  })
})

describe("a broadcast that runs for days stays Live", () => {
  const began = now - 3 * DAY
  const nineDays = sample({ startsAt: new Date(began).toISOString(), endsAt: new Date(began + 9 * DAY).toISOString(), endsDeclared: true })

  it("is Live on day 4 of 9, not ended after a few hours", () => {
    expect(phaseNow(nineDays, now)).toBe("now")
    expect(phaseNow(nineDays, now + 5 * DAY)).toBe("now")
    expect(phaseNow(nineDays, began + 9 * DAY)).toBe("ended")
    expect(liveDay(nineDays, now)).toEqual({ day: 4, total: 9 })
  })

  it("shows the whole span on the line under the title", () => {
    const say = (key: string, vars?: Record<string, string | number>) => `${key}|${vars?.from ?? ""}|${vars?.to ?? ""}`
    expect(whenLine(nineDays, say, "en", now)).toMatch(/^bc\.p\.span\|.+\|.+$/)
  })

  it("shows the day only (no total) when the end was not announced, from the second day", () => {
    const open = sample({ startsAt: new Date(began).toISOString(), endsAt: new Date(began + MAX_SPAN_DAYS * DAY).toISOString(), endsDeclared: false })
    expect(liveDay(open, now)).toEqual({ day: 4, total: null })
    expect(liveDay(open, began + 3_600_000)).toBeNull()
  })

  it("has no day mark for one that lasts a single day, or that is not live", () => {
    expect(liveDay(sample({ startsAt: new Date(now - 3_600_000).toISOString(), endsAt: new Date(now + 3_600_000).toISOString(), endsDeclared: true }), now)).toBeNull()
    expect(liveDay(sample({ startsAt: new Date(now + DAY).toISOString(), endsAt: new Date(now + 5 * DAY).toISOString(), endsDeclared: true }), now)).toBeNull()
  })
})

describe("with no end the broadcast ends by itself on day 14, and the archive counts from the real end", () => {
  const began = now - 13 * DAY
  const open = sample({ startsAt: new Date(began).toISOString(), endsAt: new Date(began + MAX_SPAN_DAYS * DAY).toISOString() })

  it("is still on on day 14 and ended after it", () => {
    expect(phaseNow(open, began + MAX_SPAN_DAYS * DAY - 1)).toBe("now")
    expect(phaseNow(open, began + MAX_SPAN_DAYS * DAY)).toBe("ended")
  })

  it("is archived a week after the actual end, whichever came first", () => {
    expect(archiveAt(open)).toBe(began + (MAX_SPAN_DAYS + ARCHIVE_AFTER_DAYS) * DAY)
    // "It is over" pressed early moves the end, and the archive with it
    const early = { ...open, endsAt: new Date(began + 2 * DAY).toISOString() }
    expect(archiveAt(early)).toBe(began + (2 + ARCHIVE_AFTER_DAYS) * DAY)
  })

  it("reads the new fields from the wire, with safe defaults for an older server", () => {
    const wire: WireBroadcast = {
      id: "x", provider: "zoom", url: "https://zoom.us/j/1", host: "zoom.us", title: "T", description: null, organizer: null, starts_at: null, timezone: null, ends_at: "2026-11-20T10:00:00Z", phase: "now", archived: false,
      thumbnail_url: null, link_status: "unknown", status: "published", mine: false, can_end: false, can_remove: false, created_at: "2026-11-09T10:00:00Z",
    }
    expect(broadcastFromWire(wire)).toMatchObject({ endsDeclared: false, liveSource: "clock", hidden: null, recordings: [], recordingAction: null })
    expect(broadcastFromWire({ ...wire, ends_declared: true, live_source: "youtube", recording_action: "suggest", recordings: [{ id: "r", kind: "link", url: "https://youtu.be/abc", status: "pending", source: "weird" as never, created_at: "2026-11-10T10:00:00Z" }] })).toMatchObject({ endsDeclared: true, liveSource: "youtube", recordingAction: "suggest", recordings: [{ source: "member", status: "pending", mine: false }] })
  })
})

describe("the preview backend runs broadcasts for days", () => {
  const clock = () => Date.parse("2026-11-09T12:00:00Z")

  it("has a nine-day broadcast that is Live", async () => {
    const backend = createBroadcastsMock({ now: clock })
    const live = (await backend.list("shelf")).items.find((b) => b.title.startsWith("Nine days"))
    expect(live).toMatchObject({ phase: "now", endsDeclared: true })
    expect(liveDay(live as Broadcast, clock())).toEqual({ day: 4, total: 9 })
  })

  it("gives a broadcast with no end the 14-day limit, and marks the declared end", async () => {
    const backend = createBroadcastsMock({ now: clock })
    const draft = { url: "https://us05web.zoom.us/j/99", title: "Friday satsang", description: null, organizer: null, startsAt: null, endsAt: null, timezone: null }
    const open = await backend.create(draft)
    expect(Date.parse(open.endsAt) - clock()).toBe(MAX_SPAN_DAYS * DAY)
    expect(open.endsDeclared).toBe(false)
    const declared = await backend.create({ ...draft, url: "https://us05web.zoom.us/j/100", endsAt: "2026-11-17T20:00" })
    expect(declared.endsDeclared).toBe(true)
    await expect(backend.create({ ...draft, url: "https://us05web.zoom.us/j/101", endsAt: "2026-12-20T20:00" })).rejects.toSatisfy((e) => broadcastMockFailure(e) === "endFar")
  })

  it("keeps an ended broadcast on the recent list for a week, not longer", async () => {
    let at = clock()
    const backend = createBroadcastsMock({ now: () => at })
    const made = await backend.create({ url: "https://us05web.zoom.us/j/99", title: "Friday satsang", description: null, organizer: null, startsAt: null, endsAt: null, timezone: null })
    await backend.end(made.id)
    at += 6 * DAY
    expect((await backend.list("recent")).items.map((b) => b.id)).toContain(made.id)
    at += 2 * DAY
    expect((await backend.list("recent")).items.map((b) => b.id)).not.toContain(made.id)
    // the author still has it
    expect((await backend.mine()).items.map((b) => b.id)).toContain(made.id)
  })
})

describe("the link of a recording", () => {
  it("takes a YouTube video, a Zoom cloud recording, Vimeo and archive.org", () => {
    expect(parseRecordingLink("https://www.youtube.com/watch?v=abcdefghijk")).toMatchObject({ ok: true, provider: "youtube" })
    expect(parseRecordingLink("https://us02web.zoom.us/rec/share/AbCd1234")).toMatchObject({ ok: true, provider: "zoom", host: "us02web.zoom.us" })
    expect(parseRecordingLink("https://vimeo.com/123456789")).toMatchObject({ ok: true, provider: "other", host: "vimeo.com" })
    expect(parseRecordingLink("https://archive.org/details/some-satsang")).toMatchObject({ ok: true, provider: "other", host: "archive.org" })
  })

  it("refuses the link of a Zoom meeting, any other site and every unsafe address", () => {
    expect(parseRecordingLink("https://us02web.zoom.us/j/81234567890")).toEqual({ ok: false, failure: "recordingMeeting" })
    expect(parseRecordingLink("https://example.com/video/1")).toEqual({ ok: false, failure: "recordingSite" })
    expect(parseRecordingLink("http://vimeo.com/123")).toEqual({ ok: false, failure: "notHttps" })
    expect(parseRecordingLink("https://zoom.us@evil.com/rec/x")).toEqual({ ok: false, failure: "badLink" })
    expect(parseRecordingLink("https://zoom.us.evil.com/rec/x")).toEqual({ ok: false, failure: "recordingSite" })
    expect(parseRecordingLink("https://vimeo.com.evil.com/1")).toEqual({ ok: false, failure: "recordingSite" })
    expect(parseRecordingLink("https://127.0.0.1/rec/x")).toEqual({ ok: false, failure: "notPublic" })
  })
})

describe("recordings of an ended broadcast in the preview", () => {
  const clock = () => Date.parse("2026-11-09T12:00:00Z")

  it("lets the author add a link at once and a member only suggest one", async () => {
    const backend = createBroadcastsMock({ now: clock })
    const mine = await backend.create({ url: "https://us05web.zoom.us/j/99", title: "Friday satsang", description: null, organizer: null, startsAt: null, endsAt: null, timezone: null })
    await expect(backend.addRecording(mine.id, "https://vimeo.com/1")).rejects.toSatisfy((e) => broadcastMockFailure(e) === "notEnded")
    await backend.end(mine.id)
    const added = await backend.addRecording(mine.id, "https://vimeo.com/1")
    expect(added).toMatchObject({ status: "accepted", source: "author", mine: true })
    await expect(backend.addRecording(mine.id, "https://vimeo.com/1")).rejects.toSatisfy((e) => broadcastMockFailure(e) === "recordingDuplicate")
    await expect(backend.addRecording(mine.id, "https://example.com/x")).rejects.toSatisfy((e) => broadcastMockFailure(e) === "recordingSite")
    expect((await backend.get(mine.id)).recordings.map((r) => r.id)).toContain(added.id)
    await backend.removeRecording(mine.id, added.id)
    expect((await backend.get(mine.id)).recordings).toHaveLength(0)

    const ended = (await backend.list("recent")).items.find((b) => b.title.startsWith("Sunday satsang"))
    expect(ended).toMatchObject({ phase: "ended", recordingAction: "suggest" })
    const suggested = await backend.addRecording((ended as Broadcast).id, "https://us02web.zoom.us/rec/share/Xyz")
    expect(suggested).toMatchObject({ status: "pending", source: "member" })
  })

  it("reads a recording from the wire", () => {
    expect(recordingFromWire({ id: "r1", kind: "file", recording_id: "rec-9", recording_title: "Kiirtan", status: "accepted", source: "team", mine: true, created_at: "2026-11-09T10:00:00Z" })).toMatchObject({ kind: "file", recordingId: "rec-9", recordingTitle: "Kiirtan", url: null, source: "team", mine: true })
  })
})
