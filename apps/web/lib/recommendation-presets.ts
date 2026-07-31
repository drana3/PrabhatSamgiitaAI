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
}

type FestivalObservation = {
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
  windowDays?: number
}

function seasonFromMonth(month: number) {
  if (month >= 3 && month <= 5) return "spring"
  if (month >= 6 && month <= 8) return "summer"
  if (month >= 9 && month <= 11) return "autumn"
  return "winter"
}

const festivalCalendar: FestivalObservation[] = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
]

function isSameDay(now: Date, month: number, day: number) {
  return now.getMonth() + 1 === month && now.getDate() === day
}

function daysUntil(now: Date, month: number, day: number) {
  const target = new Date(now.getFullYear(), month - 1, day)
  const diffMs = target.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function festivalPresetForDate(now: Date): RecommendationPreset | null {
  const observed = festivalCalendar.find((item) => isSameDay(now, item.month, item.day))
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
  }
}

function upcomingFestivalPreset(now: Date, windowDays = 14): RecommendationPreset | null {
  const upcoming = festivalCalendar
    .map((item) => ({ ...item, delta: daysUntil(now, item.month, item.day) }))
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
        subtitle: "Choose songs that support collective spirit and service.",
        occasion: "service",
        mood: "courageous",
        season: "summer",
        language: "Roman",
        difficulty: "easy",
        meditation_context: "service programme",
      },
    },
  ]
}
