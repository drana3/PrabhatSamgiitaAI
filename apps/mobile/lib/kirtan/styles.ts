import { t } from "@/lib/i18n"

/**
 * The style (origin) of a Kiirtan: "Indian Kiirtan / style" on the add form, an optional short pick list plus "other".
 * A Kiirtan is always Baba Nam Kevalam, so it has no sung language; this is what tells one Kiirtan from another
 * (the language of its calling, or the way it is sung). ONE list, kept in step with the API
 * (`apps/api/app/services/recording_styles.py` STYLES; `__tests__/kirtanStyles.test.ts` and
 * `apps/api/tests/test_kiirtan_style_and_menu_pins.py` pin the two sides). To add one: add its id here and there and a
 * `style.<id>` label in en, ru and es. The database stores the id only, so no migration is needed.
 * Only a Kiirtan carries a style. The Search menu shows each style that has enough Kiirtans as a shelf.
 */
export const KIIRTAN_STYLES = ["bengali", "hindi", "brajabuli", "dhrupad", "folk"] as const
export type KiirtanStyleId = (typeof KIIRTAN_STYLES)[number]
export const OTHER_STYLE = "other"
export const STYLE_OTHER_MAX = 80

export function isKiirtanStyle(value: unknown): value is KiirtanStyleId {
  return typeof value === "string" && (KIIRTAN_STYLES as readonly string[]).includes(value)
}

/** The picker: the listed styles, then "Other" (which then asks for a name). */
export function styleChoices(): { id: string; label: string }[] {
  return [...KIIRTAN_STYLES, OTHER_STYLE].map((id) => ({ id, label: styleLabel(id) }))
}

/** Visible name of a style id; `other` with a name shows that name. Unknown ids show as "Other". */
export function styleLabel(id: string | null | undefined, other?: string | null): string {
  if (!id) return ""
  if (id === OTHER_STYLE) return (other ?? "").trim() || t("style.other")
  return isKiirtanStyle(id) ? t(`style.${id}` as const) : t("style.other")
}

/**
 * What the form sends: only a Kiirtan keeps a style; "other" needs its name (cut to STYLE_OTHER_MAX), a listed style
 * drops the name. Returns the problem as `null` when the pair is fine.
 */
export function cleanStyle(
  kind: string,
  style: string | null | undefined,
  other: string | null | undefined,
): { style: string | null; styleOther: string | null; missingName: boolean } {
  if (kind !== "kiirtan" || !style) return { style: null, styleOther: null, missingName: false }
  if (style !== OTHER_STYLE) return { style: isKiirtanStyle(style) ? style : null, styleOther: null, missingName: false }
  const name = (other ?? "").trim().replace(/\s+/g, " ").slice(0, STYLE_OTHER_MAX)
  return { style: OTHER_STYLE, styleOther: name || null, missingName: !name }
}
