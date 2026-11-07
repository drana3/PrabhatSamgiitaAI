import { t } from "@/lib/i18n"

/**
 * The mood words of a Kiirtan, exactly six (Dada's list): Joyful, Longing, Calm, Ecstatic, Devotion, Sad.
 * They are the "Themes" shelves of the Search menu. A mood is a public statement, so a shelf needs 5 recordings the
 * team or the listeners have CONFIRMED (docs/search-menu.md, section 6); until then no mood shelf exists.
 * One list, three languages (`mood.<id>` in locales/searchMenu.ts).
 */
export const MOODS = ["joyful", "longing", "calm", "ecstatic", "devotion", "sad"] as const
export type MoodId = (typeof MOODS)[number]

export function isMood(value: unknown): value is MoodId {
  return typeof value === "string" && (MOODS as readonly string[]).includes(value)
}

export function moodLabel(id: string): string {
  return isMood(id) ? t(`mood.${id}` as const) : id
}
