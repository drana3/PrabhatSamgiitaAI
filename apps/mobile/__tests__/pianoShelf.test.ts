import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/i18n", () => ({ t: (key: string) => key }))

import { withPianoFlag } from "@/lib/pianoNotes/flag"
import { aggregateRecordings } from "@/lib/searchMenu/aggregate"
import { MENU_RULES, MENU_TITLE_KEYS } from "@/lib/searchMenu/config"
import { isPianoKirtan, labelFromId, shelfItems, shelfTitle, toMenuRecording, type MenuKirtan } from "@/lib/searchMenu/live"
import { buildMenu } from "@/lib/searchMenu/rules"
import type { MenuRecording } from "@/lib/searchMenu/types"
import { en } from "@/locales/en"
import { es } from "@/locales/es"
import { ru } from "@/locales/ru"

/** The shelf "Kiirtan for piano": recordings with accepted piano notes, or whose lead instrument is the piano. One is enough. */

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 7)
let n = 0
const rec = (over: Partial<MenuRecording> = {}): MenuRecording => ({ kind: "kiirtan", type: "bnk", author: `Author ${n++}`, createdAt: NOW - 60 * DAY, ...over })
const kirtan = (over: Record<string, unknown> = {}): MenuKirtan =>
  ({ id: `k${n++}`, kind: "kiirtan", type: "bnk", title: "T", author: "A", addedAt: NOW - DAY, ...over }) as unknown as MenuKirtan
const menu = (recordings: MenuRecording[]) => buildMenu(aggregateRecordings(recordings, NOW, { psCollections: [{ kind: "mood", count: 6 }] }))
const ids = (recordings: MenuRecording[]) => menu(recordings).shelves.map((s) => s.id)

describe("Kiirtan for piano", () => {
  it("has no shelf without a piano recording and needs no pinning with one", () => {
    expect(ids([rec(), rec()])).not.toContain("kiirtan:piano")
    const on = menu([rec(), rec({ piano: true })])
    expect(on.shelves.find((s) => s.id === "kiirtan:piano")).toMatchObject({ count: 1, block: "kiirtan", label: { type: "key", key: "searchMenu.kiirtan.piano" } })
    expect(on.shelves.find((s) => s.id === "kiirtan:piano")?.reason).toBe("threshold")
  })

  it("follows its own knob and counts Kiirtans only", () => {
    expect(MENU_RULES.kiirtanPiano).toEqual({ on: 1, off: 1 })
    expect(ids([rec({ kind: "bhajan", piano: true })])).not.toContain("kiirtan:piano")
  })

  it("a recording counts through accepted notes or a piano lead instrument, read defensively", () => {
    expect(isPianoKirtan(kirtan({ piano: true }))).toBe(true)
    expect(isPianoKirtan(kirtan({ leadInstrument: "piano" }))).toBe(true)
    expect(isPianoKirtan(kirtan({ leadInstrument: "harmonium" }))).toBe(false)
    expect(isPianoKirtan(kirtan())).toBe(false)
    expect(toMenuRecording(kirtan({ leadInstrument: "piano" })).piano).toBe(true)
  })

  it("lists the same recordings that were counted, newest first", () => {
    const a = kirtan({ id: "a", piano: true, addedAt: NOW - 3 * DAY })
    const b = kirtan({ id: "b", leadInstrument: "piano", addedAt: NOW - DAY })
    const c = kirtan({ id: "c" })
    const bhajan = kirtan({ id: "d", kind: "bhajan", piano: true })
    const items = shelfItems("kiirtan:piano", [a, b, c, bhajan], { bhajanLanguages: {}, listener: undefined }, NOW)
    expect(items.map((k) => k.id)).toEqual(["b", "a"])
    expect(labelFromId("kiirtan:piano")).toEqual({ type: "key", key: "searchMenu.kiirtan.piano" })
    expect(shelfTitle({ id: "kiirtan:piano", label: { type: "key", key: "searchMenu.kiirtan.piano" } })).toBe("searchMenu.kiirtan.piano")
  })

  it("its title exists in every language and is spelled with two i's", () => {
    expect(MENU_TITLE_KEYS as readonly string[]).toContain("searchMenu.kiirtan.piano")
    for (const dict of [en, ru, es]) expect((dict as Record<string, string>)["searchMenu.kiirtan.piano"]).toBeTruthy()
    expect(en["searchMenu.kiirtan.piano"]).toBe("Kiirtan for piano")
    expect(es["searchMenu.kiirtan.piano"]).not.toMatch(/\bKirtan/)
  })
})

describe("withPianoFlag", () => {
  it("marks recordings whose id (or server id) has accepted notes and leaves the rest untouched", () => {
    const a = kirtan({ id: "local-1", serverId: "uuid-1" })
    const b = kirtan({ id: "uuid-2" })
    const c = kirtan({ id: "x" })
    const out = withPianoFlag([a, b, c], new Set(["uuid-1", "uuid-2"]))
    expect(out.map((k) => k.piano)).toEqual([true, true, undefined])
    expect(out[2]).toBe(c)
    const same = [a, b]
    expect(withPianoFlag(same, new Set())).toBe(same)
  })
})
