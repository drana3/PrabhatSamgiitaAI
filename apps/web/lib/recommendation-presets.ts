export type RecommendationPreset = {
  title: string
  subtitle: string
  festival?: string
  occasion?: string
  season?: string
  mood?: string
  language?: string
  difficulty?: string
  meditation_context?: string
  theme?: string
}

type FestivalObservation = {
  year?: number
  month: number
  day: number
  title: string
  subtitle: string
  festival?: string
  occasion?: string
  season?: string
  mood?: string
  language?: string
  difficulty?: string
  meditation_context?: string
  theme?: string
  windowDays?: number
}

export type UpcomingObservation = {
  title: string
  dateLabel: string
  daysUntil: number
  query: string
}

function seasonFromMonth(month: number) {
  if (month >= 3 && month <= 5) return "spring"
  if (month >= 6 && month <= 8) return "summer"
  if (month >= 9 && month <= 11) return "autumn"
  return "winter"
}

const festivalCalendar: FestivalObservation[] = [
  {
    year: 2026,
    month: 1,
    day: 25,
    title: "R.U. Day",
    subtitle: "A service-minded set of songs for collective action and uplift.",
    occasion: "service",
    season: "winter",
    mood: "courageous",
    language: "Roman",
    difficulty: "easy",
    meditation_context: "collective service",
  },
  {
    year: 2026,
    month: 2,
    day: 12,
    title: "Niilakanth'a Divasa",
    subtitle: "Songs for deep remembrance and inward stillness.",
    occasion: "meditation",
    season: "winter",
    mood: "devotional",
    language: "Roman",
    difficulty: "easy",
    meditation_context: "quiet meditation",
  },
  {
    year: 2026,
    month: 3,
    day: 4,
    title: "Vasantotsava",
    subtitle: "A bright seasonal mood for renewal and tenderness.",
    occasion: "celebration",
    season: "spring",
    mood: "joyful",
    language: "Roman",
    difficulty: "easy",
    meditation_context: "seasonal celebration",
  },
  {
    year: 2026,
    month: 3,
    day: 5,
    title: "Dadhicii Divas",
    subtitle: "Songs of courage, dedication, and selfless service.",
    occasion: "service",
    mood: "courageous",
    meditation_context: "selfless service",
  },
  {
    year: 2026,
    month: 4,
    day: 14,
    title: "Navavarsa",
    subtitle: "A hopeful selection for a new year and new beginnings.",
    occasion: "celebration",
    mood: "hopeful",
    meditation_context: "new year",
    festival: "New Year",
  },
  {
    year: 2026,
    month: 5,
    day: 1,
    title: "Ánanda Purnimá",
    subtitle: "A luminous devotional set for joyful full-moon meditation.",
    occasion: "meditation",
    season: "spring",
    mood: "joyful",
    language: "Roman",
    difficulty: "easy",
    meditation_context: "full-moon meditation",
    festival: "Bábá Birthday",
  },
  {
    year: 2026,
    month: 6,
    day: 5,
    title: "PROUT Day",
    subtitle: "Songs that carry vision, dignity, and social uplift.",
    occasion: "service",
    season: "summer",
    mood: "hopeful",
    language: "Roman",
    difficulty: "easy",
    meditation_context: "social transformation",
    theme: "PROUT",
  },
  {
    year: 2026,
    month: 8,
    day: 28,
    title: "Shrávanii Purnimá",
    subtitle: "A reflective selection for late-rainy-season devotion.",
    occasion: "meditation",
    season: "summer",
    mood: "reflective",
    language: "Roman",
    difficulty: "easy",
    meditation_context: "evening reflection",
    festival: "Shravanii Purnima Day",
  },
  {
    year: 2026,
    month: 9,
    day: 6,
    title: "Kaoshiki Divas",
    subtitle: "A rhythmic, uplifting recommendation for movement and mantra.",
    occasion: "practice",
    season: "autumn",
    mood: "energetic",
    language: "Roman",
    difficulty: "easy",
    meditation_context: "kaoshiki practice",
  },
  {
    year: 2026,
    month: 9,
    day: 14,
    title: "Prabháta Saḿgiita Divasa",
    subtitle: "Today’s selections honor the songs themselves and their devotional breadth.",
    festival: "Prabháta Saḿgiita Divasa",
    occasion: "meditation",
    season: "autumn",
    mood: "devotional",
    language: "Roman",
    difficulty: "easy",
    meditation_context: "Prabháta Saḿgiita Day",
  },
  {
    year: 2026,
    month: 10,
    day: 1,
    title: "Sharadotsava and Children's Day",
    subtitle: "Songs of joy, creativity, and hope for every child.",
    occasion: "celebration",
    mood: "joyful",
    meditation_context: "children and autumn festival",
    theme: "Children",
  },
  {
    year: 2026,
    month: 10,
    day: 2,
    title: "Public Day",
    subtitle: "Songs for collective welfare, dignity, and shared purpose.",
    occasion: "service",
    mood: "hopeful",
    meditation_context: "collective welfare",
  },
  {
    year: 2026,
    month: 10,
    day: 3,
    title: "Fine Arts Day",
    subtitle: "A lyrical selection celebrating beauty and creative expression.",
    occasion: "celebration",
    mood: "joyful",
    meditation_context: "fine arts celebration",
  },
  {
    year: 2026,
    month: 10,
    day: 4,
    title: "Music Day",
    subtitle: "Songs that feel especially musical, lyrical, and expansive.",
    occasion: "celebration",
    season: "autumn",
    mood: "joyful",
    language: "Roman",
    difficulty: "easy",
    meditation_context: "music celebration",
  },
  {
    year: 2026,
    month: 10,
    day: 5,
    title: "Vijayotsava",
    subtitle: "Songs of courage, hope, and the victory of benevolence.",
    occasion: "celebration",
    mood: "courageous",
    meditation_context: "victory celebration",
    festival: "Victory Day",
  },
  {
    year: 2026,
    month: 10,
    day: 8,
    title: "Kiirtana Divas",
    subtitle: "An uplifting selection for collective singing and devotion.",
    occasion: "celebration",
    mood: "joyful",
    meditation_context: "collective kiirtan",
  },
  {
    year: 2026,
    month: 10,
    day: 25,
    title: "Navánna",
    subtitle: "Songs of gratitude for harvest, nature, and shared abundance.",
    occasion: "celebration",
    mood: "grateful",
    meditation_context: "harvest gratitude",
  },
  {
    year: 2026,
    month: 11,
    day: 8,
    title: "Diipavalii",
    subtitle: "Songs of light, hope, and spiritual awakening.",
    occasion: "celebration",
    mood: "joyful",
    meditation_context: "festival of light",
    festival: "Dipavali (Colour Festival) Day",
  },
  {
    year: 2026,
    month: 11,
    day: 11,
    title: "Bhrátrdvitiiyá",
    subtitle: "A warm selection for affection, family, and human bonds.",
    occasion: "celebration",
    mood: "loving",
    meditation_context: "family observance",
  },
]

function isSameDay(now: Date, month: number, day: number, year?: number) {
  return (!year || now.getFullYear() === year) && now.getMonth() + 1 === month && now.getDate() === day
}

function daysUntil(now: Date, month: number, day: number, year?: number) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(year ?? now.getFullYear(), month - 1, day)
  if (!year && target.getTime() < today.getTime()) {
    target.setFullYear(target.getFullYear() + 1)
  }
  const diffMs = target.getTime() - today.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

export function getUpcomingObservances(now = new Date(), limit = 3): UpcomingObservation[] {
  return festivalCalendar
    .map((item) => ({ ...item, delta: daysUntil(now, item.month, item.day, item.year) }))
    .filter((item) => item.delta >= 0)
    .sort((left, right) => left.delta - right.delta)
    .slice(0, limit)
    .map((item) => ({
      title: item.title,
      dateLabel: new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(
        new Date(item.year ?? now.getFullYear() + (item.delta > 300 ? 1 : 0), item.month - 1, item.day),
      ),
      daysUntil: item.delta,
      query: `Search Prabhat Samgiita for ${item.title}${item.festival && item.festival !== item.title ? ` ${item.festival}` : ""}${item.theme ? ` ${item.theme}` : ""}`,
    }))
}

function festivalPresetForDate(now: Date): RecommendationPreset | null {
  const observed = festivalCalendar.find((item) => isSameDay(now, item.month, item.day, item.year))
  if (!observed) {
    return null
  }

  const season = observed.season ?? seasonFromMonth(now.getMonth() + 1)
  return {
    title: observed.title,
    subtitle: observed.subtitle,
    festival: observed.festival ?? observed.title,
    occasion: observed.occasion,
    season,
    mood: observed.mood,
    language: observed.language,
    difficulty: observed.difficulty,
    meditation_context: observed.meditation_context,
    theme: observed.theme,
  }
}

function upcomingFestivalPreset(now: Date, windowDays = 14): RecommendationPreset | null {
  const upcoming = festivalCalendar
    .map((item) => ({ ...item, delta: daysUntil(now, item.month, item.day, item.year) }))
    .filter((item) => item.delta > 0 && item.delta <= windowDays)
    .sort((left, right) => left.delta - right.delta)[0]

  if (!upcoming) {
    return null
  }

  return {
    title: `Leading into ${upcoming.title}`,
    subtitle: `${upcoming.subtitle} The event is coming up soon, so the set leans in that direction.`,
    festival: upcoming.festival ?? upcoming.title,
    occasion: upcoming.occasion,
    season: upcoming.season ?? seasonFromMonth(now.getMonth() + 1),
    mood: upcoming.mood,
    language: upcoming.language,
    difficulty: upcoming.difficulty,
    meditation_context: upcoming.meditation_context,
    theme: upcoming.theme,
  }
}

export function getAutoRecommendationPreset(now = new Date()): RecommendationPreset {
  const month = now.getMonth() + 1
  const hour = now.getHours()
  const season = seasonFromMonth(month)
  const festivalPreset = festivalPresetForDate(now)
  const upcomingFestival = upcomingFestivalPreset(now)
  const isMorning = hour < 12
  const isEvening = hour >= 17

  if (festivalPreset) {
    return festivalPreset
  }

  if (upcomingFestival) {
    return upcomingFestival
  }

  return {
    title: "Today’s devotional mood",
    subtitle: isMorning
      ? "Set for a calm morning listening session."
      : isEvening
        ? "Set for an evening reflection session."
        : "Set for a calm, reflective listening session.",
    occasion: "meditation",
    mood: isMorning ? "peaceful" : isEvening ? "reflective" : "devotional",
    season,
    language: "Roman",
    difficulty: "easy",
    meditation_context: isMorning ? "morning meditation" : "evening meditation",
  }
}

export type QuickRecommendationPreset = {
  id: string
  label: string
  preset: RecommendationPreset
}

export function quickRecommendationPresets(now = new Date()): QuickRecommendationPreset[] {
  return [
    {
      id: "auto",
      label: "Auto",
      preset: getAutoRecommendationPreset(now),
    },
    {
      id: "morning",
      label: "Morning",
      preset: {
        title: "Morning meditation",
        subtitle: "A quiet, hopeful start to the day.",
        occasion: "meditation",
        mood: "peaceful",
        season: "spring",
        language: "Roman",
        difficulty: "easy",
        meditation_context: "morning meditation",
      },
    },
    {
      id: "evening",
      label: "Evening",
      preset: {
        title: "Evening reflection",
        subtitle: "Songs for settling the mind and softening the day.",
        occasion: "meditation",
        mood: "reflective",
        season: "autumn",
        language: "Roman",
        difficulty: "easy",
        meditation_context: "evening meditation",
      },
    },
    {
      id: "service",
      label: "Service",
      preset: {
        title: "Service and uplift",
        subtitle: "Verified songs of service, social uplift, and collective welfare.",
        occasion: "service",
        theme: "AMURT|Neo-Humanism|PROUT|Dharma|VSS|Gurukula",
        mood: "courageous",
        season: "summer",
        language: "Roman",
        difficulty: "easy",
        meditation_context: "service programme",
      },
    },
  ]
}
