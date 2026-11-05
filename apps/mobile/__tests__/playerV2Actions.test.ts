import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { webBaseUrl: "https://example.test" } } } }))

import {
  aboutContent,
  buildActionRows,
  buildQueueFooter,
  collectionForSong,
  cycleRepeat,
  previewOf,
  queueAddMessage,
  repeatLabel,
  repeatMessage,
  shufflingFromLine,
} from "@/lib/playerV2/playerActions"
import {
  buildSharePayload,
  facebookShareUrl,
  legibleTint,
  pickWordsLines,
  PHOTO_SCRIM_ALPHA,
  SHARE_BACKGROUNDS,
  SHARE_TARGETS,
  shareBackgrounds,
  shareModes,
  sharePalette,
  shareRoute,
  shareTargetUrl,
  shareToast,
  telegramShareUrl,
  whatsappShareUrl,
  withWordsPayload,
} from "@/lib/playerV2/playerShare"
import { COVER_IDS, COVER_TINTS, contrastRatio, coverIdFor, FOREST, hexAlpha, mixHex, tintForSong } from "@/lib/playerV2/coverTint"

const base = { sourceName: "All songs", saved: false, inQueue: false, collectionName: null, speedText: "1×", sleepText: "Off" }

describe("More sheet rows", () => {
  it("lists the actions in the agreed order", () => {
    expect(buildActionRows(base).map((r) => r.id)).toEqual([
      "share", "save", "playlist", "queue", "goQueue", "source", "songPage", "collection", "playback", "drive", "report",
    ])
  })

  it("turns Save into Saved, in orange", () => {
    const off = buildActionRows(base).find((r) => r.id === "save")!
    const on = buildActionRows({ ...base, saved: true }).find((r) => r.id === "save")!
    expect(off).toMatchObject({ label: "Save to my songs", active: false })
    expect(on).toMatchObject({ label: "Saved", active: true })
  })

  it("names the collection, or the list of all of them", () => {
    expect(buildActionRows({ ...base, collectionName: "Neo-Humanism Songs" }).find((r) => r.id === "collection")!.meta).toBe("Neo-Humanism Songs")
    expect(buildActionRows(base).find((r) => r.id === "collection")!.meta).toBe("All collections")
  })

  it("shows speed and sleep timer on the Playback row and warns about a duplicate queue add", () => {
    const rows = buildActionRows({ ...base, inQueue: true, speedText: "1.25×", sleepText: "15:00" })
    expect(rows.find((r) => r.id === "playback")!.meta).toBe("Speed 1.25× · Sleep timer 15:00")
    expect(rows.find((r) => r.id === "queue")!.meta).toBe("Already in this queue")
    expect(queueAddMessage(true)).toBe("Already in the queue")
    expect(queueAddMessage(false)).toBe("Added to the queue")
  })

  it("keeps Drive mode and the source picker reachable from the sheet", () => {
    const rows = buildActionRows({ ...base, sourceName: "Mine" })
    expect(rows.find((r) => r.id === "drive")?.label).toBe("Drive mode")
    expect(rows.find((r) => r.id === "source")).toMatchObject({ label: "Play songs from", meta: "Mine" })
  })

  it("picks the most specific collection of a song", () => {
    const collections = [
      { label: "Big", count: 900, songNumbers: [1, 2, 3] },
      { label: "Small", count: 12, songNumbers: [3] },
      { label: "Other", count: 5, songNumbers: [9] },
    ]
    expect(collectionForSong(3, collections)?.label).toBe("Small")
    expect(collectionForSong(1, collections)?.label).toBe("Big")
    expect(collectionForSong(77, collections)).toBeNull()
  })
})

describe("queue footer", () => {
  it("cycles repeat off, all, one, off", () => {
    expect(cycleRepeat("off")).toBe("all")
    expect(cycleRepeat("all")).toBe("one")
    expect(cycleRepeat("one")).toBe("off")
  })

  it("labels Repeat One and lights the active buttons", () => {
    expect(repeatLabel("off")).toBe("Repeat")
    expect(repeatLabel("all")).toBe("Repeat")
    expect(repeatLabel("one")).toBe("Repeat One")
    expect(buildQueueFooter({ shuffleOn: false, repeat: "off", timerOn: false })).toEqual([
      { id: "shuffle", label: "Shuffle", active: false },
      { id: "repeat", label: "Repeat", active: false },
      { id: "timer", label: "Timer", active: false },
    ])
    const lit = buildQueueFooter({ shuffleOn: true, repeat: "one", timerOn: true })
    expect(lit.map((b) => b.active)).toEqual([true, true, true])
    expect(lit[1]!.label).toBe("Repeat One")
  })

  it("words the repeat toast and the Shuffling from line", () => {
    expect(repeatMessage("off", "All songs")).toBe("Repeat off")
    expect(repeatMessage("all", "Mine")).toBe("Repeat all in Mine")
    expect(repeatMessage("one", "Mine")).toBe("Repeat this song")
    expect(shufflingFromLine(true, "Mine")).toBe("Shuffling from: Mine")
    expect(shufflingFromLine(false, "Mine")).toBeNull()
  })
})

describe("About this song", () => {
  it("is hidden without any text", () => {
    expect(aboutContent({ centralIdea: null, meaning: "  ", shortDescription: "" })).toBeNull()
  })

  it("uses the central idea first, then the meaning, and previews the first lines", () => {
    const about = aboutContent({ centralIdea: "The seeker asks for a friend.", meaning: "Friend, take me along." })!
    expect(about.sections.map((s) => s.heading)).toEqual(["Central idea", "Meaning"])
    expect(about.preview).toBe("The seeker asks for a friend.")
  })

  it("falls back to the fixture text and to the meaning alone", () => {
    expect(aboutContent({ meaning: "Only meaning" }, "Fixture idea")!.sections[0]!.text).toBe("Fixture idea")
    expect(aboutContent({ meaning: "Only meaning" })!.sections).toEqual([{ heading: "Meaning", text: "Only meaning" }])
  })

  it("cuts a long preview at a word", () => {
    const long = "word ".repeat(60)
    const p = previewOf(long, 40)
    expect(p.endsWith("…")).toBe(true)
    expect(p.length).toBeLessThanOrEqual(41)
    expect(previewOf("short")).toBe("short")
  })
})

describe("share payload", () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_WEB_BASE_URL
  })

  it("carries the title, the song link and a message that ends with it", () => {
    const p = buildSharePayload({ number: 3, title: "Ándhára Sheśe Álora Deshe", performer: "Performer A" })
    expect(p.title).toBe("PS 3 · Ándhára Sheśe Álora Deshe")
    expect(p.url).toBe("https://example.test/songs/3?open=app")
    expect(p.message).toContain("PS 3 · Ándhára Sheśe Álora Deshe")
    expect(p.message.endsWith(p.url)).toBe(true)
  })

  it("builds direct links only where a channel has one", () => {
    const p = buildSharePayload({ number: 3, title: "T" })
    expect(shareTargetUrl("whatsapp", p, "web")).toMatch(/^https:\/\/wa\.me\/\?text=Prabhat%20Samgiita%20AI/)
    expect(shareTargetUrl("whatsapp", p, "ios")).toBe(whatsappShareUrl(p))
    expect(shareTargetUrl("facebook", p, "android")).toBe(facebookShareUrl(p))
    expect(new URL(facebookShareUrl(p)).searchParams.get("u")).toBe(p.url)
    expect(facebookShareUrl(p).startsWith("https://www.facebook.com/sharer/sharer.php?")).toBe(true)
    expect(shareTargetUrl("copy", p, "ios")).toBeNull()
    expect(shareTargetUrl("instagram", p, "ios")).toBeNull()
    expect(shareTargetUrl("instagramStories", p, "ios")).toBeNull()
    expect(shareTargetUrl("more", p, "android")).toBeNull()
  })

  it("says how each target is really sent", () => {
    expect(SHARE_TARGETS.map((t) => [t.id, shareRoute(t.id)])).toEqual([
      ["copy", "clipboard"],
      ["whatsapp", "link"],
      ["telegram", "link"],
      ["instagramStories", "system-sheet"],
      ["instagram", "system-sheet"],
      ["facebook", "link"],
      ["more", "system-sheet"],
    ])
  })

  it("builds the Telegram personal-share link with the song link in url and the message in text", () => {
    const p = buildSharePayload({ number: 3, title: "Ándhára Sheśe Álora Deshe", performer: "Performer A" })
    const link = telegramShareUrl(p)
    expect(link.startsWith("https://t.me/share/url?")).toBe(true)
    const q = new URL(link).searchParams
    expect(q.get("url")).toBe(p.url)
    expect(q.get("text")).toContain("PS 3 · Ándhára Sheśe Álora Deshe")
    expect(q.get("text")).not.toContain(p.url)
    expect(shareTargetUrl("telegram", p, "web")).toBe(link)
    expect(shareTargetUrl("telegram", p, "ios")).toBe(link)
    expect(shareTargetUrl("telegram", p, "android")).toBe(link)
  })

  it("says Link copied only when the link was copied", () => {
    expect(shareToast("copied")).toBe("Link copied")
    expect(shareToast("copy-failed")).toBe("Could not copy the link")
    expect(shareToast("shared")).toBeNull()
    expect(shareToast("opened")).toBeNull()
    expect(shareToast("dismissed")).toBeNull()
  })

  it("lists the seven targets in order, without LinkedIn, Snapchat, SMS or other networks", () => {
    expect(SHARE_TARGETS.map((t) => t.id)).toEqual(["copy", "whatsapp", "telegram", "instagramStories", "instagram", "facebook", "more"])
    const labels = SHARE_TARGETS.map((t) => t.label.toLowerCase()).join("|")
    for (const banned of ["linkedin", "snapchat", "messages", "sms", "twitter", "tiktok", "threads"]) expect(labels).not.toContain(banned)
    expect(SHARE_TARGETS.find((t) => t.id === "instagram")?.label).toBe("Instagram")
    expect(SHARE_TARGETS.filter((t) => t.needsImage).map((t) => t.id)).toEqual(["instagramStories"])
  })

  it("offers four card grounds in dot order, the photo only when there is one", () => {
    expect(SHARE_BACKGROUNDS.map((b) => b.id)).toEqual(["cover", "forest", "ink", "photo"])
    expect(shareBackgrounds(true).map((b) => b.id)).toEqual(["cover", "forest", "ink", "photo"])
    expect(shareBackgrounds(false).map((b) => b.id)).toEqual(["cover", "forest", "ink"])
  })

  it("hides Words for Kiirtan items and for songs without lyrics", () => {
    expect(shareModes({ kiirtan: false, lyricLines: 8 }).map((m) => m.id)).toEqual(["song", "words"])
    expect(shareModes({ kiirtan: true, lyricLines: 8 }).map((m) => m.id)).toEqual(["song"])
    expect(shareModes({ kiirtan: false, lyricLines: 0 }).map((m) => m.id)).toEqual(["song"])
  })

  it("picks three or four lyric lines for the Words card and sends them ahead of the message", () => {
    const lines = ["Line one of the song", "Line two of the song", "Line three", "Line four", "Line five", "Line six"]
    expect(pickWordsLines(lines)).toEqual(lines.slice(0, 4))
    expect(pickWordsLines(["", "  a  ", "b"])).toEqual(["a", "b"])
    expect(pickWordsLines([])).toEqual([])
    const long = "x".repeat(90)
    expect(pickWordsLines([long, long, long, long])).toEqual([long, long])
    const p = buildSharePayload({ number: 3, title: "T" })
    const w = withWordsPayload(p, ["a", "b"])
    expect(w.message.startsWith("a\nb\n\n")).toBe(true)
    expect(w.message.endsWith(p.url)).toBe(true)
    expect(w.url).toBe(p.url)
    expect(withWordsPayload(p, [])).toBe(p)
  })

  it("darkens a bright tone (a Kiirtan's orange) until the card text passes, and leaves the song tones alone", () => {
    for (const tint of Object.values(COVER_TINTS)) expect(legibleTint(tint)).toBe(tint)
    for (const bright of ["#D2692F", "#F2A33A", "#4FB0C6", "#E0E0E0"]) {
      const pal = sharePalette("cover", bright)
      for (const ground of [pal.from, pal.to]) {
        expect(contrastRatio(pal.sub, ground), `${bright} sub`).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(pal.accent, ground), `${bright} accent`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it("keeps card text readable (WCAG AA 4.5:1) on every background and every cover tone", () => {
    expect(PHOTO_SCRIM_ALPHA).toBeGreaterThanOrEqual(0.6)
    for (const { id } of SHARE_BACKGROUNDS) {
      for (const tint of Object.values(COVER_TINTS)) {
        const pal = sharePalette(id, tint)
        for (const ground of [pal.from, pal.to]) {
          expect(contrastRatio(pal.text, ground), `${id} text on ${ground}`).toBeGreaterThanOrEqual(4.5)
          expect(contrastRatio(pal.sub, ground), `${id} sub on ${ground}`).toBeGreaterThanOrEqual(4.5)
          expect(contrastRatio(pal.accent, ground), `${id} accent on ${ground}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })
})

describe("cover tint", () => {
  it("gives a song the same cover every time and the forest when nothing plays", () => {
    expect(coverIdFor(3)).toBe(coverIdFor(3))
    expect(COVER_IDS).toContain(coverIdFor(5018))
    expect(tintForSong(null)).toBe(FOREST)
    expect(tintForSong(3)).toBe(COVER_TINTS[coverIdFor(3)])
  })

  it("matches the Home shelves formula", () => {
    // lib/homeShelves coverFor: ids[(n * 7 + 3) % 6] with the same id order
    expect(coverIdFor(0)).toBe("lotus")
    expect(coverIdFor(1)).toBe("seated")
  })

  it("mixes and fades colours", () => {
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080")
    expect(mixHex("#102030", "#FFFFFF", 0)).toBe("#102030")
    expect(hexAlpha("#20281A", 0.5)).toBe("rgba(32, 40, 26, 0.5)")
  })

  it("keeps white text on every tone readable", () => {
    for (const tint of Object.values(COVER_TINTS)) expect(contrastRatio("#FFFFFF", tint)).toBeGreaterThanOrEqual(4.5)
  })
})
