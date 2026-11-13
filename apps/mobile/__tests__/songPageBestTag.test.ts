import { describe, expect, it } from "vitest"

import { listPlayableAudio } from "@/lib/mediaEmbed"
import { buildVersions, tagFor } from "@/lib/songPage/versions"

const audio = (title: string, url: string, extra: Record<string, unknown> = {}) => ({
  kind: "audio",
  provider: "community",
  title,
  url,
  verification_status: "unverified",
  ...extra,
})

describe("'Best' tag on the song page", () => {
  it("is not given to the first recording just for being first", () => {
    const versions = buildVersions(
      [
        { title: "Voice - A", url: "https://x/a.mp3", provider: "direct_audio" },
        { title: "Voice - B", url: "https://x/b.mp3", provider: "direct_audio" },
      ],
      "",
      null,
      0,
    )
    expect(versions.map((v) => v.tag)).toEqual([null, null])
  })

  it("follows the API's is_latest flag, wherever that recording sits", () => {
    const recordings = listPlayableAudio([
      audio("Voice - A", "https://x/a.mp3"),
      audio("Voice - B", "https://x/b.mp3", { is_latest: true }),
    ])
    const versions = buildVersions(recordings, "", null, 0)
    const best = versions.filter((v) => v.tag === "Best")
    expect(best).toHaveLength(1)
    expect(best[0].url).toBe("https://x/b.mp3")
  })

  it("still tags official and community recordings, and 'Best' wins over them", () => {
    expect(tagFor("official")).toBe("Verified")
    expect(tagFor("community")).toBe("Community")
    expect(tagFor("direct_audio")).toBeNull()
    expect(tagFor("official", true)).toBe("Best")
  })
})
