import { t } from "@/lib/i18n"
import { titleCase } from "@/lib/searchMenu/facets"

/**
 * The mood words of a Kiirtan with a translation: Joyful, Longing, Calm, Ecstatic, Devotion, Sad (Dada's six). They are not a
 * gate: the Search menu finds the moods the recordings carry (docs/search-menu.md, section 10), so a mood somebody tags that is
 * not in this list still becomes a chip once 3 recordings carry it, titled from its own words. A mood is a public statement, so
 * only CONFIRMED tags count (section 6).
 * One list, three languages (`mood.<id>` in locales/searchMenu.ts).
 */
export const MOODS = ["joyful", "longing", "calm", "ecstatic", "devotion", "sad"] as const
export type MoodId = (typeof MOODS)[number]

export function isMood(value: unknown): value is MoodId {
  return typeof value === "string" && (MOODS as readonly string[]).includes(value)
}

export function moodLabel(id: string): string {
  return isMood(id) ? t(`mood.${id}` as const) : titleCase(id)
}
