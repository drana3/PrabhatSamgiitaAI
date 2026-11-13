import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { pageTags } from "@/lib/kirtan/pageTags"
import { audioStartedUnderVideo, embedMayLoad, featuredVideo, playerSrc, videoEmbed, watchHow } from "@/lib/recordingVideos/embed"
import { linkTarget, offersVideoLink, videoLinkProblem, videoLinkToSend } from "@/lib/recordingVideos/uploadLink"
import type { VideoLink } from "@/lib/recordingVideos/types"

const read = (file: string) => readFileSync(join(__dirname, "..", file), "utf8")

type V = Pick<VideoLink, "provider" | "url" | "linkStatus">
const yt = (id: string, linkStatus: VideoLink["linkStatus"] = "ok"): V => ({ provider: "youtube", url: `https://www.youtube.com/watch?v=${id}`, linkStatus })

describe("watching a link inside the app", () => {
  it("plays YouTube, Vimeo and the Internet Archive by their own embed", () => {
    expect(videoEmbed(yt("dQw4w9WgXcQ"))?.src).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&modestbranding=1")
    expect(videoEmbed({ provider: "vimeo", url: "https://vimeo.com/76979871", linkStatus: "ok" })?.src).toContain("https://player.vimeo.com/video/76979871?")
    expect(videoEmbed({ provider: "vimeo", url: "https://vimeo.com/76979871/abcdef0123", linkStatus: "unknown" })?.src).toContain("&h=abcdef0123")
    expect(videoEmbed({ provider: "archive", url: "https://archive.org/details/some-id", linkStatus: "ok" })?.src).toBe("https://archive.org/embed/some-id")
  })

  it("has no embed for a link its owner does not let other apps show: Open on the site only", () => {
    const v = yt("dQw4w9WgXcQ", "no_embed")
    expect(videoEmbed(v)).toBeNull()
    expect(watchHow(v)).toBe("open")
    expect(watchHow(yt("dQw4w9WgXcQ"))).toBe("in-app")
  })

  it("never trusts a stored address: one that does not parse, or names another provider, has no embed", () => {
    expect(videoEmbed({ provider: "youtube", url: "https://evil.example/watch?v=dQw4w9WgXcQ", linkStatus: "ok" })).toBeNull()
    expect(videoEmbed({ provider: "vimeo", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", linkStatus: "ok" })).toBeNull()
    expect(videoEmbed({ provider: "youtube", url: "javascript:alert(1)", linkStatus: "ok" })).toBeNull()
  })

  it("starts at once after a tap on Watch here, except the Archive, which has no such switch", () => {
    const embed = videoEmbed(yt("dQw4w9WgXcQ"))
    expect(embed && playerSrc(embed)).toMatch(/&autoplay=1$/)
    const archive = videoEmbed({ provider: "archive", url: "https://archive.org/details/some-id", linkStatus: "ok" })
    expect(archive && playerSrc(archive)).toBe("https://archive.org/embed/some-id")
  })

  it("lets the player load only its own embed and media hosts, never a watch page or another site", () => {
    expect(embedMayLoad("youtube", "https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1")).toBe(true)
    expect(embedMayLoad("youtube", "https://rr1---sn.googlevideo.com/videoplayback", false)).toBe(true)
    expect(embedMayLoad("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false)
    expect(embedMayLoad("youtube", "https://example.com/")).toBe(false)
    expect(embedMayLoad("vimeo", "https://player.vimeo.com/video/76979871")).toBe(true)
    expect(embedMayLoad("vimeo", "https://vimeo.com/76979871")).toBe(false)
    expect(embedMayLoad("archive", "https://archive.org/embed/some-id")).toBe(true)
    expect(embedMayLoad("archive", "https://archive.org/details/some-id")).toBe(false)
    expect(embedMayLoad("archive", "about:blank")).toBe(true)
  })

  it("is not fooled by look-alike hosts, user names, other schemes or ports", () => {
    // a host that merely CONTAINS or STARTS WITH the allowed name
    expect(embedMayLoad("youtube", "https://evil-googlevideo.com/videoplayback", false)).toBe(false)
    expect(embedMayLoad("youtube", "https://googlevideo.com.evil.com/x", false)).toBe(false)
    expect(embedMayLoad("youtube", "https://youtube.com.evil.com/embed/dQw4w9WgXcQ")).toBe(false)
    expect(embedMayLoad("youtube", "https://evilyoutube.com/embed/dQw4w9WgXcQ")).toBe(false)
    expect(embedMayLoad("vimeo", "https://evil-vimeocdn.com/x", false)).toBe(false)
    expect(embedMayLoad("vimeo", "https://player.vimeo.com.evil.com/video/1")).toBe(false)
    expect(embedMayLoad("archive", "https://archive.org.evil.com/embed/x")).toBe(false)
    expect(embedMayLoad("archive", "https://evil-us.archive.org.example/x", false)).toBe(false)
    // user name tricks: the host is what comes after the @
    expect(embedMayLoad("youtube", "https://www.youtube.com@evil.com/embed/dQw4w9WgXcQ")).toBe(false)
    expect(embedMayLoad("youtube", "https://www.youtube.com:pw@www.youtube.com/embed/dQw4w9WgXcQ")).toBe(false)
    expect(embedMayLoad("vimeo", "https://player.vimeo.com@evil.com/video/1")).toBe(false)
    // not https, odd ports, things that do not parse
    expect(embedMayLoad("youtube", "http://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(false)
    expect(embedMayLoad("youtube", "https://www.youtube.com:8443/embed/dQw4w9WgXcQ")).toBe(false)
    expect(embedMayLoad("youtube", "javascript:alert(1)")).toBe(false)
    expect(embedMayLoad("youtube", "//evil.com/embed/x")).toBe(false)
    expect(embedMayLoad("youtube", "not a url")).toBe(false)
  })

  it("allows data: and blob: only inside the page's own frames, never as the main frame", () => {
    expect(embedMayLoad("youtube", "data:text/html,<script>alert(1)</script>")).toBe(false)
    expect(embedMayLoad("youtube", "data:text/html,<script>alert(1)</script>", true)).toBe(false)
    expect(embedMayLoad("youtube", "blob:https://www.youtube.com/abc", true)).toBe(false)
    expect(embedMayLoad("youtube", "about:srcdoc", true)).toBe(false)
    expect(embedMayLoad("youtube", "data:text/html,x", false)).toBe(true)
    expect(embedMayLoad("youtube", "blob:https://www.youtube.com/abc", false)).toBe(true)
    expect(embedMayLoad("youtube", "about:blank", true)).toBe(true)
  })

  it("keeps the CDN and media hosts out of the main frame, and download links out of the archive rule", () => {
    expect(embedMayLoad("youtube", "https://rr1---sn.googlevideo.com/videoplayback")).toBe(false)
    expect(embedMayLoad("youtube", "https://i.ytimg.com/vi/x/hqdefault.jpg")).toBe(false)
    expect(embedMayLoad("youtube", "https://www.google.com/recaptcha/api2/anchor")).toBe(false)
    expect(embedMayLoad("youtube", "https://www.google.com/recaptcha/api2/anchor", false)).toBe(true)
    expect(embedMayLoad("vimeo", "https://x.akamaized.net/a")).toBe(false)
    expect(embedMayLoad("vimeo", "https://i.vimeocdn.com/video/1.jpg")).toBe(false)
    expect(embedMayLoad("archive", "https://archive.org/download/some-id/file.mp4")).toBe(false)
    expect(embedMayLoad("archive", "https://archive.org/download/some-id/file.mp4", false)).toBe(false)
    expect(embedMayLoad("archive", "https://ia800000.us.archive.org/1/items/x/file.mp4")).toBe(false)
    expect(embedMayLoad("archive", "https://ia800000.us.archive.org/1/items/x/file.mp4", false)).toBe(true)
  })
})

describe("what a video does to the recording's audio", () => {
  it("closes the video when the audio starts under it, and only then", () => {
    expect(audioStartedUnderVideo({ isPlaying: false }, { isPlaying: true }, true)).toBe(true)
    expect(audioStartedUnderVideo({ isPlaying: false }, { isPlaying: true }, false)).toBe(false)
    expect(audioStartedUnderVideo({ isPlaying: true }, { isPlaying: true }, true)).toBe(false)
    expect(audioStartedUnderVideo({ isPlaying: true }, { isPlaying: false }, true)).toBe(false)
  })

  it("the hook pauses the audio on open, closes on audio start, on leaving the page and on the app going to the background", () => {
    const source = read("components/recording-extras/useVideoWatch.ts").replace(/\/\*[\s\S]*?\*\//g, "")
    expect(source).toContain("usePlayerStore.getState().pause()")
    expect(source).toContain("audioStartedUnderVideo")
    expect(source).toContain("useFocusEffect")
    expect(source).toContain('AppState.addEventListener("change"')
    // the queue and the radio are not touched, and nothing is resumed by itself
    expect(source).not.toMatch(/\.play\(|resume|clearQueue|stopRadio/i)
  })
})

describe("the headline video of the page", () => {
  it("is the first link that plays inside the app and is not known to be gone", () => {
    expect(featuredVideo([yt("aaaaaaaaaaa", "unavailable"), yt("bbbbbbbbbbb", "no_embed"), yt("ccccccccccc")])).toEqual(yt("ccccccccccc"))
  })
  it("falls back to a link that only opens on its site, and never headlines a gone one", () => {
    expect(featuredVideo([yt("aaaaaaaaaaa", "unavailable"), yt("bbbbbbbbbbb", "no_embed")])).toEqual(yt("bbbbbbbbbbb", "no_embed"))
    expect(featuredVideo([yt("aaaaaaaaaaa", "unavailable")])).toBeNull()
    expect(featuredVideo([])).toBeNull()
  })
})

describe("the video link of the Kiirtan upload form", () => {
  it("is offered for a Kiirtan with one file at most", () => {
    expect(offersVideoLink("kiirtan", 0)).toBe(true)
    expect(offersVideoLink("kiirtan", 1)).toBe(true)
    expect(offersVideoLink("kiirtan", 2)).toBe(false)
    expect(offersVideoLink("bhajan", 1)).toBe(false)
  })
  it("is optional, normalized and checked with the same rules as the recording page", () => {
    expect(videoLinkProblem("")).toBeNull()
    expect(videoLinkProblem("   ")).toBeNull()
    expect(videoLinkToSend("https://youtu.be/dQw4w9WgXcQ?t=5")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    expect(videoLinkProblem("http://youtu.be/dQw4w9WgXcQ")).toBe("notHttps")
    expect(videoLinkProblem("https://example.com/x")).toBe("provider")
    expect(videoLinkToSend("https://example.com/x")).toBeNull()
  })
  it("goes to the recording only when the queue is one file, done, and its submission is up", () => {
    const subs = [{ id: "s1", serverId: "srv-1" }, { id: "s2", serverId: null }]
    expect(linkTarget([{ status: "done", submissionId: "s1" }], subs)).toBe("srv-1")
    expect(linkTarget([{ status: "uploading", submissionId: "s1" }], subs)).toBeNull()
    expect(linkTarget([{ status: "done", submissionId: "s2" }], subs)).toBeNull()
    expect(linkTarget([{ status: "done", submissionId: "s1" }, { status: "done", submissionId: "s1" }], subs)).toBeNull()
    expect(linkTarget([], subs)).toBeNull()
  })
  it("is wired into the form with the field and the sender, and the form does not hold the send back", () => {
    const form = read("app/add-kirtan.tsx")
    expect(form).toContain("<VideoLinkField")
    expect(form).toContain("useSendVideoLink(")
    expect(form).toContain("offersVideoLink(kind, items.length)")
  })
})

describe("the tag row of a recording's page", () => {
  const base = { kind: "kiirtan" as const, style: undefined, styleOther: undefined, styles: undefined, stylesOther: undefined, moods: undefined, moodsOther: undefined, practice: undefined, recordingType: undefined, tempo: undefined, performance: undefined, leadInstrument: undefined, leadInstrumentOther: undefined }
  it("has nothing for a recording that states nothing", () => {
    expect(pageTags(base)).toEqual([])
  })
  it("names the style first, then how it was recorded, tempo, solo or group, instrument and Avarta", () => {
    const tags = pageTags({ ...base, styles: ["indian"], recordingType: "studio", tempo: "slow", performance: "group", leadInstrument: "harmonium", practice: "avarta" })
    expect(tags.map((tag) => tag.id)).toEqual(["style-indian", "type-studio", "tempo-slow", "performance-group", "instrument-harmonium", "practice-avarta"])
    expect(tags[0]?.label).toMatch(/Indian/i)
  })
  it("names every style and mood a recording carries, an older row's single style too", () => {
    const tags = pageTags({ ...base, styles: ["indian", "electronic"], stylesOther: ["Baul"], moods: ["joyful", "mix"], moodsOther: ["Deep peace"] })
    expect(tags.map((tag) => tag.id)).toEqual(["style-indian", "style-electronic", "style-own-Baul", "mood-joyful", "mood-mix", "mood-own-Deep peace"])
    expect(pageTags({ ...base, style: "bengali" }).map((tag) => tag.id)).toEqual(["style-bengali"])
  })
  it("marks an AI-made recording", () => {
    expect(pageTags({ ...base, recordingType: "ai" }).find((tag) => tag.id === "type-ai")?.tone).toBe("ai")
  })
  it("has no style or mood for Baba's Audio Discourses, and no instrument either", () => {
    expect(pageTags({ ...base, kind: "bhajan", styles: ["indian"] }).some((tag) => tag.id.startsWith("style-"))).toBe(true)
    expect(pageTags({ ...base, kind: "baba_audio", styles: ["indian"], moods: ["joyful"] })).toEqual([])
    expect(pageTags({ ...base, kind: "baba_audio", leadInstrument: "harmonium" }).some((tag) => tag.id.startsWith("instrument-"))).toBe(false)
  })
})

describe("the recording page of a Kiirtan", () => {
  const page = read("app/recording/[id].tsx")
  it("shows the tabs (Chords first, then Video with its links, Notes, Story) after the tags and Play", () => {
    const order = ["<RecordingHero", "<RecordingTags", 'tr("recPage.play")', "<KiirtanTabs", "<CycleBlock", "<VideoBlock", "<VideosSection", "<PianoBlock", "<CommentsView"].map((needle) => page.indexOf(needle))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })
  it("never highlights a part of the cycle as playing now", () => {
    const block = read("components/recording-extras/CycleBlock.tsx") + read("components/recording-extras/CycleRing.tsx")
    expect(block).not.toMatch(/currentTime|nowPlaying|usePlayerStore|activeForm|progress/)
  })
  it("draws nothing on the picture, so a photo of Baba always shows clean", () => {
    const hero = read("components/kirtan/RecordingHero.tsx")
    // the only gradient is the wash BEHIND the picture; the title is under it, not over it
    expect(hero).not.toMatch(/position:\s*"absolute"[^}]*zIndex:\s*[2-9]/)
    expect(hero).toContain("blurRadius")
    expect((hero.match(/<LinearGradient/g) ?? []).length).toBe(1)
  })
  it("the cycle screen is a route with a modal presentation and has the player policy row", () => {
    expect(read("app/_layout.tsx")).toContain('name="recording-cycle"')
    expect(read("lib/playerPolicy.ts")).toContain('"/recording-cycle"')
    expect(read("../../docs/player-visibility.md")).toContain("`/recording-cycle`")
  })
})
