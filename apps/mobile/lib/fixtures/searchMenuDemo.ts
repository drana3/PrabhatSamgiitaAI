import { KIRTAN_FIXTURES } from "@/lib/fixtures/kirtan"
import { makeEntry, type HistoryEntry } from "@/lib/listening/history"
import type { Kirtan } from "@/lib/kirtan/types"
import type { MenuKirtan } from "@/lib/searchMenu/live"

/**
 * Preview only (MOCKUP_DATA): a sample LIBRARY for the Search menu, so category discovery can be seen without a server. The
 * menu hook reads it exactly as it reads the real library: nothing here says which shelves exist, the shelves are found in
 * these recordings. Stages are different libraries: `new` (empty), `early`, `grown`, `nobaba` (grown without Baba's Audio
 * Discourses: no Baba shelf), `newstyle` (nobaba plus three Kiirtans of a style nobody listed and some extra tags: new
 * shelves appear by themselves). Every title says "Demo"; nothing here is a real recording. Real builds never import this
 * into the menu (MOCKUP_DATA only); the shared sample lists (`KIRTAN_FIXTURES`) stay as they are.
 * TODO(api): styles come from the recording's `style` field, moods from confirmed tags, other tags from the facets the API sends.
 */

export type MenuStage = "new" | "early" | "grown" | "nobaba" | "newstyle"

export function parseStage(value: unknown): MenuStage | null {
  return value === "new" || value === "early" || value === "grown" || value === "nobaba" || value === "newstyle" ? value : null
}

/** Does the sample library of this stage hold Baba's Audio Discourses? */
export function stageHasBaba(stage: MenuStage): boolean {
  return stage === "early" || stage === "grown"
}

const DAY = 86_400_000
const T0 = Date.UTC(2026, 10, 1)

const baba = (n: number, place: string, ago: number, plays: number): Kirtan => ({
  id: `ba-sample-${n}`,
  kind: "baba_audio",
  audioUrl: null,
  title: `Demo discourse ${n}`,
  author: "",
  durationSec: (18 + n * 7) * 60,
  type: "other",
  thumbnailUrl: null,
  addedBy: "Ananda Marga team",
  status: "published",
  addedAt: T0 - ago * DAY,
  plays,
  language: "english",
  place,
})

export const DEMO_BABA: readonly Kirtan[] = [baba(1, "Ranchi", 2, 340), baba(2, "Kolkata", 9, 210), baba(3, "Ananda Nagar", 21, 95)]

const STYLES: Record<string, string> = {
  "k-bnk-morning": "bengali",
  "k-bnk-evening": "bengali",
  "k-lila-krishna": "bengali",
  "k-bnk-night": "bengali",
  "k-bnk-short": "hindi",
  "k-dipavali": "hindi",
  "k-purnima": "hindi",
  "k-lila-shiva": "folk",
  "k-lila-radha": "folk",
  "k-akhanda": "folk",
  "k-other-morning-raga": "dhrupad",
}

/** Five moods reach the threshold of five tags, "sad" stays under it on purpose (the menu hides what is not backed). */
const MOODS: Record<string, readonly string[]> = {
  "k-dipavali": ["joyful", "ecstatic"],
  "k-purnima": ["joyful", "ecstatic"],
  "b-festival-lamps": ["joyful"],
  "k-akhanda": ["joyful", "ecstatic"],
  "k-bnk-morning": ["joyful", "devotion"],
  "b-morning-harmonium": ["joyful"],
  "k-lila-radha": ["longing", "devotion", "sad"],
  "b-sweetest-word": ["longing", "devotion"],
  "b-evening-request": ["longing"],
  "k-bnk-night": ["longing", "calm"],
  "d-evening-prayer": ["longing", "calm"],
  "k-bnk-sleep": ["calm"],
  "k-night-meditation": ["calm"],
  "b-day-will-dawn": ["calm"],
  "k-other-morning-raga": ["calm"],
  "k-lila-krishna": ["ecstatic"],
  "k-bnk-evening": ["ecstatic"],
  "k-lila-shiva": ["devotion"],
  "k-bnk-short": ["devotion"],
  "b-once-there-was": ["devotion"],
  "b-many-thousand-years": ["sad"],
}

/** Three Kiirtans in a style no list names: they let the preview show a shelf found from the data alone. */
const DEMO_BAUL: readonly Kirtan[] = [1, 2, 3].map((n) => ({
  ...KIRTAN_FIXTURES[0],
  id: `demo-baul-${n}`,
  title: `Demo Baul kiirtan ${n}`,
  author: "Demo Baul group",
  style: "other",
  styleOther: n === 2 ? "baul" : "Baul",
  addedAt: T0 - (n + 3) * DAY,
  plays: 20 * n,
}))

/** Extra tags of the sample library (solo or group): nothing lists them, the menu finds them. */
const TAGS: Record<string, Record<string, readonly string[]>> = {
  "k-bnk-night": { performance: ["group"] },
  "k-bnk-sleep": { performance: ["group"] },
  "k-night-meditation": { performance: ["group"] },
  "k-akhanda": { performance: ["group"] },
  "k-bnk-short": { performance: ["solo"] },
  "k-lila-shiva": { performance: ["solo"] },
  "k-bnk-evening": { performance: ["solo"] },
}

/** The catalogue the preview menu reads at a stage (`base` = the shared samples). `base` is what the app holds (the shared samples in the preview). */
export function demoCatalog(base: readonly Kirtan[], stage: MenuStage): MenuKirtan[] {
  // "new": a fresh install, no recording yet. "early": one recording and Baba's three discourses. "grown": everything.
  if (stage === "new") return []
  if (stage === "early") return [...base.slice(0, 1), ...DEMO_BABA]
  const withBaba = stageHasBaba(stage)
  const list: MenuKirtan[] = [...base, ...(withBaba ? DEMO_BABA : []), ...(stage === "newstyle" ? DEMO_BAUL : [])]
  return list.map((k) => ({
    ...k,
    ...(k.style ? {} : { style: STYLES[k.id] ?? null }),
    moods: MOODS[k.id] ?? null,
    tags: stage === "newstyle" ? (TAGS[k.id] ?? null) : null,
  }))
}

/** Recordings by id, for "play again" from the sample history (the shared samples plus the sample discourses). */
export function demoKirtanById(id: string): Kirtan | null {
  return [...KIRTAN_FIXTURES, ...DEMO_BABA].find((k) => k.id === id) ?? null
}

const rec = (id: string, daysAgo: number, hour: number, now: number): HistoryEntry => {
  const k = demoKirtanById(id)
  const day = new Date(now - daysAgo * DAY)
  const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 12).getTime()
  return makeEntry({ ref: "rec", itemId: id, title: k?.title ?? id, kind: k?.kind ?? "kiirtan", author: k?.author ?? "", ...(k?.language ? { language: k.language } : {}), at })
}
const ps = (n: number, title: string, daysAgo: number, hour: number, now: number): HistoryEntry => {
  const day = new Date(now - daysAgo * DAY)
  return makeEntry({ ref: "ps", itemId: String(n), title, kind: "prabhat_samgiita", at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 40).getTime() })
}

/** A sample history for the "grown" stage: today, yesterday and earlier, mixed kinds, newest first. */
export function demoHistory(stage: MenuStage, now: number): HistoryEntry[] {
  if (stage === "new" || stage === "early") return []
  const list = [
    rec("k-bnk-morning", 0, 7, now),
    rec("ba-sample-1", 0, 6, now),
    ps(1, "Bandhu He Niye Calo", 0, 5, now),
    rec("k-bnk-night", 1, 21, now),
    rec("b-sweetest-word", 1, 8, now),
    rec("k-night-meditation", 2, 22, now),
    rec("k-lila-radha", 3, 19, now),
    rec("k-bnk-evening", 4, 18, now),
    rec("b-morning-harmonium", 5, 7, now),
    rec("k-bnk-short", 6, 6, now),
    rec("k-bnk-morning", 8, 7, now),
  ]
  return (stageHasBaba(stage) ? list : list.filter((e) => e.kind !== "baba_audio")).sort((a, b) => b.at - a.at)
}
