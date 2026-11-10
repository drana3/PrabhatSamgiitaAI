import { describe, expect, it } from "vitest"

import { festivalCalendar } from "@/data/festivals"
import { songsForFestival } from "@/data/festivalSongs"
import { parseReviewedFestivals, reviewedSongsFor, REVIEWED_FESTIVALS } from "@/lib/festivals/reviewed"
import { CARD_LEAD_DAYS, cardPhase, cardPreviewSongs, festivalCardTitle, todayFestivalCards } from "@/lib/festivals/todayCard"

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h, 5)
const row = (over: Record<string, unknown>) => ({
  id: "f",
  name_en: "Fest",
  name_ru: "Праздник",
  dates: { "2026": "2026-11-08" },
  songs: [1, 2],
  date_basis: "official-2026",
  ...over,
})

describe("the reviewed festival file", () => {
  it("reads a bare list and an object with a festivals list", () => {
    expect(parseReviewedFestivals([row({})])).toHaveLength(1)
    expect(parseReviewedFestivals({ source: {}, festivals: [row({})] })).toHaveLength(1)
    expect(parseReviewedFestivals(null)).toEqual([])
    expect(parseReviewedFestivals({})).toEqual([])
  })

  it("loses only the bad part of a bad record", () => {
    const [f] = parseReviewedFestivals([row({ dates: { "2026": "2026-02-31", "2027": "2027-03-05" }, songs: [3, "x", 3, -1, 4.5, 7] })])
    expect(f.dates).toEqual([{ year: 2027, month: 3, day: 5 }])
    expect(f.songs).toEqual([3, 7])
    expect(parseReviewedFestivals([{ name_en: "no id" }])).toEqual([])
  })

  it("marks the years after 2026 as expected when the file says derived or not verified, and only then", () => {
    const dates = { "2026": "2026-05-01", "2027": "2027-05-20" }
    expect([...parseReviewedFestivals([row({ dates, date_basis: "2026 official; 2027-28 derived" })])[0].derivedYears]).toEqual([2027])
    expect([...parseReviewedFestivals([row({ dates, date_basis: "2026 official; 2027-28 not verified" })])[0].derivedYears]).toEqual([2027])
    expect(parseReviewedFestivals([row({ dates, date_basis: "official-2026" })])[0].derivedYears.size).toBe(0)
  })

  it("maps the file's ids to the app calendar's", () => {
    const base = (id: string) => parseReviewedFestivals([row({ id })])[0].appBaseId
    expect(base("kiirtana-divas")).toBe("kiirtana")
    expect(base("sharadotsava-children")).toBe("sharadotsava")
    expect(base("new-years-day")).toBeNull()
    expect(base("diipavalii")).toBe("diipavalii")
  })

  it("the bundled file parses and every festival in it has a date", () => {
    expect(REVIEWED_FESTIVALS.length).toBeGreaterThan(10)
    for (const f of REVIEWED_FESTIVALS) expect(f.dates.length, f.id).toBeGreaterThan(0)
  })
})

describe("the card window", () => {
  it("opens two days before, stays the day before and on the day, closes the next morning", () => {
    expect(CARD_LEAD_DAYS).toBe(2)
    expect(cardPhase(3)).toBeNull()
    expect(cardPhase(2)).toBe("soon")
    expect(cardPhase(1)).toBe("tomorrow")
    expect(cardPhase(0)).toBe("today")
    expect(cardPhase(-1)).toBeNull()
  })

  const one = parseReviewedFestivals([row({})])
  const noSongs = () => ({ listed: [], composed: [], all: [] })
  const withSongs = () => ({ listed: [], composed: [], all: [{ number: 1, basis: "list" as const, list: null }] })

  it("goes by calendar days: at 00:05 two days before it is already the card, at 23:55 three days before it is not", () => {
    expect(todayFestivalCards(at(2026, 11, 6, 0), 2, one, [], withSongs).map((c) => c.phase)).toEqual(["soon"])
    expect(todayFestivalCards(at(2026, 11, 5, 23), 2, one, [], withSongs)).toEqual([])
    expect(todayFestivalCards(at(2026, 11, 7), 2, one, [], withSongs).map((c) => c.phase)).toEqual(["tomorrow"])
    expect(todayFestivalCards(at(2026, 11, 8, 23), 2, one, [], withSongs).map((c) => c.phase)).toEqual(["today"])
    expect(todayFestivalCards(at(2026, 11, 9), 2, one, [], withSongs)).toEqual([])
  })

  it("shows a card ONLY for a festival that has songs", () => {
    const empty = parseReviewedFestivals([row({ songs: [] })])
    expect(todayFestivalCards(at(2026, 11, 7), 2, empty, [], withSongs)).toEqual([])
    expect(todayFestivalCards(at(2026, 11, 7), 2, one, [], noSongs)).toEqual([])
  })

  it("puts the nearest first and keeps at most `limit`", () => {
    const two = parseReviewedFestivals([row({ id: "b", dates: { "2026": "2026-11-09" } }), row({ id: "a", dates: { "2026": "2026-11-08" } })])
    expect(todayFestivalCards(at(2026, 11, 7), 5, two, [], withSongs).map((c) => c.id)).toEqual(["a-2026", "b-2026"])
    expect(todayFestivalCards(at(2026, 11, 7), 1, two, [], withSongs)).toHaveLength(1)
  })

  it("looks across the new year (31 December sees 1 January)", () => {
    const ny = parseReviewedFestivals([row({ id: "new-years-day", dates: { "2026": "2026-01-01", "2027": "2027-01-01" } })])
    const cards = todayFestivalCards(at(2026, 12, 30), 2, ny, [], withSongs)
    expect(cards.map((c) => [c.year, c.phase])).toEqual([[2027, "soon"]])
    expect(cards[0].pageId).toBeNull()
  })

  it("links the festival page only when the app calendar has that festival on that very date", () => {
    const cal = festivalCalendar.find((f) => f.id === "diipavalii-2026")!
    const d = parseReviewedFestivals([row({ id: "diipavalii", dates: { "2026": "2026-11-08" } })])
    expect(todayFestivalCards(at(2026, 11, 6), 2, d, festivalCalendar, withSongs)[0].pageId).toBe(cal.id)
    const moved = parseReviewedFestivals([row({ id: "diipavalii", dates: { "2026": "2026-11-09" } })])
    expect(todayFestivalCards(at(2026, 11, 7), 2, moved, festivalCalendar, withSongs)[0].pageId).toBeNull()
  })
})

describe("the real data on the days around Diipavalii 2026", () => {
  it("shows Diipavalii two days before, with the reviewed songs first", () => {
    const cards = todayFestivalCards(at(2026, 11, 6))
    const diipavalii = cards.find((c) => c.id === "diipavalii-2026")!
    expect(diipavalii.phase).toBe("soon")
    expect(diipavalii.daysUntil).toBe(2)
    expect(diipavalii.pageId).toBe("diipavalii-2026")
    expect(diipavalii.songs.all.slice(0, 3).map((s) => s.number)).toEqual([...reviewedSongsFor("diipavalii-2026")].slice(0, 3))
    expect(diipavalii.songs.listed.every((s) => s.basis === "list")).toBe(true)
  })

  it("shows no card on 10 November 2026: the festival of the next day has no confirmed songs", () => {
    expect(todayFestivalCards(at(2026, 11, 10)).map((c) => c.id)).not.toContain("bhratrdvitiya-2026")
  })

  it("its page and its card give the same list", () => {
    const cal = festivalCalendar.find((f) => f.id === "diipavalii-2026")!
    const card = todayFestivalCards(at(2026, 11, 8)).find((c) => c.id === "diipavalii-2026")!
    expect(card.songs.all.map((s) => s.number)).toEqual(songsForFestival(cal).all.map((s) => s.number))
  })

  it("lists a festival's reviewed songs as its own list, replacing the older built-in list", () => {
    const navavarsa = festivalCalendar.find((f) => f.id === "navavarsa-2026")!
    expect(songsForFestival(navavarsa).listed.map((s) => s.number)).toEqual([...reviewedSongsFor("navavarsa-2026")])
  })

  it("names the festival in the language on screen", () => {
    const [card] = todayFestivalCards(at(2026, 11, 6)).filter((c) => c.id === "diipavalii-2026")
    expect(festivalCardTitle(card, "en")).toBe("Diipavalii")
    const sh = { id: "sharadotsava-children-2026", nameEn: "Sharadotsava / Children's Day (6th day)", nameRu: "Шарадотсава" }
    expect(festivalCardTitle(sh, "ru")).toBe("Шарадотсава и День детей")
    const ny = { id: "new-years-day-2027", nameEn: "New Year's Day", nameRu: "Новый год (1 января)" }
    expect(festivalCardTitle(ny, "ru")).toBe("Новый год")
    expect(festivalCardTitle(ny, "es")).toBe("New Year's Day")
  })

  it("lists up to three songs when the festival has a page, five when it has none", () => {
    const song = (n: number) => ({ number: n, basis: "list" as const, list: null })
    const songs = { listed: [1, 2, 3, 4, 5, 6].map(song), composed: [], all: [1, 2, 3, 4, 5, 6].map(song) }
    const base = { id: "x", year: 2026, month: 1, day: 1, daysUntil: 1, phase: "tomorrow" as const, expected: false, nameEn: "", nameRu: "", songs }
    expect(cardPreviewSongs({ ...base, pageId: "x-2026" })).toHaveLength(3)
    expect(cardPreviewSongs({ ...base, pageId: null })).toHaveLength(5)
  })
})
