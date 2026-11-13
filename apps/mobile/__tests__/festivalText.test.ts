import { describe, expect, it } from "vitest"

import { festivalCalendar } from "@/data/festivals"
import { festivalBaseId, festivalText } from "@/lib/i18n/festivalText"
import { festivalCaptionsEs, festivalCaptionsRu } from "@/locales/festivals"

describe("festival captions", () => {
  it("every festival in the calendar has a Russian and a Spanish caption", () => {
    const bases = [...new Set(festivalCalendar.map((item) => festivalBaseId(item.id)))]
    for (const base of bases) {
      expect(festivalCaptionsRu[base], `ru ${base}`).toBeTruthy()
      expect(festivalCaptionsEs[base], `es ${base}`).toBeTruthy()
    }
  })

  it("has no caption for a festival the calendar does not list", () => {
    const bases = new Set(festivalCalendar.map((item) => festivalBaseId(item.id)))
    for (const key of [...Object.keys(festivalCaptionsRu), ...Object.keys(festivalCaptionsEs)]) {
      expect(bases.has(key), key).toBe(true)
    }
  })

  it("keeps English as the calendar has it, and uses the same caption for every year", () => {
    const item = festivalCalendar.find((entry) => entry.id.startsWith("ru-day-"))!
    expect(festivalText(item, "en")).toEqual({ title: item.title, subtitle: item.subtitle })
    const later = festivalCalendar.find((entry) => entry.id === "ru-day-2027")!
    expect(festivalText(later, "ru")).toEqual(festivalText(item, "ru"))
    expect(festivalText(item, "ru").subtitle).not.toBe(item.subtitle)
  })

  it("keeps Sanskrit names and falls back to English for an unknown festival", () => {
    const diipa = festivalCalendar.find((entry) => entry.id === "diipavalii-2026")!
    expect(festivalText(diipa, "es").title).toBe(diipa.title)
    const unknown = { id: "new-thing-2026", title: "New", subtitle: "Sub" }
    expect(festivalText(unknown, "ru")).toEqual({ title: "New", subtitle: "Sub" })
  })

  it("spells Kiirtan with two i's", () => {
    const all = JSON.stringify([festivalCaptionsRu, festivalCaptionsEs])
    expect(all).not.toMatch(/Kirtan|Kiertan/)
  })
})
