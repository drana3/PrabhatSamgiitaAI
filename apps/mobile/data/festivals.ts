export type UpcomingFestival = {
  id: string
  title: string
  subtitle: string
  month: number
  day: number
  year: number
  /** Must match a label in data/collections when set. */
  relatedCollectionLabel?: string
  mood?: string
}

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
    subtitle: "Joy, creativity, and hope for every child.",
    month: 10,
    day: 1,
    year: 2026,
    relatedCollectionLabel: "Children Songs",
    mood: "joyful",
  },
  {
    id: "public-day-2026",
    title: "Public Day",
    subtitle: "Songs for collective welfare, dignity, and shared purpose.",
    month: 10,
    day: 2,
    year: 2026,
    mood: "hopeful",
  },
  {
    id: "fine-arts-2026",
    title: "Fine Arts Day",
    subtitle: "A lyrical selection celebrating beauty and creative expression.",
    month: 10,
    day: 3,
    year: 2026,
    mood: "joyful",
  },
  {
    id: "music-day-2026",
    title: "Music Day",
    subtitle: "Songs that feel especially musical, lyrical, and expansive.",
    month: 10,
    day: 4,
    year: 2026,
    mood: "joyful",
  },
  {
    id: "vijayotsava-2026",
    title: "Vijayotsava",
    subtitle: "Courage, hope, and the victory of benevolence.",
    month: 10,
    day: 5,
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
  return festivalCalendar2026.find((item) => item.id === festivalId) ?? null
}

export function getUpcomingFestivals(now = new Date(), limit = 4): FestivalListItem[] {
  return festivalCalendar2026
    .map((item) => ({
      ...item,
      daysUntil: daysUntil(now, item.month, item.day, item.year),
      dateLabel: new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: item.year !== now.getFullYear() ? "numeric" : undefined,
      }).format(new Date(item.year, item.month - 1, item.day)),
    }))
    .filter((item) => item.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, limit)
}

export function festivalCalendarExhausted(now = new Date()) {
  return getUpcomingFestivals(now, festivalCalendar2026.length).length === 0
}

export const todayContext = {
  modeLabel: "Daily reflection",
  reason: "Selected for today’s quiet devotion and seasonal mood.",
  observance: null as string | null,
}
