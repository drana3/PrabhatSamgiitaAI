import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { previewFromWire, videoFromWire, type WireVideo } from "@/lib/recordingVideos/remote"
import {
  BAD_SOURCE_FOR_MS,
  createSourceMemory,
  isKnownBad,
  isStubPicture,
  providerMark,
  rememberBad,
  rememberGood,
  retryDelay,
  safeThumbnailUrl,
  sourcesToTry,
  subjectFromUrl,
  thumbNext,
  thumbStart,
  thumbnailById,
  thumbnailSources,
  thumbnailSourcesForText,
} from "@/lib/recordingVideos/thumbnail"
import { createVideosMock } from "@/lib/recordingVideos/mock"

const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8")
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
const VIMEO = "https://vimeo.com/76979871"
const ARCHIVE = "https://archive.org/details/some-kiirtan_1975"

describe("a picture address is only ever one of the sites' own image hosts", () => {
  it("YouTube: i.ytimg.com over https, nothing else", () => {
    expect(safeThumbnailUrl("youtube", "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg")
    for (const bad of [
      "http://i.ytimg.com/vi/x/mqdefault.jpg",
      "https://i.ytimg.com.evil.com/vi/x/mqdefault.jpg",
      "https://evil-i.ytimg.com/vi/x/mqdefault.jpg",
      "https://i.ytimg.com@evil.com/vi/x/mqdefault.jpg",
      "https://user:pw@i.ytimg.com/vi/x/mqdefault.jpg",
      "https://i.ytimg.com:8443/vi/x/mqdefault.jpg",
      "https://img.youtube.com/vi/x/0.jpg",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "//i.ytimg.com/vi/x/mqdefault.jpg",
      "",
      null,
      42,
    ]) {
      expect(safeThumbnailUrl("youtube", bad)).toBeNull()
    }
  })

  it("Vimeo: i.vimeocdn.com only, and the query is dropped", () => {
    expect(safeThumbnailUrl("vimeo", "https://i.vimeocdn.com/video/1234_640.jpg?mw=100&q=1#x")).toBe("https://i.vimeocdn.com/video/1234_640.jpg")
    expect(safeThumbnailUrl("vimeo", "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg")).toBeNull()
    expect(safeThumbnailUrl("vimeo", "https://vimeocdn.com.evil.com/video/1.jpg")).toBeNull()
    expect(safeThumbnailUrl("vimeo", "https://i.vimeocdn.com/video/../../etc.jpg")).toBeNull()
  })

  it("Archive: archive.org only", () => {
    expect(safeThumbnailUrl("archive", "https://archive.org/services/img/some-kiirtan_1975")).toBe("https://archive.org/services/img/some-kiirtan_1975")
    expect(safeThumbnailUrl("archive", "https://archive.org.evil.com/services/img/x")).toBeNull()
    expect(safeThumbnailUrl("archive", "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg")).toBeNull()
  })
})

describe("the picture of each provider", () => {
  it("YouTube: built from the id (mqdefault: 16:9, exists for every public video; never maxresdefault)", () => {
    expect(thumbnailById("youtube", "dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg")
    expect(thumbnailById("youtube", "short")).toBeNull()
    expect(thumbnailSources({ provider: "youtube", url: YT })).toEqual(["https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg"])
    expect(thumbnailSources({ provider: "youtube", url: YT }).join()).not.toContain("maxres")
  })

  it("Vimeo: no address by id, so only the picture the server kept; none kept means none (the placeholder is shown)", () => {
    expect(thumbnailById("vimeo", "76979871")).toBeNull()
    expect(thumbnailSources({ provider: "vimeo", url: VIMEO })).toEqual([])
    expect(thumbnailSources({ provider: "vimeo", url: VIMEO, thumbnailUrl: "https://i.vimeocdn.com/video/1234_640.jpg" })).toEqual(["https://i.vimeocdn.com/video/1234_640.jpg"])
    expect(thumbnailSources({ provider: "vimeo", url: VIMEO, thumbnailUrl: "https://evil.example/x.jpg" })).toEqual([])
  })

  it("Internet Archive: its own services/img picture", () => {
    expect(thumbnailById("archive", "some-kiirtan_1975")).toBe("https://archive.org/services/img/some-kiirtan_1975")
    expect(thumbnailSources({ provider: "archive", url: ARCHIVE })).toEqual(["https://archive.org/services/img/some-kiirtan_1975"])
  })

  it("the kept picture comes first, the one built from the id second, never twice", () => {
    const kept = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    expect(thumbnailSources({ provider: "youtube", url: YT, thumbnailUrl: kept })).toEqual([kept, "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg"])
    const same = "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg"
    expect(thumbnailSources({ provider: "youtube", url: YT, thumbnailUrl: same })).toEqual([same])
  })

  it("a stored address that does not parse, or names another site than the row says, gets no built picture", () => {
    expect(thumbnailSources({ provider: "youtube", url: "https://evil.example/watch?v=dQw4w9WgXcQ" })).toEqual([])
    expect(thumbnailSources({ provider: "vimeo", url: YT })).toEqual([])
  })

  it("a link being typed (the upload form) gets what the phone can build, nothing else", () => {
    expect(thumbnailSourcesForText("youtu.be/dQw4w9WgXcQ?t=5")).toEqual(["https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg"])
    expect(thumbnailSourcesForText("https://vimeo.com/76979871")).toEqual([])
    expect(thumbnailSourcesForText("https://archive.org/details/some-kiirtan_1975")).toHaveLength(1)
    expect(thumbnailSourcesForText("http://youtube.com/watch?v=dQw4w9WgXcQ")).toEqual([])
    expect(thumbnailSourcesForText("https://evil.example/x")).toEqual([])
    expect(thumbnailSourcesForText("not a link")).toEqual([])
  })

  it("a plain link of a curated PS video gives its provider and address", () => {
    expect(subjectFromUrl(YT)).toEqual({ provider: "youtube", url: YT, thumbnailUrl: null })
    expect(subjectFromUrl("https://example.com/v")).toBeNull()
  })

  it("the placeholder names the site", () => {
    expect([providerMark("youtube"), providerMark("vimeo"), providerMark("archive")]).toEqual(["YouTube", "Vimeo", "Internet Archive"])
  })
})

describe("YouTube's grey stand-in is not a picture", () => {
  it("120x90 or smaller counts as missing; a real thumbnail and an unknown size do not", () => {
    expect(isStubPicture(120, 90)).toBe(true)
    expect(isStubPicture(64, 48)).toBe(true)
    expect(isStubPicture(320, 180)).toBe(false)
    expect(isStubPicture(480, 360)).toBe(false)
    expect(isStubPicture(undefined, undefined)).toBe(false)
    expect(isStubPicture(0, 0)).toBe(false)
  })
})

describe("the loader: sources, retries, memory", () => {
  it("a failed source moves on to the next at once; the last one failing starts the waiting", () => {
    let s = thumbNext(thumbStart, "failed", 2)
    expect(s).toEqual({ index: 1, attempt: 0, phase: "loading" })
    s = thumbNext(s, "failed", 2)
    expect(s).toEqual({ index: 1, attempt: 1, phase: "waiting" })
    s = thumbNext(s, "retry", 2)
    expect(s).toEqual({ index: 0, attempt: 1, phase: "loading" })
    s = thumbNext(s, "loaded", 2)
    expect(s.phase).toBe("ready")
  })

  it("three automatic tries (1.5 s, 4 s, 9 s), then it stops and waits for a tap; a tap starts over", () => {
    expect([retryDelay(1), retryDelay(2), retryDelay(3), retryDelay(4), retryDelay(0)]).toEqual([1500, 4000, 9000, null, null])
    let s = thumbStart
    for (let i = 0; i < 3; i += 1) {
      s = thumbNext(s, "failed", 1)
      expect(s.phase).toBe("waiting")
      s = thumbNext(s, "retry", 1)
    }
    s = thumbNext(s, "failed", 1)
    expect(s).toMatchObject({ attempt: 4, phase: "failed" })
    expect(thumbNext(s, "again", 1)).toEqual(thumbStart)
    expect(thumbNext(s, "retry", 1).phase).toBe("loading") // the app came back to the front
  })

  it("a late failure after the picture showed changes nothing; a retry while loading changes nothing", () => {
    const ready = thumbNext(thumbStart, "loaded", 1)
    expect(thumbNext(ready, "failed", 1)).toBe(ready)
    expect(thumbNext(thumbStart, "retry", 1)).toBe(thumbStart)
  })

  it("nothing to load (a Vimeo link without a kept picture) is a stable placeholder, not a wait", () => {
    expect(thumbNext(thumbStart, "failed", 0).phase).toBe("failed")
  })

  it("a bad source is skipped for a minute, a good one is trusted, and a list never ends up empty", () => {
    const memory = createSourceMemory()
    const a = "https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg"
    const b = "https://archive.org/services/img/b-item"
    rememberBad(memory, a, 1000)
    expect(isKnownBad(memory, a, 1000 + BAD_SOURCE_FOR_MS - 1)).toBe(true)
    expect(sourcesToTry(memory, [a, b], 2000)).toEqual([b])
    expect(isKnownBad(memory, a, 1000 + BAD_SOURCE_FOR_MS)).toBe(false)
    rememberBad(memory, a, 5000)
    rememberBad(memory, b, 5000)
    expect(sourcesToTry(memory, [a, b], 6000)).toEqual([a, b]) // all bad: try them all, so something may show
    rememberGood(memory, a)
    expect(isKnownBad(memory, a, 6000)).toBe(false)
  })
})

describe("the wire and the backends carry the picture", () => {
  const wire = (over: Partial<WireVideo> = {}): WireVideo => ({
    id: "v1",
    provider: "youtube",
    url: YT,
    title: null,
    created_at: "2026-11-09T10:00:00Z",
    is_anonymous: false,
    author: null,
    mine: false,
    can_remove: false,
    ...over,
  })

  it("a stored link keeps a safe picture and drops an unsafe or missing one", () => {
    expect(videoFromWire(wire({ thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg" })).thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg")
    expect(videoFromWire(wire({ thumbnail_url: "https://evil.example/x.jpg" })).thumbnailUrl).toBeNull()
    expect(videoFromWire(wire()).thumbnailUrl).toBeNull() // an older server
    expect(videoFromWire(wire({ provider: "vimeo", url: VIMEO, thumbnail_url: "https://i.vimeocdn.com/video/9_640.jpg" })).thumbnailUrl).toBe("https://i.vimeocdn.com/video/9_640.jpg")
  })

  it("the preview of a typed link is filtered the same way", () => {
    const answer = previewFromWire({ provider: "vimeo", url: VIMEO, title: "A talk", thumbnail_url: "https://i.vimeocdn.com/video/9_640.jpg", link_status: "ok" })
    expect(answer).toEqual({ provider: "vimeo", url: VIMEO, title: "A talk", thumbnailUrl: "https://i.vimeocdn.com/video/9_640.jpg", linkStatus: "ok" })
    expect(previewFromWire({ provider: "vimeo", url: VIMEO, title: null, thumbnail_url: "https://evil.example/x.jpg" }).thumbnailUrl).toBeNull()
  })

  it("the preview backend of the web mock builds the picture from the id and refuses a bad link", async () => {
    const mock = createVideosMock({ me: () => "You" })
    expect((await mock.preview(YT)).thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg")
    expect((await mock.preview(VIMEO)).thumbnailUrl).toBeNull()
    await expect(mock.preview("https://evil.example/x")).rejects.toBeTruthy()
  })
})

describe("every place that shows a video picture uses the one loader", () => {
  it("Kiirtan Video tab: the headline block and each row", () => {
    expect(read("components/recording-extras/VideoBlock.tsx")).toContain("<VideoThumb")
    expect(read("components/recording-extras/VideosSection.tsx")).toContain("<VideoThumb")
  })
  it("the upload form and the Add a video sheet show the preview", () => {
    expect(read("components/kirtan/add/VideoLinkField.tsx")).toContain("<VideoLinkPreview")
    expect(read("components/recording-extras/AddVideoSheet.tsx")).toContain("<VideoLinkPreview")
  })
  it("a broadcast tile keeps its safe-host check and loads through the loader", () => {
    const card = read("components/broadcasts/BroadcastCard.tsx")
    expect(card).toContain("safeThumbnail(item.thumbnailUrl)")
    expect(card).toContain("<VideoThumb")
  })
  it("the PS song page video card (the team's) shows the real thumbnail, with its old picture as the placeholder", () => {
    const card = read("components/player/WatchVideoCard.tsx")
    expect(card).toContain("<VideoThumb")
    expect(card).toContain("video.thumbnailUrl")
  })
  it("the loader keeps a fixed 16:9 box, only fades opacity, and respects reduced motion", () => {
    const thumb = read("components/video/VideoThumb.tsx")
    expect(thumb).toContain("aspectRatio: THUMBNAIL_ASPECT")
    expect(thumb).toContain("useReducedMotion")
    expect(thumb).toContain('cachePolicy="memory-disk"')
    expect(thumb).toContain("isStubPicture")
    expect(thumb).not.toMatch(/translate|scale\s*:|width:\s*withTiming/)
  })
  it("the preview look in the form is debounced and fails quietly", () => {
    const preview = read("components/video/VideoLinkPreview.tsx")
    expect(preview).toContain("PREVIEW_DEBOUNCE_MS")
    expect(preview).toContain(".catch(")
  })
})
