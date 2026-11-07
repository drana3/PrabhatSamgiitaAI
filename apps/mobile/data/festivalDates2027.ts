import type { UpcomingFestival } from "./festivals"

/**
 * Dates for 2027 and 2028 that were added after the first calendar pass (see docs/festival-calendar.md).
 *
 * Every date here comes from the official Ananda Marga material, none from memory:
 * - "fixed-civil-date": the official AMPS India festival list (india.anandamarga.org/ananda-marga-festivals-imp-days)
 *   gives the same civil date in 2024, 2025 and 2026, so the date is carried over.
 * - "lunar-derived": the rule from Ananda Marga Caryacarya part 1, chapter 21, applied with the official
 *   fasting calendar (anandamarga.org/practices/fasting-calendar, dates for India) as the cross-check.
 *   The rule was tested against the official 2024, 2025 and 2026 dates and reproduced all of them
 *   (see docs/festival-calendar.md for the rule and the test table). These dates are computed, not
 *   published yet. Set FESTIVAL_DATES_INCLUDE_LUNAR_DERIVED to false to hide them again.
 *
 * All dates are civil dates in India (IST), as the official calendar publishes them. A festival that is not
 * in this file has no confirmed date and stays hidden.
 */
export type FestivalDateBasis = "fixed-civil-date" | "lunar-derived"

export type ExtraFestivalDate = {
  /** Same id base as the 2026 entry in data/festivals.ts (id is `${idBase}-${year}`). */
  idBase: string
  year: 2027 | 2028
  month: number
  day: number
  basis: FestivalDateBasis
}

/** Flip to false to publish only dates that the official lists already repeat year after year. */
export const FESTIVAL_DATES_INCLUDE_LUNAR_DERIVED = true

/** Time zone of every date in this file. The official fasting calendar is published for India. */
export const FESTIVAL_DATES_TIME_ZONE = "Asia/Kolkata"

const fixed = (idBase: string, month: number, day: number): ExtraFestivalDate[] => [
  { idBase, year: 2027, month, day, basis: "fixed-civil-date" },
  { idBase, year: 2028, month, day, basis: "fixed-civil-date" },
]

const lunar = (idBase: string, y2027: [number, number], y2028: [number, number]): ExtraFestivalDate[] => [
  { idBase, year: 2027, month: y2027[0], day: y2027[1], basis: "lunar-derived" },
  { idBase, year: 2028, month: y2028[0], day: y2028[1], basis: "lunar-derived" },
]

export const EXTRA_FESTIVAL_DATES: ReadonlyArray<ExtraFestivalDate> = [
  // Same civil date in the official lists of 2024, 2025 and 2026.
  ...fixed("niilakantha", 2, 12),
  ...fixed("dadhicii", 3, 5),
  ...fixed("prout-day", 6, 5),
  ...fixed("kaoshiki", 9, 6),
  ...fixed("kiirtana", 10, 8),
  // Lunar: full moon of Vaeshakha, udaya tithi at Kolkata sunrise.
  ...lunar("ananda-purnima", [5, 20], [5, 8]),
  // Lunar: full moon of Shravana, udaya tithi at Kolkata sunrise.
  ...lunar("shravanii", [8, 17], [8, 5]),
  // Lunar: Vijayotsava is the dashamii of the bright fortnight of Ashvina (aparahna rule); the four earlier
  // days of Sharadotsava run on the days before it (6th to 10th day).
  ...lunar("sharadotsava", [10, 5], [9, 23]),
  ...lunar("public-day", [10, 6], [9, 24]),
  ...lunar("fine-arts", [10, 7], [9, 25]),
  ...lunar("music-day", [10, 8], [9, 26]),
  ...lunar("vijayotsava", [10, 9], [9, 27]),
  // Lunar: the new moon of Karttika, amavasya prevailing at dusk (pradosha).
  ...lunar("diipavalii", [10, 29], [10, 17]),
]

/** Observances still without a confirmed 2027 and 2028 date (kept hidden), with the reason. */
export const FESTIVAL_DATES_STILL_HIDDEN: ReadonlyArray<{ idBase: string; reason: string }> = [
  { idBase: "vasantotsava", reason: "Official 2026 date (4 Mar) differs from the full-moon rule that fits 2024 and 2025" },
  { idBase: "navavarsa", reason: "Official lists give 14 Apr, 15 Apr, 14 Apr (2024 to 2026); no rule reproduces them" },
  { idBase: "navanna", reason: "Any full-moon day of the local harvest season; official dates move between seasons" },
  { idBase: "bhratrdvitiya", reason: "Official offsets from Diipavalii are 2, 3 and 3 days; no single rule reproduces 2024 to 2026" },
]

/**
 * Builds calendar entries from the reviewed 2026 entries (title, subtitle, mood and collection label are
 * reused, only the date changes). Entries whose 2026 template is missing are skipped, never invented.
 */
export function extraFestivalsFrom(templates: ReadonlyArray<UpcomingFestival>): UpcomingFestival[] {
  const out: UpcomingFestival[] = []
  for (const entry of EXTRA_FESTIVAL_DATES) {
    if (entry.basis === "lunar-derived" && !FESTIVAL_DATES_INCLUDE_LUNAR_DERIVED) continue
    const template = templates.find((item) => item.id === `${entry.idBase}-2026`)
    if (!template) continue
    const { id: _id, year: _year, month: _month, day: _day, ...rest } = template
    out.push({
      ...rest,
      id: `${entry.idBase}-${entry.year}`,
      year: entry.year,
      month: entry.month,
      day: entry.day,
      // a computed date is shown as "expected", with the reason, never like a published one
      ...(entry.basis === "lunar-derived" ? { expected: true } : {}),
    })
  }
  return out
}
