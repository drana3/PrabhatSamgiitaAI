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
    expect(parseOEmbed({ title: " Kirtan ", author_name: "Group", thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg" })).toEqual({
      title: "Kirtan",
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
