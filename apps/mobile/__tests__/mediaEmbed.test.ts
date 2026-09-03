import { describe, expect, it } from "vitest"

import {
  audioRecordingLabel,
  extractYoutubeId,
  listPlayableAudio,
  mediaVideosToEmbeds,
  pickPreferredAudioUrl,
  toInAppVideoEmbedUrl,
} from "@/lib/mediaEmbed"
import { songDetailToMockSong, songSummaryToMockSong } from "@/lib/songMap"
import type { SongDetail } from "@prabhat/core"

describe("in-app media embeds", () => {
  it("converts YouTube watch URLs to in-app embeds with origin", () => {
    expect(extractYoutubeId("https://www.youtube.com/watch?v=D4LHhnSLhro")).toBe("D4LHhnSLhro")
    const embed = toInAppVideoEmbedUrl("https://www.youtube.com/watch?v=D4LHhnSLhro")
    expect(embed).toContain("https://www.youtube.com/embed/D4LHhnSLhro")
    expect(embed).toContain("origin=")
    expect(embed).toContain("playsinline=1")
  })

  it("rejects YouTube search redirects", () => {
    expect(
      toInAppVideoEmbedUrl("https://www.youtube.com/results?search_query=Prabhat+Samgiita+1"),
    ).toBeNull()
  })

  it("keeps official embeds", () => {
    expect(toInAppVideoEmbedUrl("https://www.youtube-nocookie.com/embed/D4LHhnSLhro")).toContain(
      "/embed/D4LHhnSLhro",
    )
    expect(toInAppVideoEmbedUrl("https://www.youtube.com/embed/D4LHhnSLhro")).toContain(
      "youtube.com/embed/D4LHhnSLhro",
    )
  })

  it("prefers verified official audio", () => {
    const url = pickPreferredAudioUrl([
      {
        kind: "audio",
        provider: "external_site",
        title: "alt",
        url: "https://example.test/alt.mp3",
        verification_status: "unverified",
      },
      {
        kind: "audio",
        provider: "official",
        title: "main",
        url: "https://prabhatasamgiita.net/song.mp3",
        verification_status: "verified",
      },
    ])
    expect(url).toContain("prabhatasamgiita.net")
  })

  it("lists extra recordings after the preferred stream", () => {
    const recordings = listPlayableAudio([
      {
        kind: "audio",
        provider: "community",
        title: "Practice take",
        url: "https://example.test/alt.mp3",
        verification_status: "unverified",
      },
      {
        kind: "audio",
        provider: "official",
        title: "Original rendition",
        url: "https://prabhatasamgiita.net/song.mp3",
        verification_status: "verified",
      },
      {
        kind: "audio",
        provider: "youtube",
        title: "Watch instead",
        url: "https://www.youtube.com/watch?v=abc1234",
        verification_status: "verified",
      },
    ])
    expect(recordings.map((item) => item.url)).toEqual([
      "https://prabhatasamgiita.net/song.mp3",
      "https://example.test/alt.mp3",
    ])
    expect(audioRecordingLabel(recordings[1]!, 1)).toBe("Practice take")
  })

  it("maps only embeddable videos from song detail", () => {
    const detail = {
      number: 1,
      title: "BANDHU HE NIYE CALO",
      canonical_source_status: "verified",
      related_songs: [],
      media: [
        {
          kind: "video",
          provider: "youtube",
          title: "Bandhu He",
          url: "https://www.youtube.com/watch?v=D4LHhnSLhro",
          embed_url: "https://www.youtube-nocookie.com/embed/D4LHhnSLhro",
          verification_status: "verified",
        },
        {
          kind: "audio",
          provider: "official",
          title: "Audio",
          url: "https://prabhatasamgiita.net/1.mp3",
          verification_status: "verified",
        },
      ],
      is_verified: true,
    } satisfies SongDetail

    const song = songDetailToMockSong(detail)
    expect(song.audioUrl).toContain("prabhatasamgiita.net")
    expect(song.audioRecordings?.map((item) => item.url)).toEqual(["https://prabhatasamgiita.net/1.mp3"])
    expect(song.videos).toHaveLength(1)
    expect(song.videos[0]?.embedUrl).toContain("youtube.com/embed/D4LHhnSLhro")
  })

  it("does not invent YouTube search videos for summaries", () => {
    const song = songSummaryToMockSong({
      number: 3,
      title: "ÁNDHÁRA SHEŚE",
      is_verified: true,
    })
    expect(song.videos).toEqual([])
    expect(song.audioUrl).toBeNull()
  })

  it("filters non-embeddable media out of video lists", () => {
    expect(
      mediaVideosToEmbeds(
        [
          {
            kind: "video",
            provider: "youtube",
            title: "search only",
            url: "https://www.youtube.com/results?search_query=ps+1",
            verification_status: "unverified",
          },
        ],
        "https://example.test/thumb.jpg",
        1,
      ),
    ).toEqual([])
  })
})
