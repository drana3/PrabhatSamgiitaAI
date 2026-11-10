import reviewedFile from "@/data/festivalsReviewed.json"

/**
 * The reviewed festival list: dates for 2026 to 2028 and the Prabhat Samgiita songs Dada confirmed for each festival.
 * It is a DATA LAYER: the one file `data/festivalsReviewed.json` (a copy of Carousel/Для-Дады/коллекции-пс/festivals.json,
 * refreshed by `node scripts/syncReviewedFestivals.mjs`) feeds everything below, so the final file replaces it without
 * touching the code. Pure, no React, no storage.
 *
 * The parser takes the file as it is delivered: a bare list, or an object with a `festivals` list. A record that is
 * malformed (no id, a broken date, a song that is not a number) loses only the bad part; a festival with no songs stays
 * in the list with an empty `songs` and the screens show nothing for it (nothing is made up).
 */

export type ReviewedDate = { year: number; month: number; day: number }

export type ReviewedFestival = {
  /** the id in the reviewed file ("diipavalii", "sharadotsava-children") */
  id: string
  /** the id base the app calendar (data/festivals.ts) uses for the same festival, or null when the app has none ("new-years-day") */
  appBaseId: string | null
  nameEn: string
  nameRu: string
  dates: readonly ReviewedDate[]
  /** reviewed song numbers, in the file's order; empty = no confirmed songs yet */
  songs: readonly number[]
  /** the date of a year other than 2026 is worked out by the rule, not published yet (the screens say "Expected date") */
  derivedYears: ReadonlySet<number>
}

/** Reviewed-file id -> app calendar id base, where they differ. `null`: the app calendar has no such festival. */
const APP_BASE_ALIASES: Readonly<Record<string, string | null>> = {
  "kiirtana-divas": "kiirtana",
  "sharadotsava-children": "sharadotsava",
  "fine-arts-day": "fine-arts",
  "new-years-day": null,
}

function parseDate(year: string, value: unknown): ReviewedDate | null {
  if (typeof value !== "string") return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m || m[1] !== year) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const check = new Date(y, mo - 1, d)
  if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== d) return null
  return { year: y, month: mo, day: d }
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function parseReviewedFestivals(input: unknown): ReviewedFestival[] {
  const list: unknown = Array.isArray(input) ? input : (input as { festivals?: unknown } | null)?.festivals
  if (!Array.isArray(list)) return []
  const out: ReviewedFestival[] = []
  for (const raw of list) {
    const r = raw as Record<string, unknown> | null
    const id = str(r?.id)
    if (!r || !id) continue
    const dates: ReviewedDate[] = []
    const dateMap = (r.dates ?? {}) as Record<string, unknown>
    for (const year of Object.keys(dateMap).sort()) {
      const date = parseDate(year, dateMap[year])
      if (date) dates.push(date)
    }
    const songs: number[] = []
    for (const n of Array.isArray(r.songs) ? r.songs : []) {
      if (typeof n === "number" && Number.isInteger(n) && n > 0 && !songs.includes(n)) songs.push(n)
    }
    // "2026 official; 2027-28 derived" (or "not verified"): every year after the first is computed. A plain "official-2026" has no such years.
    const derived = /derived|not verified/i.test(str(r.date_basis))
    out.push({
      id,
      appBaseId: id in APP_BASE_ALIASES ? APP_BASE_ALIASES[id] : id,
      nameEn: str(r.name_en) || id,
      nameRu: str(r.name_ru),
      dates,
      songs,
      derivedYears: new Set(derived ? dates.filter((d) => d.year > 2026).map((d) => d.year) : []),
    })
  }
  return out
}

export const REVIEWED_FESTIVALS: readonly ReviewedFestival[] = parseReviewedFestivals(reviewedFile)

/** "ru-day-2027" is "ru-day". */
function baseOf(appId: string): string {
  return appId.replace(/-\d{4}$/, "")
}

/** The confirmed songs of an app calendar festival (any year of its id), or [] when the reviewed file has none for it. */
export function reviewedSongsFor(appFestivalId: string, source: readonly ReviewedFestival[] = REVIEWED_FESTIVALS): readonly number[] {
  const base = baseOf(appFestivalId)
  return source.find((f) => f.appBaseId === base)?.songs ?? []
}
