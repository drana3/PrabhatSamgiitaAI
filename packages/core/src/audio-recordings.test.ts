import { describe, expect, it } from "vitest"

import {
  audioFreshnessBadge,
  compareAudioQuality,
  markLatestAudio,
  resolvePreferredAudioUrl,
} from "./audio-recordings"

describe("audio recording freshness", () => {
  const current = {
    title: "Current recording",
    url: "https://example.test/current.mp3",
    provider: "official",
    verification_status: "verified",
    source_status: "official",
  }
  const old = {
    title: "Song 1 (old version)",
    url: "https://example.test/old.mp3",
    provider: "official",
    verification_status: "verified",
    source_status: "official",
    version: "old" as const,
  }
  const lowQuality = {
    title: "Recording (low quality)",
    url: "https://example.test/low.mp3",
    provider: "official",
    verification_status: "verified",
    source_status: "official",
  }

  it("ranks current audio ahead of old and low-quality takes", () => {
    const ranked = [lowQuality, old, current].sort(compareAudioQuality)
    expect(ranked.map((item) => item.url)).toEqual([
      current.url,
      old.url,
      lowQuality.url,
    ])
  })

  it("marks the current recording as latest", () => {
    const ranked = markLatestAudio(
      [old, current, lowQuality].sort(compareAudioQuality).map((item) => ({
        ...item,
        isOlder: item === old,
        isLowQuality: item === lowQuality,
      })),
    )
    expect(ranked[0]?.isLatest).toBe(true)
    expect(ranked[0]?.url).toBe(current.url)
    expect(audioFreshnessBadge(ranked[0]!)).toBe("Best")
    expect(audioFreshnessBadge(ranked[1]!)).toBe("Older version")
    expect(audioFreshnessBadge(ranked[2]!)).toBe("Low quality")
  })

  it("keeps a current official take ahead of an old take marked primary", () => {
    const oldPrimary = { ...old, is_primary: true }
    const ranked = [oldPrimary, current].sort(compareAudioQuality)
    expect(ranked[0]?.url).toBe(current.url)
  })

  it("keeps a saved recording when it is still available", () => {
    const recordings = markLatestAudio([
      { url: current.url, isOlder: false, isLowQuality: false },
      { url: old.url, isOlder: true, isLowQuality: false },
    ])
    expect(resolvePreferredAudioUrl(recordings, old.url)).toBe(old.url)
    expect(resolvePreferredAudioUrl(recordings)).toBe(current.url)
  })
})
