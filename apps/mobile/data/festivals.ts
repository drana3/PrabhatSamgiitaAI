import { formatDate } from "@/lib/i18n/format"

import { extraFestivalsFrom } from "./festivalDates2027"

export type UpcomingFestival = {
  id: string
  title: string
  subtitle: string
  month: number
  day: number
  year: number
  /** Must match a label in data/collections when set. */
  relatedCollectionLabel?: string
  /** True when the date is worked out from the lunar rule and the official calendar has not published it (data/festivalDates2027.ts). The screens say so. */
  expected?: boolean
  mood?: string
}

/**
 * The calendar lists dates only when they are known:
 * - 2026: reviewed observance by observance (the same list as the website).
 * - 2027 and 2028: only observances that fall on the same civil date every year. Lunar and
 *   festival dates are never guessed (same policy as apps/api domain_catalog.py), so those are
 *   not listed at all until Dada confirms them. FESTIVAL_DATES_TO_CONFIRM names them; the
 *   screens never show it. docs/festival-calendar.md is the hand-off list.
 */
export const FESTIVAL_CALENDAR_LAST_YEAR = 2028

/** Reviewed calendar year — lunar dates are not auto-rolled (same policy as website). */
export const REVIEWED_FESTIVAL_YEAR = 2026

/**
 * Reviewed 2026 observances aligned with apps/web/lib/recommendation-presets.ts.
 * Collection labels match apps/mobile/data/collections where a curated path exists.
 */
export const festivalCalendar2026: UpcomingFestival[] = [
  {
    id: "ru-day-2026",
    title: "R.U. Day",
    subtitle: "A service-minded set of songs for collective action and uplift.",
    month: 1,
    day: 25,
    year: 2026,
    mood: "courageous",
  },
  {
    id: "niilakantha-2026",
    title: "Niilakanth'a Divasa",
    subtitle: "Songs for deep remembrance and inward stillness.",
    month: 2,
    day: 12,
    year: 2026,
    mood: "devotional",
  },
  {
    id: "vasantotsava-2026",
    title: "Vasantotsava",
    subtitle: "A bright seasonal mood for renewal and tenderness.",
    month: 3,
    day: 4,
    year: 2026,
    mood: "joyful",
  },
  {
    id: "dadhicii-2026",
    title: "Dadhicii Divas",
    subtitle: "Songs of courage, dedication, and selfless service.",
    month: 3,
    day: 5,
    year: 2026,
    mood: "courageous",
  },
  {
    id: "navavarsa-2026",
    title: "Navavarsa",
    subtitle: "A hopeful selection for a new year and new beginnings.",
    month: 4,
    day: 14,
    year: 2026,
    mood: "hopeful",
  },
  {
    id: "ananda-purnima-2026",
    title: "Ánanda Purnimá",
    subtitle: "A luminous set for joyful full-moon meditation — Bábá’s birthday.",
    month: 5,
    day: 1,
    year: 2026,
    relatedCollectionLabel: "Bábá Birthday Songs",
    mood: "joyful",
  },
  {
    id: "prout-day-2026",
    title: "PROUT Day",
    subtitle: "Songs that carry vision, dignity, and social uplift.",
    month: 6,
    day: 5,
    year: 2026,
    mood: "hopeful",
  },
  {
    id: "shravanii-2026",
    title: "Shrávanii Purnimá",
    subtitle: "A reflective selection for late-rainy-season devotion.",
    month: 8,
    day: 28,
    year: 2026,
    mood: "reflective",
  },
  {
    id: "kaoshiki-2026",
    title: "Kaoshiki Divas",
    subtitle: "Uplifting songs for movement and mantra.",
    month: 9,
    day: 6,
    year: 2026,
    mood: "energetic",
  },
  {
    id: "ps-divasa-2026",
    title: "Prabháta Saḿgiita Divasa",
    subtitle: "Honoring the songs themselves and their breadth.",
    month: 9,
    day: 14,
    year: 2026,
    mood: "devotional",
  },
  {
    id: "sharadotsava-2026",
    title: "Sharadotsava and Children's Day",
    subtitle: "S'as't'hii · exhibitions, sports, and collective feasts for children.",
    month: 10,
    day: 16,
    year: 2026,
    relatedCollectionLabel: "Children Songs",
    mood: "joyful",
  },
  {
    id: "public-day-2026",
    title: "Public Day",
    subtitle: "Saptamii · youth health and adult strength exhibitions.",
    month: 10,
    day: 17,
    year: 2026,
    mood: "hopeful",
  },
  {
    id: "fine-arts-2026",
    title: "Fine Arts Day",
    subtitle: "As't'amii · literary meetings and fine arts exhibitions.",
    month: 10,
    day: 18,
    year: 2026,
    mood: "joyful",
  },
  {
    id: "music-day-2026",
    title: "Music Day",
    subtitle: "Navamii · instrumental music and dance.",
    month: 10,
    day: 19,
    year: 2026,
    mood: "joyful",
  },
  {
    id: "vijayotsava-2026",
    title: "Vijayotsava",
    subtitle: "Processions, táńd́ava, and the victory of benevolence.",
    month: 10,
    day: 20,
    year: 2026,
    mood: "courageous",
  },
  {
    id: "kiirtana-2026",
    title: "Kiirtana Divas",
    subtitle: "An uplifting selection for collective singing and devotion.",
    month: 10,
    day: 8,
    year: 2026,
    mood: "joyful",
  },
  {
    id: "navanna-2026",
    title: "Navánna",
    subtitle: "Songs of gratitude for harvest, nature, and shared abundance.",
    month: 10,
    day: 25,
    year: 2026,
    mood: "grateful",
  },
  {
    id: "diipavalii-2026",
    title: "Diipavalii",
    subtitle: "Songs of light, hope, and spiritual awakening.",
    month: 11,
    day: 8,
    year: 2026,
    relatedCollectionLabel: "Dipavali (Colour Festival) Day Songs",
    mood: "joyful",
  },
  {
    id: "bhratrdvitiya-2026",
    title: "Bhrátrdvitiiyá",
    subtitle: "A warm selection for affection, family, and human bonds.",
    month: 11,
    day: 11,
    year: 2026,
    mood: "loving",
  },
]

/** Observances held on the same civil date every year, so their 2027 and 2028 dates are computed, not guessed. */
const FIXED_DATE_OBSERVANCES: ReadonlyArray<Omit<UpcomingFestival, "id" | "year"> & { idBase: string }> = [
  {
    idBase: "ru-day",
    title: "R.U. Day",
    subtitle: "A service-minded set of songs for collective action and uplift.",
    month: 1,
    day: 25,
    mood: "courageous",
  },
  {
    idBase: "baba-birthday",
    title: "Bábá’s Birthday",
    subtitle: "Songs of gratitude and remembrance for the day Bábá was born.",
    month: 5,
    day: 21,
    relatedCollectionLabel: "Bábá Birthday Songs",
    mood: "devotional",
  },
  {
    idBase: "ps-divasa",
    title: "Prabháta Saḿgiita Divasa",
    subtitle: "Honoring the songs themselves and their breadth.",
    month: 9,
    day: 14,
    mood: "devotional",
  },
]

function fixedDateYear(year: number): UpcomingFestival[] {
  return FIXED_DATE_OBSERVANCES.map(({ idBase, ...rest }) => ({ ...rest, id: `${idBase}-${year}`, year }))
}

/** Dates added from the official Ananda Marga lists (data/festivalDates2027.ts). */
const EXTRA_DATE_FESTIVALS = extraFestivalsFrom(festivalCalendar2026)

/**
 * Observances whose 2027 and 2028 dates are not known yet (lunar or festival dates). They are NOT
 * in the calendar and never shown. The list exists so the gap is explicit and testable.
 */
export const FESTIVAL_DATES_TO_CONFIRM: ReadonlyArray<{ idBase: string; title: string; years: readonly number[] }> =
  festivalCalendar2026
    .filter((item) => !FIXED_DATE_OBSERVANCES.some((fixed) => item.id === `${fixed.idBase}-2026`))
    .filter((item) => !EXTRA_DATE_FESTIVALS.some((extra) => extra.id === item.id.replace(/-2026$/, "-2027")))
    .map((item) => ({ idBase: item.id.replace(/-2026$/, ""), title: item.title, years: [2027, 2028] }))

function byDate(a: UpcomingFestival, b: UpcomingFestival) {
  return a.year - b.year || a.month - b.month || a.day - b.day
}

/** Everything the app can show, oldest first: the reviewed 2026 list plus the computed fixed dates through 2028. */
export const festivalCalendar: UpcomingFestival[] = [
  ...festivalCalendar2026,
  ...fixedDateYear(2027),
  ...fixedDateYear(2028),
  ...EXTRA_DATE_FESTIVALS,
].sort(byDate)

function daysUntil(now: Date, month: number, day: number, year: number) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(year, month - 1, day)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export type FestivalListItem = UpcomingFestival & {
  daysUntil: number
  dateLabel: string
}

export function getFestivalById(festivalId: string): UpcomingFestival | null {
  return festivalCalendar.find((item) => item.id === festivalId) ?? null
}

export function getUpcomingFestivals(now = new Date(), limit = 4): FestivalListItem[] {
  return festivalCalendar
    .map((item) => ({
      ...item,
      daysUntil: daysUntil(now, item.month, item.day, item.year),
      dateLabel: formatDate(new Date(item.year, item.month - 1, item.day), item.year !== now.getFullYear() ? "medium" : "dayMonth"),
    }))
    .filter((item) => item.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, limit)
}

export function festivalCalendarExhausted(now = new Date()) {
  return getUpcomingFestivals(now, festivalCalendar.length).length === 0
}

export const todayContext = {
  modeLabel: "Daily reflection",
  reason: "Selected for today’s quiet devotion and seasonal mood.",
  observance: null as string | null,
}
