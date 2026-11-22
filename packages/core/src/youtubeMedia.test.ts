import { describe, expect, it } from "vitest"

import {
  extractYoutubeVideoId,
  resolveYoutubeVideoThumbnail,
  youtubeThumbnailUrl,
} from "./youtubeMedia"

describe("youtubeMedia", () => {
  it("parses watch and embed URLs", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/watch?v=lPGpGeYfALc")).toBe("lPGpGeYfALc")
    expect(extractYoutubeVideoId("https://www.youtube-nocookie.com/embed/lPGpGeYfALc")).toBe(
      "lPGpGeYfALc",
    )
  })

  it("builds hqdefault thumbnail URLs", () => {
    expect(youtubeThumbnailUrl("lPGpGeYfALc")).toBe(
      "https://i.ytimg.com/vi/lPGpGeYfALc/hqdefault.jpg",
    )
  })

  it("resolves thumbnail for PS 671 media row shape", () => {
    const thumb = resolveYoutubeVideoThumbnail(
      {
        url: "https://www.youtube.com/watch?v=lPGpGeYfALc",
        embed_url: "https://www.youtube-nocookie.com/embed/lPGpGeYfALc",
        metadata_json: { external_id: "lPGpGeYfALc" },
      },
      "https://example.test/fallback.jpg",
    )
    expect(thumb).toBe("https://i.ytimg.com/vi/lPGpGeYfALc/hqdefault.jpg")
  })
})