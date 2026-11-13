import { describe, expect, it } from "vitest"

import { bodyText, keepPsTogether, parseBody } from "@/lib/stories/body"
import { FIXTURE_STORIES } from "@/lib/fixtures/stories"
import { storyFromApi } from "@/lib/stories/fromApi"
import {
  featuredStory,
  filterStories,
  matchesStory,
  nextStory,
  sortStories,
  storiesCountLabel,
} from "@/lib/stories/list"
import { FINISH_AT, isFinished, readingProgress } from "@/lib/stories/progress"
import { isRead, markRead, markUnread, sanitizeReadMap, unreadCount } from "@/lib/stories/readState"
import { countWords, estimateReadMinutes, readTimeLabel } from "@/lib/stories/readTime"
import { storyShareMessage } from "@/lib/stories/share"
import { primarySong, type Story } from "@/lib/stories/types"

function story(slug: string, title: string, songNumbers: number[] = []): Story {
  return { slug, title, teaser: "", author: "", themes: [], songNumbers, sourceUrl: null, paragraphs: [] }
}

const A = story("a", "Dawn at the lake", [30])
const B = story("b", "The story behind PS 3", [3])
const C = story("c", "A story without a song")
const D = story("d", "Songs at the festivals", [4])
const ALL = [A, B, C, D]
const titles: Record<number, string> = { 3: "Ándhára Sheśe Álora Deshe", 4: "Sakal Maner Viińá", 30: "Prabháte" }
const songTitle = (n: number) => titles[n]

describe("read time", () => {
  it("counts words across paragraphs", () => {
    expect(countWords(["one two", "three"])).toBe(3)
    expect(countWords("  spaced   out  ")).toBe(2)
    expect(countWords("")).toBe(0)
  })
  it("rounds up, never under one minute, zero for no text", () => {
    expect(estimateReadMinutes("a b c")).toBe(1)
    expect(estimateReadMinutes(Array(200).fill("w"))).toBe(1)
    expect(estimateReadMinutes(Array(201).fill("w"))).toBe(2)
    expect(estimateReadMinutes(Array(1000).fill("w"), 250)).toBe(4)
    expect(estimateReadMinutes([])).toBe(0)
  })
  it("labels the minutes, and nothing when unknown", () => {
    expect(readTimeLabel(4)).toBe("4 min read")
    expect(readTimeLabel(0)).toBe("")
    expect(readTimeLabel(null)).toBe("")
  })
})

describe("read state", () => {
  it("marks read once and keeps the first time", () => {
    const one = markRead({}, "a", 100)
    expect(one).toEqual({ a: 100 })
    expect(markRead(one, "a", 999)).toBe(one)
    expect(isRead(one, "a")).toBe(true)
    expect(isRead(one, "b")).toBe(false)
  })
  it("marks unread and returns the same map when nothing changes", () => {
    const map = { a: 1, b: 2 }
    expect(markUnread(map, "a")).toEqual({ b: 2 })
    expect(markUnread(map, "zzz")).toBe(map)
    expect(map).toEqual({ a: 1, b: 2 })
  })
  it("ignores an empty slug", () => {
    const map = {}
    expect(markRead(map, "", 1)).toBe(map)
  })
  it("counts unread", () => {
    expect(unreadCount(["a", "b", "c"], { b: 1 })).toBe(2)
  })
  it("keeps only slug -> number from damaged storage", () => {
    expect(sanitizeReadMap({ a: 1, b: "x", c: null, d: Number.NaN, e: 5 })).toEqual({ a: 1, e: 5 })
    expect(sanitizeReadMap(null)).toEqual({})
    expect(sanitizeReadMap([1, 2])).toEqual({})
    expect(sanitizeReadMap("text")).toEqual({})
  })
})

describe("sort, filter, search", () => {
  it("sorts by song number, stories without a song last", () => {
    expect(sortStories(ALL).map((s) => s.slug)).toEqual(["b", "d", "a", "c"])
  })
  it("does not change the list it is given", () => {
    const copy = [...ALL]
    sortStories(ALL)
    expect(ALL).toEqual(copy)
  })
  it("breaks ties by title", () => {
    const x = story("x", "Banyan", [5])
    const y = story("y", "Acacia", [5])
    expect(sortStories([x, y]).map((s) => s.slug)).toEqual(["y", "x"])
  })
  it("finds by title words, by prefix and without accents", () => {
    expect(matchesStory(A, "dawn", songTitle)).toBe(true)
    expect(matchesStory(A, "LAK", songTitle)).toBe(true)
    expect(matchesStory(A, "dusk", songTitle)).toBe(false)
    expect(matchesStory(B, "andhara", songTitle)).toBe(true)
    expect(matchesStory(B, "sheshe", songTitle)).toBe(false)
  })
  it("finds by PS number exactly: 3 is PS 3, not PS 30", () => {
    expect(matchesStory(B, "ps 3", songTitle)).toBe(true)
    expect(matchesStory(B, "3", songTitle)).toBe(true)
    expect(matchesStory(A, "3", songTitle)).toBe(false)
    expect(matchesStory(A, "ps 30", songTitle)).toBe(true)
  })
  it("needs every word of the query", () => {
    expect(matchesStory(B, "story ps 3", songTitle)).toBe(true)
    expect(matchesStory(B, "story ps 4", songTitle)).toBe(false)
  })
  it("an empty query keeps everything", () => {
    expect(ALL.every((s) => matchesStory(s, "   ", songTitle))).toBe(true)
  })
  it("a story without a song is not found by number", () => {
    expect(matchesStory(C, "ps", songTitle)).toBe(false)
  })
  it("Unread hides read stories; the query narrows further", () => {
    const read = { b: 1 }
    expect(filterStories(ALL, { query: "", filter: "unread", read }).map((s) => s.slug)).toEqual(["a", "c", "d"])
    expect(filterStories(ALL, { query: "story", filter: "unread", read }).map((s) => s.slug)).toEqual(["c"])
    expect(filterStories(ALL, { query: "story", filter: "all", read }).map((s) => s.slug)).toEqual(["b", "c"])
  })
})

describe("featured and next", () => {
  const sorted = sortStories(ALL) // b, d, a, c
  it("features the first unread story, or the first when all are read", () => {
    expect(featuredStory(sorted, {})?.slug).toBe("b")
    expect(featuredStory(sorted, { b: 1 })?.slug).toBe("d")
    expect(featuredStory(sorted, { b: 1, d: 1, a: 1, c: 1 })?.slug).toBe("b")
    expect(featuredStory([], {})).toBeNull()
  })
  it("next is the next unread story going forward and around the end", () => {
    expect(nextStory(sorted, "b", {})?.slug).toBe("d")
    expect(nextStory(sorted, "b", { d: 1 })?.slug).toBe("a")
    expect(nextStory(sorted, "c", { b: 1 })?.slug).toBe("d")
  })
  it("when everything is read, next is simply the following story", () => {
    const all = { a: 1, b: 1, c: 1, d: 1 }
    expect(nextStory(sorted, "d", all)?.slug).toBe("a")
    expect(nextStory(sorted, "c", all)?.slug).toBe("b")
  })
  it("no next with one story; an unknown slug starts at the top", () => {
    expect(nextStory([A], "a", {})).toBeNull()
    expect(nextStory([], "a", {})).toBeNull()
    expect(nextStory(sorted, "nope", {})?.slug).toBe("b")
  })
})

describe("count label", () => {
  it("says stories, a fraction while searching, unread for the Unread chip", () => {
    expect(storiesCountLabel(6, 6, "all", 4)).toBe("6 stories")
    expect(storiesCountLabel(1, 1, "all", 0)).toBe("1 story")
    expect(storiesCountLabel(2, 6, "all", 4)).toBe("2 of 6")
    expect(storiesCountLabel(4, 6, "unread", 4)).toBe("4 unread")
    expect(storiesCountLabel(0, 0, "all", 0)).toBe("")
  })
})

describe("reading progress", () => {
  it("is the share of the scrollable distance, clamped", () => {
    expect(readingProgress(0, 2000, 800)).toBe(0)
    expect(readingProgress(600, 2000, 800)).toBe(0.5)
    expect(readingProgress(1200, 2000, 800)).toBe(1)
    expect(readingProgress(-50, 2000, 800)).toBe(0)
    expect(readingProgress(1500, 2000, 800)).toBe(1)
  })
  it("a page that fits (or is not measured yet) has no progress", () => {
    expect(readingProgress(0, 700, 800)).toBe(0)
    expect(readingProgress(0, 0, 0)).toBe(0)
    expect(isFinished(readingProgress(0, 700, 800))).toBe(false)
  })
  it("is finished near the end", () => {
    expect(isFinished(FINISH_AT)).toBe(true)
    expect(isFinished(FINISH_AT - 0.01)).toBe(false)
    expect(isFinished(1)).toBe(true)
  })
})

describe("body", () => {
  it("makes paragraphs and pull quotes, tidies spaces, drops blanks", () => {
    expect(parseBody(["  One   two ", "", "> A line", ">", "Three"])).toEqual([
      { kind: "p", text: "One two" },
      { kind: "quote", text: "A line" },
      { kind: "p", text: "Three" },
    ])
  })
  it("keeps PS and its number together", () => {
    expect(keepPsTogether("The story behind PS 1 and PS 23")).toBe("The story behind PS\u00a01 and PS\u00a023")
    expect(keepPsTogether("No number: PS")).toBe("No number: PS")
  })
  it("leaves the quote mark out of the words", () => {
    expect(bodyText(["> Quote here", "Plain"])).toEqual(["Quote here", "Plain"])
  })
})

describe("share and API mapping", () => {
  it("builds a short message without making up an address", () => {
    const m = storyShareMessage({ title: " The story ", songNumber: 3, songTitle: "Andhara", url: null })
    expect(m.subject).toBe("The story")
    expect(m.message).toBe("The story\nAbout PS 3, Andhara.\nA story behind a Prabhat Samgiita song.")
    expect(m.message).not.toMatch(/https?:/)
  })
  it("adds the source address when the API gave one", () => {
    expect(storyShareMessage({ title: "T", url: "https://example.org/x" }).message).toContain("https://example.org/x")
  })
  it("maps an API story: list row has no body, detail has", () => {
    const row = storyFromApi({
      slug: "s",
      title: " T ",
      author: "A",
      teaser: " t ",
      source_url: "  ",
      themes: ["x"],
      song_numbers: [0, 3, Number.NaN],
    })
    expect(row).toMatchObject({ slug: "s", title: "T", teaser: "t", sourceUrl: null, songNumbers: [3], paragraphs: [] })
    expect(storyFromApi({ ...rowBase(), body_paragraphs: [" a  b ", ""] }).paragraphs).toEqual(["a b"])
  })
  it("primarySong is the first valid number", () => {
    expect(primarySong({ songNumbers: [0, 7] })).toBe(7)
    expect(primarySong({ songNumbers: [] })).toBeNull()
  })
})

function rowBase() {
  return { slug: "s", title: "T", author: "A", teaser: "t" }
}

describe("fixtures", () => {
  it("are marked as samples, have unique slugs, a song and a read time", () => {
    expect(new Set(FIXTURE_STORIES.map((s) => s.slug)).size).toBe(FIXTURE_STORIES.length)
    for (const s of FIXTURE_STORIES) {
      expect(s.paragraphs[0]).toBe("Sample story, text to be replaced by the editors.")
      expect(primarySong(s)).not.toBeNull()
      expect(estimateReadMinutes(bodyText(s.paragraphs))).toBeGreaterThan(0)
    }
  })
  it("keep the slugs and titles Today and the story sheet already show", () => {
    expect(FIXTURE_STORIES.slice(0, 3).map((s) => s.slug)).toEqual(["mock-story-0", "mock-story-1", "mock-story-2"])
    expect(FIXTURE_STORIES[0]!.title).toBe("The story behind PS 1")
  })
})
