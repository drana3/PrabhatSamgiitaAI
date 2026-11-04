import { describe, expect, it } from "vitest"

import { fetchOEmbed, oembedFailureMessage, parseOEmbed } from "@/lib/kirtan/oembed"
import { oembedEndpoint, parseStartTime, parseYouTubeUrl, youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/kirtan/youtube"

const ID = "abcDEF12345"

describe("parseYouTubeUrl", () => {
  it("reads the five link shapes", () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}`)).toEqual({ id: ID, kind: "watch", startSeconds: null })
    expect(parseYouTubeUrl(`https://youtu.be/${ID}`)?.kind).toBe("shortlink")
    expect(parseYouTubeUrl(`https://www.youtube.com/shorts/${ID}`)?.kind).toBe("short")
    expect(parseYouTubeUrl(`https://music.youtube.com/watch?v=${ID}`)?.kind).toBe("music")
    expect(parseYouTubeUrl(`https://www.youtube.com/embed/${ID}`)?.kind).toBe("embed")
    expect(parseYouTubeUrl(`https://m.youtube.com/live/${ID}`)?.kind).toBe("live")
  })

  it("accepts a link typed without https and with extra parameters", () => {
    expect(parseYouTubeUrl(`youtube.com/watch?v=${ID}`)?.id).toBe(ID)
    expect(parseYouTubeUrl(`  https://www.youtube.com/watch?list=PL1&v=${ID}&feature=share  `)?.id).toBe(ID)
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?si=xyz`)?.id).toBe(ID)
  })

  it("reads a start time", () => {
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?t=90`)?.startSeconds).toBe(90)
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=1m30s`)?.startSeconds).toBe(90)
    expect(parseStartTime("1h2m3s")).toBe(3723)
    expect(parseStartTime("soon")).toBeNull()
    expect(parseStartTime("")).toBeNull()
  })

  it("rejects other sites, look-alike hosts and bad ids", () => {
    expect(parseYouTubeUrl(`https://vimeo.com/${ID}`)).toBeNull()
    expect(parseYouTubeUrl(`https://youtube.com.evil.com/watch?v=${ID}`)).toBeNull()
    expect(parseYouTubeUrl(`https://notyoutube.com/watch?v=${ID}`)).toBeNull()
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=short`)).toBeNull()
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}extra`)).toBeNull()
    expect(parseYouTubeUrl(`https://www.youtube.com/playlist?list=PL12345`)).toBeNull()
    expect(parseYouTubeUrl(`https://www.youtube.com/@channel`)).toBeNull()
    expect(parseYouTubeUrl(`ftp://youtu.be/${ID}`)).toBeNull()
    expect(parseYouTubeUrl("")).toBeNull()
    expect(parseYouTubeUrl("just some words")).toBeNull()
    expect(parseYouTubeUrl("javascript:alert(1)")).toBeNull()
  })

  it("builds the canonical link, the embed link and the oEmbed endpoint", () => {
    expect(youtubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(youtubeWatchUrl(ID, 90)).toBe(`https://www.youtube.com/watch?v=${ID}&t=90s`)
    const embed = youtubeEmbedUrl(ID)
    expect(embed.startsWith(`https://www.youtube.com/embed/${ID}?`)).toBe(true)
    expect(embed).toContain("enablejsapi=1")
    expect(embed).toContain("playsinline=1")
    expect(embed).toContain("rel=0")
    expect(oembedEndpoint(ID)).toBe(`https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeWatchUrl(ID))}&format=json`)
  })
})

describe("oEmbed", () => {
  it("reads title, author and an https thumbnail", () => {
    expect(parseOEmbed({ title: " Kiirtan ", author_name: "Group", thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg" })).toEqual({
      title: "Kiirtan",
      author: "Group",
      thumbnailUrl: "https://i.ytimg.com/vi/x/hqdefault.jpg",
    })
    expect(parseOEmbed({ title: "T", thumbnail_url: "http://insecure/x.jpg" })?.thumbnailUrl).toBeNull()
    expect(parseOEmbed({ author_name: "no title" })).toBeNull()
    expect(parseOEmbed(null)).toBeNull()
  })

  it("maps responses and failures without throwing", async () => {
    const ok = await fetchOEmbed(ID, async () => ({ ok: true, status: 200, json: async () => ({ title: "T", author_name: "A" }) }))
    expect(ok).toEqual({ ok: true, preview: { title: "T", author: "A", thumbnailUrl: null } })
    expect(await fetchOEmbed(ID, async () => ({ ok: false, status: 404, json: async () => ({}) }))).toEqual({ ok: false, reason: "not_found" })
    expect(await fetchOEmbed(ID, async () => ({ ok: false, status: 400, json: async () => ({}) }))).toEqual({ ok: false, reason: "not_found" })
    expect(await fetchOEmbed(ID, async () => ({ ok: false, status: 401, json: async () => ({}) }))).toEqual({ ok: false, reason: "not_embeddable" })
    expect(await fetchOEmbed(ID, async () => ({ ok: false, status: 500, json: async () => ({}) }))).toEqual({ ok: false, reason: "unreachable" })
    expect(await fetchOEmbed(ID, async () => ({ ok: true, status: 200, json: async () => ({ nope: 1 }) }))).toEqual({ ok: false, reason: "bad_response" })
    // CORS failure and offline both surface as a TypeError from fetch
    expect(
      await fetchOEmbed(ID, async () => {
        throw new TypeError("Failed to fetch")
      }),
    ).toEqual({ ok: false, reason: "unreachable" })
    expect(oembedFailureMessage("unreachable")).toMatch(/Type the title/)
  })

  it("asks the canonical endpoint", async () => {
    let asked = ""
    await fetchOEmbed(ID, async (url) => {
      asked = url
      return { ok: false, status: 404, json: async () => ({}) }
    })
    expect(asked).toBe(oembedEndpoint(ID))
  })
})

import { commandMessage, embedErrorText, embedStateFromNumber, LISTEN_MESSAGE, parseEmbedMessage } from "@/lib/kirtan/iframeApi"

describe("IFrame player messages", () => {
  it("reads state and time from the player", () => {
    expect(parseEmbedMessage(JSON.stringify({ event: "onStateChange", info: 1 }))).toEqual({ type: "state", state: "playing" })
    expect(parseEmbedMessage({ event: "onStateChange", info: 0 })).toEqual({ type: "state", state: "ended" })
    expect(parseEmbedMessage({ event: "infoDelivery", info: { currentTime: 12.5, duration: 760, playerState: 2 } })).toEqual({
      type: "time",
      current: 12.5,
      duration: 760,
      state: "paused",
    })
    expect(parseEmbedMessage({ event: "initialDelivery", info: { currentTime: 0, duration: 0 } })).toEqual({ type: "time", current: 0, duration: null, state: null })
    expect(parseEmbedMessage({ event: "infoDelivery", info: { playerState: 3 } })).toEqual({ type: "state", state: "buffering" })
    expect(parseEmbedMessage({ event: "onError", info: 150 })).toEqual({ type: "error", code: 150 })
    expect(parseEmbedMessage({ event: "onReady" })).toEqual({ type: "ready" })
  })

  it("ignores anything else", () => {
    expect(parseEmbedMessage("not json")).toBeNull()
    expect(parseEmbedMessage(42)).toBeNull()
    expect(parseEmbedMessage({ event: "somethingNew" })).toBeNull()
    expect(parseEmbedMessage({ event: "onStateChange", info: 99 })).toBeNull()
    expect(embedStateFromNumber(-1)).toBe("unstarted")
    expect(embedStateFromNumber("1")).toBeNull()
  })

  it("builds the listening and command messages", () => {
    expect(JSON.parse(LISTEN_MESSAGE)).toEqual({ event: "listening", id: 1, channel: "widget" })
    expect(JSON.parse(commandMessage({ func: "playVideo" }))).toEqual({ event: "command", func: "playVideo", args: [] })
    expect(JSON.parse(commandMessage({ func: "seekTo", seconds: -4 }))).toEqual({ event: "command", func: "seekTo", args: [0, true] })
    expect(embedErrorText(150)).toMatch(/does not allow/)
  })
})
