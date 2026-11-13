import { t } from "@/lib/i18n"
import { titleCase } from "@/lib/searchMenu/facets"

/**
 * The mood words of a recording with a translation. The upload form offers five (Dada, 9 Nov 2026): Joyful, Meditative, Longing,
 * Energetic, Mix, plus "add your own"; the person may choose several. The older words (Calm, Ecstatic, Devotion, Sad) stay
 * readable: a recording or a listener's vote that carries one still reads as it did, and the form never offers it again.
 * They are not a gate: the Search menu finds the moods the recordings carry (docs/search-menu.md, section 10), so a mood
 * somebody tags that is not in this list still becomes a chip once 3 recordings carry it, titled from its own words. A mood is a
 * public statement, so only CONFIRMED tags count (section 6).
 * One list, kept in step with the API (`apps/api/app/services/recording_tags.py` UPLOAD_MOODS and LEGACY_MOODS;
 * `__tests__/kirtanStyles.test.ts` pins the two sides). Three languages (`mood.<id>` in locales/searchMenu.ts).
 */
export const UPLOAD_MOODS = ["joyful", "meditative", "longing", "energetic", "mix"] as const
export const LEGACY_MOODS = ["calm", "ecstatic", "devotion", "sad"] as const
export const MOODS = [...UPLOAD_MOODS, ...LEGACY_MOODS] as const
export type MoodId = (typeof MOODS)[number]

export function isMood(value: unknown): value is MoodId {
  return typeof value === "string" && (MOODS as readonly string[]).includes(value)
}

/** Is this one of the five the form offers (an older word is read, never offered)? */
export function isUploadMood(value: unknown): value is (typeof UPLOAD_MOODS)[number] {
  return typeof value === "string" && (UPLOAD_MOODS as readonly string[]).includes(value)
}

/** The picker's list: the five words, with their labels. */
export function moodChoices(): { id: string; label: string }[] {
  return UPLOAD_MOODS.map((id) => ({ id, label: moodLabel(id) }))
}

export function moodLabel(id: string): string {
  return isMood(id) ? t(`mood.${id}` as const) : titleCase(id)
}

/** Which kinds keep a mood: every kind but Baba's Audio Discourses (speech). Never required. */
export function kindHasMood(kind: string | null | undefined): boolean {
  return kind !== "baba_audio"
}

/** The own words of a mood are cut like the style's (2 to 40 characters). */
export const MOOD_OTHER_MIN = 2
export const MOOD_OTHER_MAX = 40

/** What the form sends: the listed ids (the five only, in order, once each) and the own words; a word that IS a listed mood becomes it. */
export function cleanMoods(kind: string, ids: readonly string[] | null | undefined, own: readonly string[] | null | undefined): { moods: string[]; moodsOther: string[] } {
  if (!kindHasMood(kind)) return { moods: [], moodsOther: [] }
  const moods: string[] = []
  const words: string[] = []
  for (const id of ids ?? []) if (isUploadMood(id) && !moods.includes(id)) moods.push(id)
  for (const raw of own ?? []) {
    const word = raw.trim().replace(/\s+/g, " ").slice(0, MOOD_OTHER_MAX)
    if (word.replace(/[^\p{L}\p{N}]/gu, "").length < MOOD_OTHER_MIN) continue
    const listed = UPLOAD_MOODS.find((id) => id === word.toLowerCase())
    if (listed) {
      if (!moods.includes(listed)) moods.push(listed)
    } else if (!words.some((w) => w.toLowerCase() === word.toLowerCase())) words.push(word)
  }
  return { moods, moodsOther: words }
}
