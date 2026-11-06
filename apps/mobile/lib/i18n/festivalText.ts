import { festivalCaptionsEs, festivalCaptionsRu, type FestivalCaption } from "@/locales/festivals"
import type { Language } from "@/lib/i18n/core"

/** "ru-day-2027" is the festival "ru-day": the captions do not depend on the year. */
export function festivalBaseId(id: string): string {
  return id.replace(/-\d{4}$/, "")
}

/**
 * The title and the caption of a festival in the language on screen. English is the calendar's own text;
 * a festival with no Russian or Spanish caption (a new one added to the calendar) keeps the English one.
 * Call it from a component that also has `useT()`, so it re-renders when the language changes.
 */
export function festivalText(
  festival: { id: string; title: string; subtitle: string },
  language: Language,
): { title: string; subtitle: string } {
  const table: Readonly<Record<string, FestivalCaption>> | null =
    language === "ru" ? festivalCaptionsRu : language === "es" ? festivalCaptionsEs : null
  const caption = table?.[festivalBaseId(festival.id)]
  if (!caption) return { title: festival.title, subtitle: festival.subtitle }
  return { title: caption.title ?? festival.title, subtitle: caption.subtitle }
}
