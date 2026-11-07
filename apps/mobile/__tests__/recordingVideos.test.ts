import { describe, expect, it } from "vitest"

import { NetworkError, RemoteError } from "@/lib/kirtan/remote"
import { createVideosMock, VideoMockFailure } from "@/lib/recordingVideos/mock"
import { videoFailureFromError, videoFromWire, videosRemote, type WireVideo } from "@/lib/recordingVideos/remote"
import { MAX_PER_MEMBER_PER_TARGET, MAX_PER_TARGET, cleanVideoTitle, parseVideoUrl, safeToOpen, videoDraftProblem } from "@/lib/recordingVideos/rules"

import { CFG, fakeFetch, type Seen } from "./recordingExtrasHelpers"

const ID = "dQw4w9WgXcQ"
const YT = `https://www.youtube.com/watch?v=${ID}`

describe("parseVideoUrl: what is accepted", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, "youtube", YT],
    [`https://youtube.com/watch?v=${ID}&t=42s&list=PLx&utm_source=a`, "youtube", YT],
    [`https://m.youtube.com/watch?v=${ID}`, "youtube", YT],
    [`https://music.youtube.com/watch?v=${ID}`, "youtube", YT],
    [`https://youtu.be/${ID}?si=track`, "youtube", YT],
    [`https://www.youtube.com/embed/${ID}`, "youtube", YT],
    [`https://www.youtube.com/shorts/${ID}`, "youtube", YT],
    [`https://www.youtube.com/live/${ID}`, "youtube", YT],
    [`https://www.youtube-nocookie.com/embed/${ID}`, "youtube", YT],
    [`youtu.be/${ID}`, "youtube", YT],
    [`  https://youtu.be/${ID}#frag  `, "youtube", YT],
    [`https://YOUTU.BE./${ID}`, "youtube", YT],
    ["https://vimeo.com/123456789", "vimeo", "https://vimeo.com/123456789"],
    ["https://player.vimeo.com/video/123456789?h=abc", "vimeo", "https://vimeo.com/123456789"],
    ["https://vimeo.com/123456789/0123456789ab", "vimeo", "https://vimeo.com/123456789/0123456789ab"],
    ["https://vimeo.com/channels/staffpicks/123456789", "vimeo", "https://vimeo.com/123456789"],
    ["https://archive.org/details/kiirtan-1975?tab=about", "archive", "https://archive.org/details/kiirtan-1975"],
    ["https://www.archive.org/details/old_film.1980/extra", "archive", "https://archive.org/details/old_film.1980"],
  ])("%s", (raw, provider, url) => {
    const parsed = parseVideoUrl(raw)
    expect(parsed).toMatchObject({ ok: true, provider, url })
    expect(safeToOpen(url)).toBe(true)
  })
})

describe("parseVideoUrl: what is refused", () => {
  it.each([
    ["", "badLink"],
    ["   ", "badLink"],
    ["http://youtu.be/" + ID, "notHttps"],
    ["ftp://youtu.be/" + ID, "notHttps"],
    ["javascript:alert(1)", "badLink"],
    ["data:text/html,hi", "badLink"],
    ["file:///etc/passwd", "notHttps"],
    ["mailto:a@b.c", "badLink"],
    ["https://user:pw@youtube.com/watch?v=" + ID, "badLink"],
    ["https://youtube.com:8443/watch?v=" + ID, "badLink"],
    ["https://yоutube.com/watch?v=" + ID, "badLink"], // a Cyrillic "о": a look-alike host
    ["https://www.youtube.com/@somechannel", "badLink"],
    ["https://www.youtube.com/playlist?list=PLabc", "badLink"],
    ["https://www.youtube.com/results?search_query=baba", "badLink"],
    ["https://www.youtube.com/watch?v=short", "badLink"],
    ["https://www.youtube.com/watch", "badLink"],
    ["https://vimeo.com/someuser", "badLink"],
    ["https://vimeo.com/123", "badLink"],
    ["https://archive.org/search?query=baba", "badLink"],
    ["https://archive.org/details/", "badLink"],
    ["https://www.facebook.com/watch/?v=123456", "provider"],
    ["https://www.instagram.com/reel/abc", "provider"],
    ["https://bit.ly/abc", "provider"],
    ["https://evil.example/https://youtu.be/" + ID, "provider"],
    ["https://youtube.com.evil.example/watch?v=" + ID, "provider"],
    ["https://notyoutube.com/watch?v=" + ID, "provider"],
    [`https://youtu.be/${ID} extra`, "badLink"],
    [`https://youtu.be/${ID}\nhttps://evil`, "badLink"],
    ["https://" + "a".repeat(600) + ".com/x", "badLink"],
  ])("%s is %s", (raw, failure) => {
    expect(parseVideoUrl(raw)).toEqual({ ok: false, failure })
  })

  it("a stored address that is not the rebuilt one is never opened", () => {
    expect(safeToOpen("http://youtu.be/" + ID)).toBe(false)
    expect(safeToOpen(`https://youtu.be/${ID}`)).toBe(false)
    expect(safeToOpen("javascript:alert(1)")).toBe(false)
    expect(safeToOpen("https://evil.example/watch?v=" + ID)).toBe(false)
  })
})

describe("cleanVideoTitle", () => {
  it("is optional", () => {
    expect(cleanVideoTitle("")).toEqual({ ok: true, title: null })
    expect(cleanVideoTitle("  ​ ")).toEqual({ ok: true, title: null })
  })
  it("collapses spaces and drops invisible characters", () => {
    expect(cleanVideoTitle("  Baba ‮ Nam   Kevalam  ")).toEqual({ ok: true, title: "Baba Nam Kevalam" })
  })
  it("keeps 80 and refuses 81", () => {
    expect(cleanVideoTitle("a".repeat(80)).ok).toBe(true)
    expect(cleanVideoTitle("a".repeat(81))).toEqual({ ok: false, failure: "titleTooLong" })
  })
  it("refuses a link in the title", () => {
    expect(cleanVideoTitle("see https://evil.example")).toEqual({ ok: false, failure: "titleLink" })
    expect(cleanVideoTitle("see evil.com")).toEqual({ ok: false, failure: "titleLink" })
  })
  it("the draft check names the link first, then the title", () => {
    expect(videoDraftProblem({ url: "https://youtu.be/short", title: "x".repeat(99) })).toBe("badLink")
    expect(videoDraftProblem({ url: "nope", title: "" })).toBe("provider")
    expect(videoDraftProblem({ url: YT, title: "x".repeat(99) })).toBe("titleTooLong")
    expect(videoDraftProblem({ url: YT, title: "" })).toBeNull()
  })
})

const WIRE: WireVideo = {
  id: "v1",
  provider: "youtube",
  url: YT,
  title: "A title",
  created_at: "2026-11-01T10:00:00Z",
  is_anonymous: false,
  author: { name: "Ananda", avatar_url: null },
  mine: false,
  can_remove: false,
}

describe("the wire", () => {
  it("never shows an author for an anonymous link, whatever the answer carries", () => {
    expect(videoFromWire({ ...WIRE, is_anonymous: true, author: { name: "Leak", avatar_url: "x" } }).author).toBeNull()
    expect(videoFromWire(WIRE).author).toEqual({ name: "Ananda", avatarUrl: null })
  })
  it("reads and writes the right addresses for a song and for a recording", async () => {
    const seen: Seen[] = []
    const api = videosRemote(CFG(fakeFetch({ status: 200, body: { items: [WIRE], total: 1, room: 11 } }, seen)))
    expect((await api.list({ kind: "song", id: 19 })).room).toBe(11)
    await api.list({ kind: "recording", id: "ab-1" })
    expect(seen[0]?.url).toBe("https://api.example/api/v1/video-links/songs/19")
    expect(seen[1]?.url).toBe("https://api.example/api/v1/video-links/recordings/ab-1")
    expect((seen[0]?.init.headers as Record<string, string>).Authorization).toBe("Bearer test")
  })
  it("sends the pasted link and the choice of anonymity, snake_case", async () => {
    const seen: Seen[] = []
    const api = videosRemote(CFG(fakeFetch({ status: 201, body: WIRE }, seen)))
    await api.add({ kind: "recording", id: "r1" }, { url: "youtu.be/x", title: null, isAnonymous: true })
    expect(seen[0]?.init.method).toBe("POST")
    expect(JSON.parse(seen[0]?.init.body as string)).toEqual({ url: "youtu.be/x", title: null, is_anonymous: true })
  })
  it("deletes and reports", async () => {
    const seen: Seen[] = []
    await videosRemote(CFG(fakeFetch({ status: 204 }, seen))).remove("v1")
    await videosRemote(CFG(fakeFetch({ status: 201, body: { status: "received", message: "" } }, seen))).report("v1", { reason: "broken" })
    expect(seen.map((s) => `${s.init.method} ${s.url.replace("https://api.example/api/v1/video-links", "")}`)).toEqual(["DELETE /v1", "POST /v1/report"])
  })
})

describe("failureFromError", () => {
  const e = (status: number, code: string | null, message = "x") => new RemoteError(status, message, { code })
  it.each([
    [new NetworkError(), "network"],
    [e(422, "video_provider"), "provider"],
    [e(422, "video_bad_link", "Only https links are accepted."), "notHttps"],
    [e(422, "video_bad_link"), "badLink"],
    [e(409, "video_duplicate"), "duplicate"],
    [e(409, "video_team_removed"), "teamRemoved"],
    [e(409, "video_target_full"), "targetFull"],
    [e(409, "video_member_full"), "memberFull"],
    [e(429, "video_daily_limit"), "dailyLimit"],
    [e(429, null), "slowDown"],
    [e(401, null), "signin"],
    [e(404, null), "gone"],
    [e(422, null, "Keep the title to 80 characters."), "titleTooLong"],
    [e(422, null, "Leave links out of the title."), "titleLink"],
    [e(500, null), "server"],
    [new Error("boom"), "server"],
  ])("%#", (error, failure) => {
    expect(videoFailureFromError(error)).toBe(failure)
  })
})

describe("the preview backend follows the same rules", () => {
  const target = { kind: "recording", id: "r1" } as const
  const make = () => createVideosMock({ me: () => "Me" })

  it("adds, normalises and de-duplicates", async () => {
    const api = make()
    const added = await api.add(target, { url: `https://youtu.be/${ID}?t=5`, title: "  Live  ", isAnonymous: false })
    expect(added).toMatchObject({ url: YT, title: "Live", mine: true, author: { name: "Me" } })
    await expect(api.add(target, { url: YT, title: null, isAnonymous: false })).rejects.toMatchObject({ failure: "duplicate" })
  })
  it("keeps an anonymous link without an author", async () => {
    const api = make()
    const added = await api.add(target, { url: "https://vimeo.com/123456789", title: null, isAnonymous: true })
    expect(added.author).toBeNull()
  })
  it("refuses a bad link or title with the same failure as the server", async () => {
    const api = make()
    await expect(api.add(target, { url: "https://facebook.com/x", title: null, isAnonymous: false })).rejects.toMatchObject({ failure: "provider" })
    await expect(api.add(target, { url: YT, title: "x".repeat(81), isAnonymous: false })).rejects.toBeInstanceOf(VideoMockFailure)
  })
  it("stops a member at the personal cap and a target at the shared cap", async () => {
    const api = make()
    for (let i = 0; i < MAX_PER_MEMBER_PER_TARGET; i += 1) {
      await api.add(target, { url: `https://archive.org/details/film-${i}-x`, title: null, isAnonymous: false })
    }
    await expect(api.add(target, { url: "https://archive.org/details/film-9-x", title: null, isAnonymous: false })).rejects.toMatchObject({ failure: "memberFull" })
    expect(MAX_PER_TARGET).toBe(12)
  })
  it("shows the room left, the author may delete and an unknown id is gone", async () => {
    const api = make()
    const before = await api.list(target)
    const added = await api.add(target, { url: YT, title: null, isAnonymous: false })
    expect((await api.list(target)).room).toBe(before.room - 1)
    await api.remove(added.id)
    expect((await api.list(target)).total).toBe(before.total)
    await expect(api.remove("nope")).rejects.toMatchObject({ failure: "gone" })
  })
  it("answers a repeated report with already_reported", async () => {
    const api = make()
    const [first] = (await api.list(target)).items
    expect((await api.report(first?.id as string, { reason: "broken" })).status).toBe("received")
    expect((await api.report(first?.id as string, { reason: "broken" })).status).toBe("already_reported")
  })
})
