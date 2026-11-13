import { t } from "@/lib/i18n"
import { similarWord } from "@/lib/kirtan/instruments"
import { titleCase } from "@/lib/searchMenu/facets"

/**
 * The style of a recording: "Style" on the add form, a short list the person may choose SEVERAL of (Dada, 9 Nov 2026: Indian style,
 * Electronic, Acoustic guitar, African, Western) plus "add your own". A Kiirtan must name at least one (a listed one or its own word); the
 * other kinds may, except Baba's Audio Discourses, which are speech. ONE list, kept in step with the API
 * (`apps/api/app/services/recording_styles.py` STYLES and LEGACY_STYLES; `__tests__/kirtanStyles.test.ts` and
 * `apps/api/tests/test_kiirtan_style_and_menu_pins.py` pin the two sides). To add one: add its id here and there and a
 * `style.<id>` label in en, ru and es. The database stores the ids only, so no migration is needed.
 *
 * The first list (Bengali, Hindi, Brajabuli, Dhrupad-flavoured, Folk) is gone from the form. A recording that carries one of those still
 * reads as it did (`LEGACY_STYLES`, labels kept); the form never offers it again. The Search menu shows each style that has enough
 * recordings as a shelf.
 */
export const STYLES = ["indian", "electronic", "acoustic_guitar", "african", "western"] as const
export type StyleId = (typeof STYLES)[number]
export const LEGACY_STYLES = ["bengali", "hindi", "brajabuli", "dhrupad", "folk"] as const
export type LegacyStyleId = (typeof LEGACY_STYLES)[number]
export const OTHER_STYLE = "other"
/** a written style name is 2 to 40 characters (the API's OTHER_MIN and OTHER_MAX, shared with the main instrument) */
export const STYLE_OTHER_MIN = 2
export const STYLE_OTHER_MAX = 40

/** Is this one of the styles the form offers? */
export function isStyle(value: unknown): value is StyleId {
  return typeof value === "string" && (STYLES as readonly string[]).includes(value)
}

/** Is this a style that has a label (offered now, or an older one that is only read)? */
export function isKnownStyle(value: unknown): boolean {
  return isStyle(value) || (typeof value === "string" && (LEGACY_STYLES as readonly string[]).includes(value))
}

/** Which kinds keep a style: every kind but Baba's Audio Discourses (speech). */
export function kindHasStyle(kind: string | null | undefined): boolean {
  return kind !== "baba_audio"
}

/** Which kinds REQUIRE one: a Kiirtan. */
export function kindRequiresStyle(kind: string | null | undefined): boolean {
  return kind === "kiirtan"
}

/** The picker's list: the listed styles, with their labels (the person's own words are added in the picker). */
export function styleChoices(): { id: string; label: string }[] {
  return STYLES.map((id) => ({ id, label: styleLabel(id) }))
}

/** Visible name of a style id; an older id keeps its label; an id with no translation shows its own words, title-cased. */
export function styleLabel(id: string | null | undefined, other?: string | null): string {
  if (!id) return ""
  if (id === OTHER_STYLE) return (other ?? "").trim() || t("style.other")
  return isKnownStyle(id) ? t(`style.${id as StyleId | LegacyStyleId}` as const) : titleCase(id.replace(/_/g, " ")) || t("style.other")
}

/** The styles a recording read from the server carries: the lists when it has them, else its one old `style` (an older row). */
export function stylesOfRecord(record: { styles?: readonly string[] | null; stylesOther?: readonly string[] | null; style?: string | null; styleOther?: string | null }): { styles: string[]; stylesOther: string[] } {
  if (record.styles != null || record.stylesOther != null) return { styles: [...(record.styles ?? [])], stylesOther: [...(record.stylesOther ?? [])] }
  const one = record.style
  if (!one) return { styles: [], stylesOther: [] }
  if (one === OTHER_STYLE) return { styles: [], stylesOther: record.styleOther?.trim() ? [record.styleOther.trim()] : [] }
  return { styles: [one], stylesOther: [] }
}

/**
 * What the form sends: the listed ids (known ones only, in order, once each) and the own words, for a kind that keeps a style. A word that
 * IS a listed style becomes that style (the API does the same). `missing` is true when the kind needs a style and none is left.
 */
export function cleanStyles(kind: string, ids: readonly string[] | null | undefined, own: readonly string[] | null | undefined): { styles: string[]; stylesOther: string[]; missing: boolean } {
  if (!kindHasStyle(kind)) return { styles: [], stylesOther: [], missing: false }
  const styles: string[] = []
  const words: string[] = []
  const add = (id: string) => {
    if (!styles.includes(id)) styles.push(id)
  }
  for (const id of ids ?? []) if (isStyle(id)) add(id)
  for (const raw of own ?? []) {
    const word = raw.trim().replace(/\s+/g, " ").slice(0, STYLE_OTHER_MAX)
    if (word.replace(/[^\p{L}\p{N}]/gu, "").length < STYLE_OTHER_MIN) continue
    const listed = STYLES.find((id) => id === word.toLowerCase().replace(/\s+/g, "_"))
    if (listed) add(listed)
    else if (!words.some((w) => w.toLowerCase() === word.toLowerCase())) words.push(word)
  }
  return { styles, stylesOther: words, missing: kindRequiresStyle(kind) && !styles.length && !words.length }
}

/** The listed style a written name is at least 85% like ("electonic" and Electronic), or null; the picker offers it as "Did you mean". */
export function similarStyle(text: string | null | undefined): StyleId | null {
  const table = Object.fromEntries(STYLES.map((id) => [id, [id.replace(/_/g, " "), styleLabel(id)]])) as Record<StyleId, string[]>
  return similarWord(text, table)
}
