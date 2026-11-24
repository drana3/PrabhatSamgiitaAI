import { festivalObservanceExploreQuery } from "@prabhat/core"
import { allFestivalObservances } from "@prabhat/core"

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
  /** Canonical theme_collections.json label for explore catalog search */
  collectionLabel?: string
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

const festivalCalendar: FestivalObservation[] = allFestivalObservances.map((item) => ({
  year: item.year,
  month: item.month,
  day: item.day,
  title: item.title,
  subtitle: item.subtitle,
  occasion: item.occasion,
  season: item.season,
  mood: item.mood,
  language: item.language,
  difficulty: item.difficulty,
  meditation_context: item.meditation_context,
  festival: item.festival,
  theme: item.theme,
  collectionLabel: item.collectionLabel ?? item.relatedCollectionLabel,
}))

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
      query: festivalObservanceExploreQuery(item),
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

export function getAutoRecommendationPreset(now = new Date()): RecommendationPreset {
  const month = now.getMonth() + 1
  const hour = now.getHours()
  const season = seasonFromMonth(month)
  const festivalPreset = festivalPresetForDate(now)
  const isMorning = hour < 12
  const isEvening = hour >= 17

  if (festivalPreset) {
    return festivalPreset
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
        meditation_context: "service programme",
      },
    },
  ]
}
